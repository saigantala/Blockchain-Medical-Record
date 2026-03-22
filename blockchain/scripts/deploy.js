const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying MedicalAccess contract...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  const MedicalAccess = await ethers.getContractFactory("MedicalAccess");
  const contract = await MedicalAccess.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`\n✅ MedicalAccess deployed to: ${contractAddress}`);

  // ── Save ABI + address for the frontend ──────────────────────────────────
  const artifactsDir = path.join(__dirname, "../../frontend/src/contracts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Load ABI from Hardhat artifact
  const artifact = require("../artifacts/contracts/MedicalAccess.sol/MedicalAccess.json");

  const contractInfo = {
    address: contractAddress,
    abi: artifact.abi,
    network: (await ethers.provider.getNetwork()).name,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(artifactsDir, "MedicalAccess.json");
  fs.writeFileSync(outputPath, JSON.stringify(contractInfo, null, 2));
  console.log(`\n📄 Contract info saved to: ${outputPath}`);

  // Also save just the address to .env-compatible file
  const envLine = `VITE_CONTRACT_ADDRESS=${contractAddress}\n`;
  fs.writeFileSync(path.join(artifactsDir, "contract.env"), envLine);
  console.log(`📝 Contract address env saved.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
