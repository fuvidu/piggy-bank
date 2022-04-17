//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 @title A Piggy Bank allows users to lock money until one of 3 conditions is met:
  + Lock duration is expired.
  + The price is up to Take profit.
  + The price is down to Stop loss.
 @author Fuvidu
 @dev This contract uses oracle from chainlink to get latest price of ETH in USD.
 */
contract PiggyBank {
    /// @notice Contains information of one deposit.
    struct Balance {
        uint256 baseAmount;
        uint256 quoteAmount;
        uint256 depositTime;
        uint256 duration;
        uint256 takeProfitPercent;
        uint256 stopLossPercent;
    }

    /**
     * @notice Balances of all users.
     * @dev Each user may deposit multiple times.
     */
    mapping(address => Balance[]) internal balances;

    /**
     * @notice Price feed
     */
    AggregatorV3Interface internal priceFeed;

    /**
     * @dev Raised when someone deposits money
     * @param user Wallet address of the user
     * @param baseAmount Amount in base currency
     * @param quoteAmount Amount in quote currency. This is calculated based on the price at the time of deposit.
     * @param duration Lock duration in seconds.
     * @param takeProfitPercent Take profit percent
     * @param stopLossPercent Stop loss percent
     */
    event Deposited(
        address user,
        uint256 baseAmount,
        uint256 quoteAmount,
        uint256 duration,
        uint256 takeProfitPercent,
        uint256 stopLossPercent
    );

    /**
     * @dev Raised when someone withdraws money
     * @param payee Payee
     * @param amount Amount in base currency
     */
    event Withdrawn(address payee, uint256 amount);

    constructor(address aggregator) {
        priceFeed = AggregatorV3Interface(aggregator);
    }

    /**
     * @notice Deposit money into Piggy Bank
     * @dev At least one lock condition must be greater than 0.
     * @param duration The duration to lock the money. If duration is 0 then there is no lock by time.
     * @param takeProfitPercent The percentage to take profit when the price is up.
     * If take profit is 0 then there is no lock by take profit.
     * Since solidity does not support float number, we'll use integer number and then divide by 100
     * to get 2 decimal points. For example, if we want take profit percentage is 2.52% then we pass
     * takeProfitPercent as 252, when calculate the smart contract will divide 252 by 100.
     * @param stopLossPercent the percentage to stop loss when the price is down.
     */
    function deposit(
        uint256 duration,
        uint256 takeProfitPercent,
        uint256 stopLossPercent
    ) external payable {
        require(
            duration > 0 || takeProfitPercent > 0 || stopLossPercent > 0,
            "PiggyBank: At least one release condition must be defined"
        );

        uint256 quoteAmount = msg.value * getLatestPrice();
        require(quoteAmount > 0, "PiggyBank: Invalid price");

        balances[msg.sender].push(
            Balance({
                baseAmount: msg.value,
                quoteAmount: quoteAmount,
                depositTime: block.timestamp,
                duration: duration,
                takeProfitPercent: takeProfitPercent,
                stopLossPercent: stopLossPercent
            })
        );
        emit Deposited({
            user: msg.sender,
            baseAmount: msg.value,
            quoteAmount: quoteAmount,
            duration: duration,
            takeProfitPercent: takeProfitPercent,
            stopLossPercent: stopLossPercent
        });
    }

    /**
     @dev Get the latest price of base currency
     @return price The current price from oracle
     */
    function getLatestPrice() public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price >= 0 ? uint256(price) : 0;
    }

    /**
     * @dev Get withdrawable amount in base currency
     * @return withdrawableAmount the withdrawable amount in base currency
     */
    function getWithdrawableAmount()
        public
        view
        returns (uint256 withdrawableAmount)
    {
        for (uint256 i = 0; i < balances[msg.sender].length; i++) {
            withdrawableAmount += getWithdrawableAmountAt(msg.sender, i);
        }
    }

    /**
     * @notice Withdraw money in base currency when one of withdrawable condition is met.
     * @return Whether money is withdrawn successfully
     */
    function withdraw() external returns (bool) {
        uint256 withdrawableAmount = 0;

        for (uint256 i = 0; i < balances[msg.sender].length; i++) {
            uint256 amount = getWithdrawableAmountAt(msg.sender, i);
            /// Reset balance at index if it is withdrawn
            if (amount > 0) {
                withdrawableAmount += amount;
                delete balances[msg.sender][i];
            }
        }

        require(withdrawableAmount > 0, "PiggyBank: Not withdrawable");

        (bool sent, ) = payable(msg.sender).call{value: withdrawableAmount}("");
        require(sent, "PiggyBank: Withdraw failed");

        emit Withdrawn(msg.sender, withdrawableAmount);
        return true;
    }

    /**
     * @dev Check if one of deposits of one user is withdrawable and returns the withdrawable amount
     * @param user Address of the user
     * @param index Index of the deposit in the balances array
     * @return withdrawableAmount The withdrawable amount
     */
    function getWithdrawableAmountAt(address user, uint256 index)
        internal
        view
        returns (uint256 withdrawableAmount)
    {
        Balance memory balance = balances[user][index];
        bool isExpired = balance.duration > 0 &&
            block.timestamp - balance.depositTime >= balance.duration;

        uint256 latestQuoteAmount = balance.baseAmount * getLatestPrice();
        int256 diffPercent = latestQuoteAmount >= balance.quoteAmount
            ? int256(
                ((latestQuoteAmount - balance.quoteAmount) * 100 * 100) /
                    balance.quoteAmount
            )
            : int256(
                ((balance.quoteAmount - latestQuoteAmount) * 100 * 100) /
                    balance.quoteAmount
            ) * -1;

        bool isTakeProfit = balance.takeProfitPercent > 0 &&
            diffPercent >= int256(balance.takeProfitPercent);
        bool isStopLoss = balance.stopLossPercent > 0 &&
            diffPercent <= int256(balance.stopLossPercent) * -1;

        if (isExpired || isTakeProfit || isStopLoss) {
            withdrawableAmount += balance.baseAmount;
        }
    }
}
