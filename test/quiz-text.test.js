import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits as P} from 'discord.js';
import {QuizText,parseQuizStart,requireQuizAdmin} from '../src/quiz/text.js';
import {isOwnerQuestion,ownerReply} from '../src/owner.js';

test('natural quiz phrases parse with optional counts and polite variants',()=>{
  for(const text of ['start a quiz 2 questions','begin a quiz with 2 questions','quiz start 2','please start a quiz 2 questions','can you start a quiz 2 questions please'])
    assert.equal(parseQuizStart(text).count,2,text);
  assert.equal(parseQuizStart('start a quiz').count,null);
  assert.equal(parseQuizStart('what is a quiz'),null);
  assert.ok(Number.isNaN(parseQuizStart('start a quiz twenty questions').count));
});
test('only server owner or Administrator can start, not ordinary moderators or Manage Server',async()=>{
  const guild={ownerId:'1',members:{fetch:async()=>{throw Error('Owner should not need lookup');}}};
  await requireQuizAdmin(guild,'1');
  for(const role of [P.ManageGuild,P.ModerateMembers,0n]) {
    guild.members.fetch=async()=>({permissions:{has:p=>p===role}});
    await assert.rejects(requireQuizAdmin(guild,'2'),/Only the server owner/);
  }
  guild.members.fetch=async opts=>{assert.equal(opts.force,true);return {permissions:{has:p=>p===P.Administrator}};};
  await requireQuizAdmin(guild,'2');
});
test('follow-up is scoped, expires and rechecks permissions before starting',async()=>{
  let clock=0,admin=true;const starts=[],replies=[];
  const quiz={sessions:new Map(),key:(g,c)=>g+':'+c,start:async i=>{await requireQuizAdmin(i.guild,i.user.id);starts.push(i.options.getInteger());}};
  const text=new QuizText(quiz,{now:()=>clock});
  const guild={id:'g',ownerId:'owner',members:{fetch:async()=>({permissions:{has:()=>admin}})}};
  const m={guild,channel:{id:'c'},author:{id:'2'},reply:async payload=>replies.push(payload)};
  await text.handle(m,'start a quiz');assert.match(replies.at(-1).content,/How many/);
  assert.equal(await text.handle({...m,author:{id:'3'}},'2',{addressed:false}),false);
  assert.equal(await text.handle({...m,channel:{id:'other'}},'2',{addressed:false}),false);
  assert.equal(await text.handle(m,'who is your owner'),false);
  await text.handle(m,'151',{addressed:false});assert.equal(starts.length,0);
  admin=false;await text.handle(m,'2',{addressed:false});assert.equal(starts.length,0);assert.equal(text.hasPending(m),false);
  admin=true;await text.handle(m,'start a quiz');await text.handle(m,'2 questions',{addressed:false});assert.deepEqual(starts,[2]);
  await text.handle(m,'start a quiz');clock=120001;assert.equal(await text.handle(m,'3',{addressed:false}),false);
  await text.handle(m,'start a quiz');await text.handle(m,'cancel',{addressed:false});assert.equal(text.hasPending(m),false);
});
test('owner question wording avoids confusing server owner with bot owner',()=>{
  for(const text of ['who is ur owner?','who is your owner','who owns you','who made you?','who created you','who’s your developer?'])assert.ok(isOwnerQuestion(text),text);
  for(const text of ['who owns this server?','who is the server owner?','who owns Marlow?'])assert.equal(isOwnerQuestion(text),false,text);
});
test('owner mentions only the configured present member; absent and unknown owners produce no ping',async()=>{
  const id='123456789012345678';
  const guild={members:{fetch:async opts=>{assert.equal(opts.user,id);assert.equal(opts.force,true);return {id};}}};
  const result=await ownerReply(guild,{id,name:'Raymon'});assert.equal(result.content,`My owner is <@${id}>.`);assert.deepEqual(result.allowedMentions.users,[id]);
  guild.members.fetch=async()=>{throw {code:10007};};
  const absent=await ownerReply(guild,{id,name:'Raymon'});assert.match(absent.content,/aren’t in/);assert.deepEqual(absent.allowedMentions.parse,[]);assert.equal(absent.allowedMentions.users,undefined);
  const missing=await ownerReply(guild,{id:'',name:'Raymon'});assert.match(missing.content,/hasn’t been configured/);
  guild.members.fetch=async()=>{throw {code:50001};};assert.match((await ownerReply(guild,{id})).content,/couldn’t verify/);
});
