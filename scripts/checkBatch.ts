import { network } from "hardhat";

async function main() {
  const batchId = process.env.BATCH_ID;

  if (!batchId) {
    console.error("BATCH_ID is required.");
    process.exit(1);
  }

  const { ethers } = await network.connect();

  const contractAddress =
    "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";

  const chainRecall = await ethers.getContractAt(
    "ChainRecall",
    contractAddress
  );

  const product = await chainRecall.getProduct(batchId);

  if (product[0] === "") {
    console.log("❌ Product not found.");
    return;
  }

  console.log("\n========== CHAINRECALL VERIFICATION ==========");
  console.log("Batch ID:", product[0]);
  console.log("Product:", product[1]);
  console.log("Manufacturer:", product[2]);
  console.log("Manufacture Date:", product[3].toString());
  console.log("Expiry Date:", product[4].toString());

  if (product[5]) {
    console.log("STATUS: 🚨 RECALLED");
  } else {
    console.log("STATUS: ✅ VALID");
  }

  console.log("==============================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});