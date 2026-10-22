import test from 'node:test';
import assert from 'node:assert/strict';
import {duration,hierarchy,parseAction} from '../src/policy.js';
import {commands} from '../src/commands.js';
const normal={actorId:'a',targetId:'t',ownerId:'o',botId:'b',actorRank:8,targetRank:2,botRank:9};
test('timeouts validate range and units',()=>{
 assert.equal(duration('10m'),600000);assert.equal(duration('28d'),2419200000);
 for(const value of ['0m','29d','-1h','2years','Infinityd']) assert.throws(()=>duration(value));
});
test('hierarchy protects owner, self, bot, and equal/higher ranks',()=>{
 assert.doesNotThrow(()=>hierarchy(normal));
 for(const targetId of ['a','o','b']) assert.throws(()=>hierarchy({...normal,targetId}));
 assert.throws(()=>hierarchy({...normal,targetRank:8}));
 assert.throws(()=>hierarchy({...normal,botRank:2}));
 assert.doesNotThrow(()=>hierarchy({...normal,actorId:'o',actorRank:1}));
 assert.throws(()=>hierarchy({...normal,actorId:'o',botRank:1}));
});
test('text commands require exact target mentions and valid durations',()=>{
 assert.deepEqual(parseAction('timeout <@123456789012345678> 10m spam'),{action:'timeout',userId:'123456789012345678',duration:'10m',reason:'spam'});
 assert.equal(parseAction('please ban everybody'),null);
 assert.equal(parseAction('ban Raymon'),null);
 assert.throws(()=>parseAction('timeout <@123456789012345678> 40d'));
});
test('command definitions are unique and required options precede optional',()=>{
 assert.equal(new Set(commands.map(c=>c.name)).size,commands.length);
 for(const c of commands) {
  let optional=false;
  for(const o of c.options||[]) {if(!o.required) optional=true;else assert.equal(optional,false,c.name);}
 }
});
