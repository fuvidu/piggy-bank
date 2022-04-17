import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import Aggregator from "./Aggregator";
import PiggyBank from "./PiggyBank";

const baseAmount = ethers.utils.parseEther("3");
const price = 3000;
const quoteAmount = baseAmount.mul(price);
const duration = 3600;
const takeProfitPercent = 200;
const stopLossPercent = 100;

describe("PiggyBank", () => {
  let piggyBankContract: PiggyBank;
  let aggregatorContract: Aggregator;
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();
    aggregatorContract = await (
      await ethers.getContractFactory("MockAggregator")
    ).deploy();
    await aggregatorContract.deployed();
    await aggregatorContract.setLatestPrice(price);

    piggyBankContract = await (
      await ethers.getContractFactory("PiggyBank")
    ).deploy(aggregatorContract.address);
    await piggyBankContract.deployed();
  });

  describe("deposit", () => {
    it("should not allow to deposit without a release condition", async () => {
      await expect(
        piggyBankContract.deposit(0, 0, 0, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.revertedWith(
        "PiggyBank: At least one release condition must be defined"
      );
    });

    it("shoud allow to deposit when duration is defined", async () => {
      await expect(
        piggyBankContract.deposit(1, 0, 0, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.not.be.reverted;
    });

    it("shoud allow to deposit when take profit is defined", async () => {
      await expect(
        piggyBankContract.deposit(0, 1, 0, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.not.be.reverted;
    });

    it("shoud allow to deposit when stop loss is defined", async () => {
      await expect(
        piggyBankContract.deposit(0, 0, 1, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.not.be.reverted;
    });

    it("should raise deposited event", async () => {
      await expect(
        piggyBankContract.deposit(
          duration,
          takeProfitPercent,
          stopLossPercent,
          {
            value: baseAmount,
          }
        )
      )
        .to.emit(piggyBankContract, "Deposited")
        .withArgs(
          deployer.address,
          baseAmount,
          quoteAmount,
          duration,
          takeProfitPercent,
          stopLossPercent
        );
    });
  });

  describe("withdraw", () => {
    it("should not allow to withdraw release condition is not met", async () => {
      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );
      await expect(piggyBankContract.withdraw()).to.be.revertedWith(
        "PiggyBank: Not withdrawable"
      );
    });

    it("should allow to withdraw when duration is expired", async () => {
      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await expect(piggyBankContract.withdraw())
        .to.emit(piggyBankContract, "Withdrawn")
        .withArgs(deployer.address, baseAmount);
    });

    it("should allow to withdraw when price is up to take profit", async () => {
      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );

      const latestPrice = price * (1 + takeProfitPercent / 100 / 100);
      await aggregatorContract.setLatestPrice(latestPrice);

      await expect(piggyBankContract.withdraw())
        .to.emit(piggyBankContract, "Withdrawn")
        .withArgs(deployer.address, baseAmount);
    });

    it("should allow to withdraw when price is down to stop loss", async () => {
      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );

      const latestPrice = price * (1 - stopLossPercent / 100 / 100);
      await aggregatorContract.setLatestPrice(latestPrice);

      await expect(piggyBankContract.withdraw())
        .to.emit(piggyBankContract, "Withdrawn")
        .withArgs(deployer.address, baseAmount);
    });

    it("should allow to withdraw only matched amount", async () => {
      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );
      await expect(piggyBankContract.withdraw())
        .to.emit(piggyBankContract, "Withdrawn")
        .withArgs(deployer.address, baseAmount);
    });

    it("should allow to withdraw all matched amount", async () => {
      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );

      await piggyBankContract.deposit(
        duration,
        takeProfitPercent,
        stopLossPercent,
        {
          value: baseAmount,
        }
      );

      const latestPrice = price * (1 + takeProfitPercent / 100 / 100);
      await aggregatorContract.setLatestPrice(latestPrice);

      await expect(piggyBankContract.withdraw())
        .to.emit(piggyBankContract, "Withdrawn")
        .withArgs(deployer.address, baseAmount.mul(2));
    });
  });
});
