"use strict";

const FoodToken = artifacts.require("./FoodToken.sol");
const Contribution = artifacts.require("./Contribution.sol");
const assert = require('assert');
const testutils = require("./testutils.js");
const BigNumber = require('bignumber.js');

let contribution;
let foodToken;



contract('Contribiution', function(accounts) {

    const FOUNDER = "0x0000000000000000000000000000000000000001";
    const FOUNDER_STAKE = 1000;

    const hours = 3600;
    const weeks = 24 * 7 * hours;
    const years = 52 * weeks;

    const PRICE_RATE_FIRST = 2200;
    const PRICE_RATE_SECOND = 2150;
    const PRICE_RATE_THIRD = 2100;
    const PRICE_RATE_FOURTH = 2050;

    const startDelay = 1 * weeks;
    
    const sss = accounts[9]

    let initalBlockTime;
    let startTime;
    let endTime;

    it('Set startTime as now', (done) => {
      web3.eth.getBlock('latest', (err, result) => {
        initalBlockTime = result.timestamp;
        startTime = initalBlockTime + startDelay;
        endTime = startTime + (4 * weeks);
        done();
      });
    });

    describe('CONTRACT DEPLOYMENT', () => {
        it('Deploy Contribution contracts', (done) => {
          Contribution.new(startTime, sss).then((result) => {
            contribution = result;
            return contribution.foodToken();
          }).then((result) => {
            foodToken = FoodToken.at(result);
            done();
          });
        });

        it('Check time initialisation', (done) => {
          foodToken.startTime()
          .then((result) => {
            assert.equal(startTime, result);
            return foodToken.endTime();
          })
          .then((result) => {
            assert.equal(result, endTime);
            return contribution.startTime();
          })
          .then((result) => {
            assert.equal(result, startTime);
            return contribution.endTime();
          })
          .then((result) => {
            assert.equal(result, endTime);
            done();
          });
        });

        it ("preallocated tokens", () => {
            foodToken.preallocatedBalanceOf(FOUNDER).then( (balance) => {
                assert.equal(FOUNDER_STAKE, balance);
            })
        });

    });
    
    describe('BEFORE PUBLIC CONTRIBUTION', () => {
        it('Test buying too early', (done) => {
            contribution.buy({ from: accounts[0], value: 1000 }).catch(() => {
                return foodToken.balanceOf(accounts[0]);
            }).then((result) => {
                assert.equal(result.toNumber(), 0);
                done();
            });
        });

        it ("non-minter can't preallocate tokens", (done) => {
            testutils.expectedExceptionPromise( () => {
                return foodToken.preallocateToken.sendTransaction(FOUNDER, FOUNDER_STAKE, {gas: 4000000});
            }, 4000000).then(done);
        });
        
        it ("can't unlock preallocated funds", (done) => {
            testutils.expectedExceptionPromise( () => {
                return foodToken.unlockBalance.sendTransaction(FOUNDER, {gas: 4000000});
            }, 4000000).then(done);
        });

        xit ("can't preallocate above limit");
        xit ("minter preallocate tokens", () => {
            foodToken.preallocateToken.sendTransaction("0x0000000000000000000000000000000000000002", 2000, {gas: 4000000, from: Contribution.address});
        });
    });

    describe('START OF PUBLIC CONTRIBUTION', () => {
        before('Time travel to startTime', (done) => {
            testutils.increaseTime(startTime, done);
        });

        xit('Test buying over limit fails', (done) => {
            let balance;
            foodToken.balanceOf(accounts[0]).then((_balance) => {
                balance = _balance;
            }).then(() => {
                let amount = new BigNumber(10).toPower(18+7);
                return contribution.buy({ from: accounts[1], value: amount});
            }).then(() => {
                return foodToken.balanceOf(accounts[0]);
            }).then((result) => {
                assert.equal(result.toNumber(), balance);
                done();
            });
        });

        it('Test buying in time', (done) => {
            contribution.buy({ from: accounts[0], value: 4000000}).then( () => {
                return foodToken.balanceOf(accounts[0]);
            }).then((balance) => {
                assert.equal(balance.toNumber(), 8800000);
                done();
            });
        });

        it('Test minting liquid token from non-minter fails', (done) => {
            let balance;
            foodToken.balanceOf(accounts[0]).then((_balance) => {
                balance = _balance;
            }).then(() => {
                return foodToken.mintLiquidToken(accounts[1], 1000);
            }).catch(() => {
                return foodToken.balanceOf(accounts[0]);
            }).then((result) => {
                assert.equal(result.toNumber(), balance);
                done();
            });
        });

        it ("test unlocking too early", (done) => {
            let balance;
            foodToken.balanceOf(FOUNDER_STAKE).then((_balance) => {
                balance = _balance;
            }).then(() => {
                return foodToken.unlockBalance(FOUNDER);
            }).catch((reason) => {
                foodToken.balanceOf(FOUNDER_STAKE).then((result) => {
                    assert.equal(result.toNumber(), balance);
                    done();
                });
            });
        });

        it('Test token transfer too early', (done) => {
            foodToken.transfer(accounts[1], 1000, {from: accounts[0]}).catch((r) => {
                return foodToken.balanceOf(accounts[1]).then((result) => {
                    assert.equal(result.toNumber(), 0);
                    done();
                });
            });
        });

        xit('Test token transferFrom too early', (done) => {
        });
    });

    describe('PAST END OF PUBLIC CONTRIBUTION', () => {
        before('Time travel to endTime', (done) => {
            testutils.increaseTime(endTime + 1, done);
        });

        it('Test buying too late', (done) => {
          let balance;
          foodToken.balanceOf(accounts[0]).then((_balance) => {
              balance = _balance;
          }).then( () => {
              return contribution.buy({ from: accounts[0], value: 1000 });
          }).catch(() => {
              return foodToken.balanceOf(accounts[0]);
          }).then((result) => {
              assert.equal(result.toNumber(), balance);
              done();
          });
        });

        xit('Test token transfer in time', (done) => {
        });
        xit('Test token transferFrom in time', (done) => {
        });

    });

    describe('AFTER THAWING PERIOD', () => {
        before('Time travel to endTime', (done) => {
            testutils.increaseTime(endTime + (2 * years * 1.01), done);
        });

        it ("unlock preallocated funds", (done) => {
            foodToken.balanceOf(FOUNDER_STAKE)
              .then((balance) => {
                assert.equal(0, balance);
                return foodToken.unlockBalance(FOUNDER);
            }).then( () => {
                return foodToken.preallocatedBalanceOf(FOUNDER);
            }).then( (balance) => {
                assert.equal(0, balance);
            }).then( () => {
                return foodToken.balanceOf(FOUNDER);
            }).then( (balance) => {
                assert.equal(FOUNDER_STAKE, balance);
            }).then(done);
        });
    });

});