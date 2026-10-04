import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const contractAddress =
    "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  const code = await ethers.provider.getCode(
    contractAddress
  );

  console.log("\n========== CONTRACT CHECK ==========");
  console.log("Address:", contractAddress);
  console.log("Code length:", code.length);
  console.log("Has contract:", code !== "0x");
  console.log("====================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});