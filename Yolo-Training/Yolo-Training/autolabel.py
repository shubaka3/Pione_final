# auto_label_fixed.py
import cv2, os, numpy as np
from pathlib import Path

base = "dataset"
min_area = 100  # vùng nhỏ nhất được coi là object

def auto_label(img_dir):
    # Tạo thư mục labels song song với mỗi ảnh
    for img_path in Path(img_dir).rglob("*.jpg"):
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"[WARN] Không đọc được ảnh: {img_path}")
            continue

        h, w = img.shape[:2]
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)

        # mask táo (xanh nhạt hơi vàng)
        lower_apple = np.array([15, 50, 80])
        upper_apple = np.array([50, 255, 255])
        mask_apple = cv2.inRange(hsv, lower_apple, upper_apple)

        # mask lá (xanh đậm)
        lower_leaf = np.array([35, 40, 40])
        upper_leaf = np.array([95, 255, 255])
        mask_leaf = cv2.inRange(hsv, lower_leaf, upper_leaf)

        # Làm sạch mask
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5,5))
        mask_apple = cv2.morphologyEx(mask_apple, cv2.MORPH_CLOSE, kernel)
        mask_leaf = cv2.morphologyEx(mask_leaf, cv2.MORPH_CLOSE, kernel)

        labels = []
        for cls_id, mask in [(0, mask_leaf), (1, mask_apple)]:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                x, y, ww, hh = cv2.boundingRect(cnt)
                if ww * hh < min_area:
                    continue
                xc = (x + ww / 2) / w
                yc = (y + hh / 2) / h
                wn = ww / w
                hn = hh / h
                labels.append((cls_id, xc, yc, wn, hn))

        # Tạo thư mục labels song song
        label_dir = os.path.join(img_path.parent.parent, "labels", img_path.parent.name)
        os.makedirs(label_dir, exist_ok=True)
        label_file = os.path.join(label_dir, img_path.stem + ".txt")

        with open(label_file, "w") as f:
            for cls, xc, yc, wn, hn in labels:
                f.write(f"{cls} {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}\n")

        if not labels:
            open(label_file, "w").close()

        print(f"[OK] {img_path.name} -> {len(labels)} object(s)")

if __name__ == "__main__":
    auto_label(os.path.join(base, "train"))
    auto_label(os.path.join(base, "val"))
    print("✅ Auto-label hoàn tất! Kiểm tra dataset/train/labels/*/")
