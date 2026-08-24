import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const contractAddress =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const chainRecall = await ethers.getContractAt(
    "ChainRecall",
    contractAddress
  );

  const product = await chainRecall.getProduct(
    "PARA-20260821-001"
  );

  console.log("Product found!");
  console.log("Batch ID:", product[0]);
  console.log("Product:", product[1]);
  console.log("Manufacturer:", product[2]);
  console.log("Manufacture Date:", product[3].toString());
  console.log("Expiry Date:", product[4].toString());
  console.log("Recalled:", product[5]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});