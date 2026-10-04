import { network } from "hardhat";

async function main() {
  const batchId = process.env.BATCH_ID;

  if (!batchId) {
    throw new Error("BATCH_ID is required");
  }

  const { ethers } = await network.connect();

  const contractAddress =
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

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