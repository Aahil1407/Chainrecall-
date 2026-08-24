import { network } from "hardhat";

async function main() {
  const batchId = process.env.BATCH_ID;

  if (!batchId) {
    throw new Error("BATCH_ID is required");
  }

  const { ethers } = await network.connect();

  const contractAddress =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const chainRecall = await ethers.getContractAt(
    "ChainRecall",
    contractAddress
  );

  const tx = await chainRecall.updateRecallStatus(
    batchId,
    true
  );

  await tx.wait();

  console.log("Product recalled successfully!");
  console.log("Batch ID:", batchId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});