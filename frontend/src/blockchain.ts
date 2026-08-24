import { ethers } from "ethers";

const CONTRACT_ADDRESS =
  "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

const CONTRACT_ABI = [
  "function getProduct(string memory batchId) public view returns (string memory, string memory, string memory, uint256, uint256, bool)",
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

  return await contract.getProduct(batchId);
}