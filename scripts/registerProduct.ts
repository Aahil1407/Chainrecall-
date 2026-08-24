import { network } from "hardhat";

function generateBatchId(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `CR-${year}${month}${day}-${randomNumber}`;
}

async function main() {
  const { ethers } = await network.connect();

  const contractAddress =
    "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";

  const chainRecall = await ethers.getContractAt(
    "ChainRecall",
    contractAddress
  );

  const batchId = generateBatchId();

  const tx = await chainRecall.registerProduct(
    batchId,
    "Paracetamol 500mg",
    "ABC Pharma",
    20260821,
    20280821
  );

  await tx.wait();

  console.log("Product registered successfully!");
  console.log("Batch ID:", batchId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});