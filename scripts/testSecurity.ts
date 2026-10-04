import { network } from "hardhat";

async function main() {
  const batchId = process.env.BATCH_ID;

  if (!batchId) {
    throw new Error("BATCH_ID is required");
  }

  const { ethers } = await network.connect();

  const contractAddress =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const [owner, attacker] = await ethers.getSigners();

  const chainRecall = await ethers.getContractAt(
    "ChainRecall",
    contractAddress
  );

  console.log("\n========== UNAUTHORIZED ACCESS TEST ==========");
  console.log("Batch ID:", batchId);
  console.log("Owner:", await owner.getAddress());
  console.log("Attacker:", await attacker.getAddress());

  // Connect contract to attacker account
  const attackerContract = chainRecall.connect(attacker) as any;

  try {
    // Attacker attempts to modify the recall status
    const tx = await attackerContract.updateRecallStatus(
      batchId,
      false
    );

    await tx.wait();

    console.log("\n❌ SECURITY TEST FAILED");
    console.log("Attacker was able to modify the recall status!");
  } catch (error) {
    console.log("\n✅ SECURITY TEST PASSED");
    console.log("Unauthorized attacker was blocked.");
    console.log("Reason: Only owner can perform this action.");
  }

  console.log("==============================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});