import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../js/jcs-metrics-ledger.js', import.meta.url), 'utf8');
const {LedgerClient} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const snapshot = {ledger:{index:100,hash:'A'.repeat(64)}};

function fakeClient(responses) {
  const client = new LedgerClient();
  const calls = [];
  client.rpc = async (method, params) => {
    calls.push({method,params});
    const answer = responses.shift();
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return {client,calls};
}

test('initial load reads one page; click continues the same bounded range', async () => {
  const marker = {ledger:80,seq:2};
  const {client,calls} = fakeClient([
    {ledger_index_min:10,ledger_index_max:100,transactions:[{hash:'new'}],marker},
    {ledger_index_min:10,ledger_index_max:100,transactions:[{hash:'old'}]}
  ]);
  const first = await client.scanHistory(snapshot);
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'account_tx');
  assert.equal(calls[0].params.ledger_index_max,100);
  assert.equal(first.complete,false);
  assert.deepEqual(first.entries,[{hash:'new'}]);
  assert.deepEqual(first.cursor.marker,marker);
  const second = await client.scanHistory(snapshot,{cursor:first.cursor});
  assert.equal(calls.length,2);
  assert.equal(calls[1].params.ledger_index_min,10);
  assert.deepEqual(calls[1].params.marker,marker);
  assert.deepEqual(second.entries,[{hash:'old'}]);
  assert.equal(second.complete,true);
  assert.equal(second.cursor,null);
});

test('old cursor cannot be used with a newer ledger', async () => {
  const {client,calls} = fakeClient([{ledger_index_min:10,ledger_index_max:100,transactions:[],marker:'next'}]);
  const first = await client.scanHistory(snapshot);
  await assert.rejects(client.scanHistory({ledger:{index:101,hash:'B'.repeat(64)}},{cursor:first.cursor}),/another validated snapshot/);
  assert.equal(calls.length,1);
});

test('quota failure retains the cursor and reports no new entries', async () => {
  const {client} = fakeClient([
    {ledger_index_min:10,ledger_index_max:100,transactions:[{hash:'new'}],marker:'next'},
    new Error('rate limit: units quota exhausted, retry in ~16555ms')
  ]);
  const first = await client.scanHistory(snapshot);
  const second = await client.scanHistory(snapshot,{cursor:first.cursor});
  assert.equal(second.entries,null);
  assert.deepEqual(second.cursor,first.cursor);
  assert.match(second.error,/retry in ~16555ms/);
});

test('repeated marker and changed range cannot count duplicate or mismatched rows', async () => {
  for (const bad of [
    {ledger_index_min:10,ledger_index_max:100,transactions:[{hash:'bad'}],marker:'next'},
    {ledger_index_min:11,ledger_index_max:100,transactions:[{hash:'bad'}],marker:'other'}
  ]) {
    const {client} = fakeClient([
      {ledger_index_min:10,ledger_index_max:100,transactions:[{hash:'new'}],marker:'next'},
      bad
    ]);
    const first = await client.scanHistory(snapshot);
    const second = await client.scanHistory(snapshot,{cursor:first.cursor});
    assert.equal(second.entries,null);
    assert.deepEqual(second.cursor,first.cursor);
    assert.match(second.error,/marker|coverage/);
  }
});
