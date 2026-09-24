import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ GAME_ASSETS: { upgradeUi: 'ui', upgradeBase: 'base' } });
const source = readFileSync('src/upgrade-assets.ts','utf8').replace(/^import.*;\r?\n/gm,'').replace('export function','function');
vm.runInContext(ts.transpile(source,{target:ts.ScriptTarget.ES2022}),context);
const create = context.createUpgradeAssetLoader;
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const ui=deferred(),base=deferred();
const calls=[];
const get=create(path=>{calls.push(path);return path==='ui'?ui.promise:base.promise;});
const first=get();
assert.equal(first,get(), 'Concurrent callers must receive the same Promise');
ui.resolve({id:'ui'}); base.resolve({id:'base'});
assert.equal((await first).base.id,'base');
assert.equal(first,get(), 'Fulfilled promise remains cached');
assert.deepEqual(calls,['ui','base']);

const pendingUi=deferred(),failedBase=deferred();
const retryCalls=[];
let baseAttempt=0;
const retry=create(path=>{
  retryCalls.push(path);
  return path==='ui'?pendingUi.promise:++baseAttempt===1?failedBase.promise:Promise.resolve({id:'base-retry'});
});
const failed=retry();
failedBase.reject(new Error('simulated network failure'));
await assert.rejects(failed,/simulated/);
const recovered=retry();
assert.equal(recovered,retry());
pendingUi.resolve({id:'ui'});
assert.equal((await recovered).base.id,'base-retry');
assert.deepEqual(retryCalls,['ui','base','base'], 'In-flight/successful UI cannot be downloaded again');
console.log('PASS: shared promise, caching, failure/retry, no duplicate successful or pending requests.');
