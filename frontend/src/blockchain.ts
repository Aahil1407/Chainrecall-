import { ethers } from "ethers";

const CONTRACT_ADDRESS =
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

const CONTRACT_ABI = [
  "function getProduct(string batchId) view returns (tuple(string batchId,string productName,string manufacturer,uint256 manufactureDate,uint256 expiryDate,bool recalled))",
];

export async function getProduct(batchId: string) {
  const provider = new ethers.JsonRpcProvider(
    "http://127.0.0.1:8545"
  );

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    provider
  );

  const product = await contract.getProduct(batchId);

  return {
    batchId: product.batchId,
    productName: product.productName,
    manufacturer: product.manufacturer,
    manufactureDate: product.manufactureDate.toString(),
    expiryDate: product.expiryDate.toString(),
    recalled: product.recalled,
  };
}