from ultralytics import YOLO

# --- Huấn luyện YOLOv8 Detection ---
print("🚀 Bắt đầu huấn luyện YOLOv8 Detection...")

# Dùng model nhỏ nhất để train nhanh
model = YOLO(r"runs\detect\apple-leaf-detect\weights\last.pt")
model.train(
    data="dataset.yaml",  # file yaml đã tạo
    epochs=50,            # số epoch
    imgsz=640,            # kích thước ảnh (detection thường dùng 640)
    batch=16,             # batch size
    name="apple-leaf-detect"
)

print("🎉 Huấn luyện hoàn tất! Kết quả nằm ở:")
print("   runs/detect/apple-leaf-detect/weights/best.pt")
