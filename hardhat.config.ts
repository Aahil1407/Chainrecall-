import { configVariable, defineConfig } from "hardhat/config";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

export default defineConfig({
  plugins: [hardhatIgnition, hardhatEthers],

  solidity: {
    version: "0.8.28",
  },
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      accounts: "remote",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
