Automatic Steem Account Claimer
==

Simple, dirty implementation of auto account claimer on Steem Blockchain

## Install
```
npm install
npm install -g pm2
```

## Config
The test account on `config.json` is used for checking the RC price of account claim operation, so it should also be an actual account with almost zero RC to see the error message.

`FIXME:` I couldn't find the proper way to get the RC price for account creation except just trying with a low RC account and see the error message. If anyone find the proper solution, please make a PR for that.

## Run
```
pm2 start claim_account.js
```