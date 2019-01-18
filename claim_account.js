const steem = require('steem');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json'));

function stopLimit(cost) {
  if (cost > 40000000000000) { // Don't claim if over 40T
    return 100.0;
  } else if (cost > 30000000000000) {
    return 90.0;
  } else if (cost > 18000000000000) {
    return 80.0;
  } else if (cost > 16000000000000) {
    return 60.0;
  } else if (cost > 14000000000000) {
    return 50.0;
  } else if (cost > 12000000000000) {
    return 40.0;
  } else if (cost > 10000000000000) {
    return 30.0;
  } else {
    return 10.0; // Leave 10% RC for other transactions
  }
}

function adjustRecharge(lastValue, lastUpdated) {
  const secPassed = (Date.now() - (new Date(lastUpdated * 1000))) / 1000;
  const currentValue = (lastValue + (secPassed / 3600) * (20 / 24)); // 20% recharge in a day
  const result = currentValue > 100 ? 100 : currentValue;

  return Math.round(result * 100) / 100;
}

function getRCInfo(account) {
  return new Promise(function(resolve, _) {
    steem.api.send('rc_api', {
      method: 'find_rc_accounts',
      params: {'accounts': [account]},
    }, function(_, res) {
      resolve(res.rc_accounts[0]);
    });
  });
}

async function printRCBalance() {
  const rc = await getRCInfo(config.real.username);
  const rcMax = Number(rc.max_rc);
  const rcPercent = 100 * rc.rc_manabar.current_mana / rcMax;
  const adjustedRCPercent = adjustRecharge(rcPercent, rc.rc_manabar.last_update_time);
  const currentRCBalance = 0.01 * rcMax * adjustedRCPercent;
  console.log(`Current RC Balance: ${adjustedRCPercent.toLocaleString()}% (${currentRCBalance.toLocaleString()} / ${rcMax.toLocaleString()})`);

  return adjustedRCPercent;
}

async function printPendingClaimed() {
  const [ account ] = await steem.api.getAccountsAsync([ config.real.username ]);
  console.log(`Pending accounts: ${account.pending_claimed_accounts}`);
}

async function task() {
  return new Promise(async function(resolve, reject) {
    await printPendingClaimed();
    let adjustedRCPercent = await printRCBalance();

    // HACK: to get RC cost for claiming account
    steem.broadcast.claimAccountAsync(config.test.wif, config.test.username, '0.000 STEEM', []).then((result) => {
      console.log('ERROR: RC is that low?', result);
      reject();
    }, (e) => {
      const match = e.message.match(/needs (\d+) RC/);
      if (!match) {
        console.log('FUCKED' + e.message);
      }
      const cost = Number(match[1]);
      console.log(`RC cost to claim an account: ${cost.toLocaleString()})`);

      if (stopLimit(cost) > adjustedRCPercent) {
        console.log("Cost limit reached, Wait till cheaper cost");
        setTimeout(function() {
          resolve();
        }, 600000);
      } else {
        console.log('Claiming account..');
        steem.broadcast.claimAccountAsync(config.real.wif, config.real.username, '0.000 STEEM', []).then((result) => {
          console.log('CLAIMED:', result);
          resolve();
        }, (e) => {
          console.log('ERROR', e);
          reject();
        });
      }
    });
  });
};

class RPCSwitcher {
  constructor(){
    // REF: https://geo.steem.pl
    this.list = [
      'https://api.steemit.com',
      'https://rpc.steemliberator.com',
    ];
    this.index = 0;

    console.log(`Set RPC server endpoint: ${this.list[0]}`);
    steem.api.setOptions({ url: this.list[0] });
  }

  next() {
    this.index++;
    if (this.index >= this.list.length) {
      this.index = 0;
    }

    console.log(`Change RPC server endpoint: ${this.list[this.index]}`);
    steem.api.setOptions({ url: this.list[this.index] });
  }
}

const rpcSwitcher = new RPCSwitcher();

async function run() {
  while(true) {
    try {
      await task();
    } catch(e) {
      console.log(e);
      rpcSwitcher.next();
    }
  }
}

run();