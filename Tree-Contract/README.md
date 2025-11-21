Run `npm audit` for details.
PS D:\pione\deploy_smart_contract\Track-01-Contract-Demo-main> npx hardhat run scripts/deploy-factory.js --network pioneZero
[dotenv@17.2.2] injecting env (2) from .env -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
× Help us improve Hardhat with anonymous crash reports & basic usage data? (Y/n) · y
Downloading compiler 0.8.28
Compiled 8 Solidity files successfully (evm target: paris).
[dotenv@17.2.2] injecting env (0) from .env -- tip: 📡 observe env with Radar: https://dotenvx.com/radar
[dotenv@17.2.2] injecting env (0) from .env -- tip: ⚙️  override existing env vars with { override: true }
Deploying contracts with the account: 0x7e2FB409CEe4Fc7C9ba7aaaEd133f134B48D2daE
Account balance: 198508267489259526
Network: pioneZero
Deploying DemoFarmTraceabilityFactory...
DemoFarmTraceabilityFactory deployed to: 0x998316cAe68113FA2EEA654E59685951980Eef61
Transaction hash: 0xcd6946a72526be369b93ec4b69bf2d9c415becf53dd5c1a03294184c735a6b81
EXPLORER_API_KEY not found. Skipping verification.
Deployment completed!
Factory Address: 0x998316cAe68113FA2EEA654E59685951980Eef61
Owner: 0x7e2FB409CEe4Fc7C9ba7aaaEd133f134B48D2daE


địa chỉ supply chain: 0xC360ad0e3767A9d05b8a7509b5CFE4113998098D
× Help us improve Hardhat with anonymous crash reports & basic usage data? (Y/n) · y
[dotenv@17.2.2] injecting env (0) from .env -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
Welcome to Node.js v22.17.1.
Type ".help" for more information.
> const factoryAddress = "0x998316cAe68113FA2EEA654E59685951980Eef61"; 
undefined
> const Factory = await ethers.getContractFactory("DemoFarmTraceabilityFactory"); 
undefined
> const factory = await Factory.attach(factoryAddress);
undefined
> const [deployer] = await ethers.getSigners();
undefined
> const companyRegNumber = "TYT-AGRI-VN";
undefined
> console.log("-> Đang gửi giao dịch đăng ký công ty...");
-> Đang gửi giao dịch đăng ký công ty...
undefined
> const txReg = await factory.registerCompany(companyRegNumber, "TYT Farm Solutions", deployer.address);
undefined
>
> await txReg.wait();
ContractTransactionReceipt {       
  provider: HardhatEthersProvider {
    _hardhatProvider: LazyInitializationProviderAdapter {
      _providerFactory: [AsyncFunction (anonymous)],
      _emitter: [EventEmitter],
      _initializingPromise: [Promise],
      provider: [BackwardsCompatibilityProviderAdapter]
    },
    _networkName: 'pioneZero',
    _blockListeners: [],
    _transactionHashListeners: Map(0) {},
    _eventListeners: []
  },
  to: '0x998316cAe68113FA2EEA654E59685951980Eef61',
  from: '0x7e2FB409CEe4Fc7C9ba7aaaEd133f134B48D2daE',
  contractAddress: null,
  hash: '0xfc45c08f311fde3135f5d61f47346a648af1def3d156686437f11e0057b50c1c',
  index: 0,
  blockHash: '0xc5c3ef77e2caaa9ec776ea3cc64ed4ab0fd0c534734edd9ac564673c560e52f1',
  blockNumber: 6609719,
  logsBloom: '0x00000100000000000000000000000000000000000000000000000000000000000000000000000008000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000800000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000100000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000',
  gasUsed: 164216n,
  blobGasUsed: undefined,
  cumulativeGasUsed: 164216n,
  gasPrice: 1000000007n,
  blobGasPrice: undefined,
  type: 2,
  status: 1,
  root: undefined
}
>