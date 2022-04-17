# Overview

This project demonstrates a PiggyBank which allows users to deposit money into the smart contract and can withdraw only when
one of release conditions is met. There are 3 release conditions:

- Duration
- Take profit
- Stop loss

## Installation

- Create the `.env` file with the following configutation

  ```
  ETHERSCAN_API_KEY=ABC123ABC123ABC123ABC123ABC123ABC1
  ROPSTEN_URL=https://eth-ropsten.alchemyapi.io/v2/<YOUR ALCHEMY KEY>
  PRIVATE_KEY=0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1
  AGGREGATOR_CONTRACT=0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1

  ```

- Run `yarn install` from the project folder

## Testing

- `yarn test`

## Deployment

- `yarn deploy`
