import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PermissionFlagsBits as P,PermissionsBitField} from 'discord.js';
const dir=mkdtempSync(join(tmpdir(),'tavreniq-test-'));
process.env.DATA_DIR=dir;
const {moderate}=await import('../src/moderation.js');
const {close,warnings}=await import('../src/store.js');
let calls=0;
const member=(id,rank,perms)=>({id,user:{tag:id},permissions:new PermissionsBitField(perms),roles:{highest:{position:rank}},moderatable:true,timeout:async()=>{calls++;}});
const actor=member('actor',5,[P.ModerateMembers]);
const bot=member('bot',10,[P.ModerateMembers]);
const target=member('target',2,[]);
const guild={id:'guild',ownerId:'owner',members:{fetch:async({user})=>user==='actor'?actor:target,fetchMe:async()=>bot}};
test('unauthorized executor never invokes moderation',async()=>{
 actor.permissions=new PermissionsBitField();
 await assert.rejects(moderate(guild,{},'actor',{action:'timeout',userId:'target',duration:'1m'}),/permission/);
 assert.equal(calls,0);
 actor.permissions=new PermissionsBitField(P.ModerateMembers);
});
test('bot permission failure never invokes moderation',async()=>{
 bot.permissions=new PermissionsBitField();
 await assert.rejects(moderate(guild,{},'actor',{action:'timeout',userId:'target',duration:'1m'}),/permission/);
 assert.equal(calls,0);
 bot.permissions=new PermissionsBitField(P.ModerateMembers);
});
test('equal role target blocked, lower role succeeds',async()=>{
 target.roles.highest.position=5;
 await assert.rejects(moderate(guild,{},'actor',{action:'timeout',userId:'target',duration:'1m'}),/equal or higher/);
 assert.equal(calls,0);
 target.roles.highest.position=2;
 await moderate(guild,{},'actor',{action:'timeout',userId:'target',duration:'1m'});
 assert.equal(calls,1);
});
test('warning data is scoped to the server',async()=>{
 await moderate(guild,{},'actor',{action:'warn',userId:'target',reason:'Test warning'});
 assert.equal(warnings('guild','target').length,1);
 assert.equal(warnings('other-guild','target').length,0);
});
test.after(()=>{close();rmSync(dir,{recursive:true,force:true});});
