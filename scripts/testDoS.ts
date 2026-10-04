import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const contractAddress =
    "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

  const batchId = "CR-20260924-2674";

  const chainRecall = await ethers.getContractAt(
    "ChainRecall",
    contractAddress
  );

  const requestCount = 500;

  console.log("\n========== DOS AVAILABILITY TEST ==========");
  console.log("Target:", "getProduct()");
  console.log("Batch ID:", batchId);
  console.log("Requests:", requestCount);

  const startTime = Date.now();

  let successful = 0;
  let failed = 0;

  const requests = Array.from(
    { length: requestCount },
    async () => {
      try {
        await chainRecall.getProduct(batchId);
        successful++;
      } catch {
        failed++;
      }
    }
  );

  await Promise.all(requests);

  const duration = Date.now() - startTime;

  console.log("\n========== TEST RESULT ==========");
  console.log("Successful requests:", successful);
  console.log("Failed requests:", failed);
  console.log("Total time:", `${duration} ms`);

  if (failed === 0) {
    console.log("\n⚠️ NODE ACCEPTED ALL REQUESTS");
    console.log(
      "The current prototype has no application-level rate limiting."
    );
  } else {
    console.log("\n✅ SOME REQUESTS WERE REJECTED");
    console.log("Further investigation is required.");
  }

  console.log("=================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});