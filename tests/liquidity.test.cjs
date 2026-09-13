'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decimal, cmp, tokenValue, xrpDrops, buildDeposit, buildWithdrawal } = require('../js/jcs-liquidity.js');
const asset = { currency: 'JCS', issuer: 'rConfiguredIssuer' };
const pool = { account: 'rPool', xrpDrops: '3000000000', jcs: '500000000', totalLP: '1224744.871391589', lpCurrency: '03' + 'A'.repeat(38) };

test('XRP input is exact in drops and rejects extra precision or excessive amounts', () => {
  assert.equal(xrpDrops('1.123456'), '1123456');
  assert.equal(xrpDrops('100000000000'), '100000000000000000');
  for (const invalid of ['0', '-1', '0.0000001', '1e6', 'NaN', 'Infinity', '100000000001']) assert.throws(() => xrpDrops(invalid));
});

test('two-asset deposit caps both inputs and conservatively rounds JCS', () => {
  const add = buildDeposit(pool, '1.123456', asset);
  assert.equal(add.transaction.Amount, '1123456');
  assert.equal(add.transaction.Flags, 1048576);
  assert.equal(add.transaction.TransactionType, 'AMMDeposit');
  assert.deepEqual(add.transaction.Asset2, asset);
  assert.equal(add.transaction.Amount2.value, '187242.666666666');
  assert.equal(add.transaction.Amount2.issuer, asset.issuer);
  assert.ok(cmp(decimal(add.jcs), decimal('187242.66666666666667')) < 0);
  assert.equal(add.transaction.LPTokenOut, undefined);
});

test('100% redemption preserves all 16 significant LP digits and exact asset identity', () => {
  const remove = buildWithdrawal(pool, '1000.123456789123', '100', asset);
  assert.equal(remove.transaction.LPTokenIn.value, '1000.123456789123');
  assert.equal(remove.transaction.Flags, 65536);
  assert.equal(remove.transaction.TransactionType, 'AMMWithdraw');
  assert.equal(remove.transaction.LPTokenIn.issuer, pool.account);
  assert.equal(remove.transaction.LPTokenIn.currency, pool.lpCurrency);
  assert.deepEqual(remove.transaction.Asset2, asset);
  assert.ok(BigInt(remove.xrpDrops) > 0n);
});

test('percentage, wallet balance, pool reserve and dust bounds fail closed', () => {
  assert.throws(() => buildWithdrawal(pool, '0', '100', asset));
  assert.throws(() => buildWithdrawal(pool, '100', '101', asset));
  assert.throws(() => buildWithdrawal(pool, '100', '0.001', asset));
  assert.throws(() => buildWithdrawal(pool, '0.00000000000001', '25', asset));
  assert.throws(() => buildWithdrawal(pool, '9999999999999999', '100', asset));
  assert.throws(() => buildDeposit({ ...pool, jcs: '0' }, '1', asset));
  assert.throws(() => buildDeposit({ ...pool, xrpDrops: '-1' }, '1', asset));
  assert.throws(() => buildDeposit({ ...pool, totalLP: 'not-available' }, '1', asset));
});

test('token conversion never rounds up across tiny and large ledger values', () => {
  assert.equal(tokenValue(decimal('0.000000000000123456789123456789')), '0.000000000000123456789123456');
  assert.equal(tokenValue(decimal('1000000000000000000000000')), '1000000000000000000000000');
  for (const value of ['0.00000000000000000001', '0.00001', '1', '1.2345678901234567', '123456789123456789123456789']) {
    assert.ok(cmp(decimal(tokenValue(decimal(value))), decimal(value)) <= 0);
  }
});
