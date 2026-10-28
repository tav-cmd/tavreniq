import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlanKeys} from '../src/builder/keys.js';
import {validatePlan,overwrites} from '../src/builder/plan.js';
import {generatePlan} from '../src/builder/planner.js';
import {PermissionFlagsBits as P} from 'discord.js';
function sample() {
  return {roles:[{key:'STAFF',name:'Staff',color:'#3366ee',permissions:['ManageMessages']}],
    categories:[{key:'STAFF',name:'Community',view:['everyone']},{key:'INFO SPACE',name:'Information',view:['everyone']}],
    channels:[{key:'STAFF',name:'general',category:'STAFF',type:'text',topic:'Chat',view:['everyone'],post:['everyone'],connect:[],slowmode:5},
      {key:'STAFF',name:'general',category:'INFO SPACE',type:'text',topic:'Announcements',view:['everyone'],post:['STAFF'],connect:[],slowmode:0}]};
}
function keys(p) {return [...p.roles,...p.categories,...p.channels].map(x=>x.key);}
function check(p) {const all=keys(p);assert.equal(new Set(all).size,all.length);for(const k of all){assert.match(k,/^[a-z][a-z0-9_]*$/);assert.ok(k.length<=32);assert.notEqual(k,'everyone');}}
test('cross-kind duplicates, uppercase and spaces normalize; all references retain their meaning',()=>{
  const raw=sample(),copy=structuredClone(raw),p=validatePlan(raw);check(p);
  assert.deepEqual(raw,copy,'normalization must not mutate provider data');
  assert.deepEqual(p.roles.map(r=>r.name),raw.roles.map(r=>r.name));
  assert.deepEqual(p.channels.map(c=>c.name),['general','general']);
  assert.equal(p.channels[0].key,'community_general');assert.equal(p.channels[1].key,'information_general');
  assert.equal(p.channels[0].category,p.categories[0].key);assert.equal(p.channels[1].category,p.categories[1].key);
  assert.deepEqual(p.channels[1].post,[p.roles[0].key]);assert.deepEqual(p.roles[0].permissions,raw.roles[0].permissions);
  assert.equal(p.channels[0].slowmode,5);assert.equal(p.channels[1].topic,'Announcements');
  assert.deepEqual(validatePlan(p),p,'preview and execution validation must be idempotent');
});
test('missing keys, numeric-leading names, punctuation, unicode and long collisions allocate unique bounded keys',()=>{
  const p=sample();p.roles=[{name:'99 Moderators',color:'#123456',permissions:[]},{name:'A'.repeat(90)+'B',color:'#123456',permissions:[]},{name:'A'.repeat(90)+'C',color:'#123456',permissions:[]},{name:'🔥',color:'#123456',permissions:[]}];
  p.channels[1].post=['99 Moderators'];p.categories[0].name='99 Community';
  const result=validatePlan(p);check(result);assert.equal(result.roles.length,4);assert.equal(result.channels.length,2);
  assert.deepEqual(result.channels[1].post,[result.roles[0].key]);assert.deepEqual(validatePlan(result),result);
});
test('distinct original category keys survive colliding sanitized display-name slugs',()=>{
  const p=sample();p.categories[0].name='Café';p.categories[1].name='Cafe';
  const result=validatePlan(p);check(result);assert.equal(result.categories[0].key,'cafe');assert.equal(result.categories[1].key,'cafe_2');
  assert.equal(result.channels[1].category,'cafe_2');assert.equal(result.channels[1].key,'cafe_2_general');
});
test('duplicate original keys within one kind can be resolved by unambiguous display-name references',()=>{
  const p=sample();p.roles.push({key:'STAFF',name:'Helpers',color:'#123456',permissions:[]});
  p.categories[1].key='STAFF';p.channels[0].category='Community';p.channels[1].category='Information';
  p.channels[1].post=['Helpers'];
  const result=validatePlan(p);check(result);assert.equal(result.roles.length,2);assert.equal(result.categories.length,2);
  assert.deepEqual(result.channels[1].post,[result.roles[1].key]);
});
test('ambiguous role references fail explicitly rather than changing access or dropping objects',()=>{
  const p=sample();p.roles.push({key:'STAFF',name:'Helpers',color:'#123456',permissions:[]});
  assert.throws(()=>validatePlan(p),/ambiguous role reference/);
  assert.equal(p.roles.length,2);assert.equal(p.channels.length,2);
});
test('unknown references are not silently granted and private visibility remains intact after normalization',()=>{
  const p=sample();p.categories[1].view=['Staff'];p.channels[1].view=['staff'];p.channels[1].post=['STAFF'];
  const result=validatePlan(p),role=result.roles[0].key;
  assert.deepEqual(result.categories[1].view,[role]);assert.deepEqual(result.channels[1].view,[role]);
  const rules=overwrites(result,result.channels[1],'guild','bot',{[role]:'staffid'});
  assert.ok(rules[0].deny.includes(P.ViewChannel));assert.ok(rules.find(r=>r.id==='staffid').allow.includes(P.ViewChannel));
  p.channels[1].post=['Nonexistent'];assert.throws(()=>validatePlan(p),/unknown role reference/);
});
test('all object kinds share one collision registry and display names are not rewritten',()=>{
  const p=sample();p.categories[0].name='Role Staff';p.channels[0].name='role-staff';
  const result=validatePlan(p);check(result);assert.equal(result.roles[0].key,'role_staff');assert.equal(result.categories[0].key,'role_staff_2');
  assert.equal(result.channels[0].name,'role-staff');
});
test('actual Gemini response parser normalizes flawed keys before returning the validated preview plan',async()=>{
  const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
  try{
    const result=await generatePlan('Create a community and information section with general channels',{fetcher:async(url,options)=>{
      const body=JSON.parse(options.body);assert.match(body.systemInstruction.parts[0].text,/community_general/);
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(sample())}]}}]})};
    }});check(result);assert.equal(result.channels.length,2);assert.equal(result.channels[1].key,'information_general');
  }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('normalized keys take precedence over another object’s similar display name on repeated validation',()=>{
  const p=sample();p.categories[0].name='Role Staff';p.categories[1].name='role_staff_2';
  const normalized=validatePlan(p);assert.equal(normalized.categories[0].key,'role_staff_2');
  assert.deepEqual(validatePlan(normalized),normalized);
});
