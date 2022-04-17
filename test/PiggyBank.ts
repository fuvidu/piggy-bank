import { BigNumber, Contract, ContractTransaction } from "ethers";

export default interface PiggyBank extends Contract {
  deposit(
    duration: number,
    takeProfitPercent: number,
    stopLossPercent: number,
    options: { value: BigNumber }
  ): Promise<ContractTransaction>;

  withdraw(): Promise<ContractTransaction>;

  getLockedAmount(): Promise<BigNumber>;
}
