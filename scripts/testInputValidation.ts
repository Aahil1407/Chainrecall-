import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const contractAddress =
  "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

  const [owner] = await ethers.getSigners();

  const chainRecall = await ethers.getContractAt(
    "ChainRecall",
    contractAddress
  );

  console.log("\n========== INPUT VALIDATION TEST ==========");

  console.log("\nTest 1: Empty Batch ID");

  try {
    const tx = await chainRecall.registerProduct(
      "",
      "Paracetamol 500mg",
      "ABC Pharma",
      20260917,
      20280917
    );

    await tx.wait();

    console.log("❌ VULNERABILITY CONFIRMED");
    console.log("Empty Batch ID was accepted.");
  } catch (error) {
    console.log("✅ Empty Batch ID was rejected.");
  }

  console.log("\nTest 2: Empty Product Name");

  try {
    const tx = await chainRecall.registerProduct(
      "CR-INVALID-001",
      "",
      "ABC Pharma",
      20260917,
      20280917
    );

    await tx.wait();

    console.log("❌ VULNERABILITY CONFIRMED");
    console.log("Empty product name was accepted.");
  } catch (error) {
    console.log("✅ Empty product name was rejected.");
  }

  console.log("\nTest 3: Invalid Dates");

  try {
    const tx = await chainRecall.registerProduct(
      "CR-INVALID-002",
      "Paracetamol 500mg",
      "ABC Pharma",
      20280917,
      20260917
    );

    await tx.wait();

    console.log("❌ VULNERABILITY CONFIRMED");
    console.log("Expiry date earlier than manufacture date was accepted.");
  } catch (error) {
    console.log("✅ Invalid dates were rejected.");
  }

  console.log("\n============================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});