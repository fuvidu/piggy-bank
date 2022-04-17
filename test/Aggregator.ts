import { Contract, ContractTransaction } from "ethers";

export default interface Aggregator extends Contract {
  setLatestPrice(price: number): Promise<ContractTransaction>;
}
