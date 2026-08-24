import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ChainRecallModule = buildModule("ChainRecallModule", (m) => {
  const chainRecall = m.contract("ChainRecall");

  return { chainRecall };
});

export default ChainRecallModule;