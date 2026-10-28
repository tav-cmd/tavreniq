import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EmbedBuilder,ActionRowBuilder,MessageFlags,PermissionFlagsBits as P} from 'discord.js';
import {questions} from '../src/quiz/questions.js';
import {selectQuestions,timerSeconds,rank} from '../src/quiz/core.js';
import {createQuizStore} from '../src/quiz/storage.js';
import {QuizService} from '../src/quiz/service.js';
import {questionView,resultsView,reviewView,leaderboardView} from '../src/quiz/views.js';
import {commands} from '../src/commands.js';

function validate(payload) {
  for(const e of payload.embeds || []) {
    new EmbedBuilder(e).toJSON();
    assert.ok((e.description?.length || 0)<=4096);
    assert.ok((e.title?.length || 0)<=256);
    assert.ok(JSON.stringify(e).length<6000);
  }
  for(const r of payload.components || []) {
    new ActionRowBuilder(r).toJSON();assert.ok(r.components.length<=5);
    for(const b of r.components) assert.ok(b.custom_id.length<=100);
  }
}
function harness(db=new DatabaseSync(':memory:')) {
  const store=createQuizStore(db),timers=new Set(),channels=new Map(),logs=[];
  let time=1000000,msg=0;
  const service=new QuizService(store,{seconds:20,now:()=>time,
    schedule:(fn,delay)=>{const t={fn,delay};timers.add(t);return t;},cancel:t=>timers.delete(t),
    logger:{error:(...args)=>logs.push(args)}});
  function channel(id='c',guild='g') {
    const key=guild+':'+id;if(channels.has(key))return channels.get(key);
    const c={id,guildId:guild,sent:[],isTextBased:()=>true,isThread:()=>false,
      permissionsFor:()=>({has:()=>true}),messages:{fetch:async id=>c.sent.find(m=>m.id===id)},
      send:async payload=>{validate(payload);const m={id:String(++msg),payload:structuredClone(payload),edits:[],
        edit:async next=>{validate(next);m.edits.push(structuredClone(next));m.payload=structuredClone(next);return m;}};
        c.sent.push(m);return m;}};
    channels.set(key,c);return c;
  }
  function interaction({sub='start',count=1,user='100',channelId='c',guildId='g',customId,message,moderator=false,ephemeral=false}={}) {
    const c=channel(channelId,guildId);
    const i={commandName:'quiz',guildId,channelId,channel:c,user:{id:user,username:'User'+user},member:{displayName:'Player'+user},
      guild:{ownerId:'100',members:{fetchMe:async()=>({}),fetch:async()=>({permissions:{has:p=>moderator && p===P.ModerateMembers}})}},
      options:{getSubcommand:()=>sub,getInteger:()=>count},isChatInputCommand:()=>!customId,isButton:()=>!!customId,inGuild:()=>true,
      customId,message:message?{...message,flags:{has:()=>ephemeral}}:null,outputs:[],
      deferReply:async payload=>{i.deferred=true;i.initial=payload;},deferUpdate:async()=>{i.deferred=true;i.updated=true;},
      editReply:async payload=>{validate(payload);i.outputs.push(payload);},reply:async payload=>{i.replied=true;i.initial=payload;i.outputs.push(payload);}};
    return i;
  }
  async function start(count=1,channelId='c',guildId='g') {
    const i=interaction({count,channelId,guildId});await service.handle(i);
    const s=service.sessions.get(service.key(guildId,channelId));assert.ok(s,JSON.stringify(i.outputs));return s;
  }
  async function answer(s,user,choice=s.questions[s.index].answer,extra={}) {
    const i=interaction({user,channelId:s.channel,guildId:s.guild,customId:`tq:a:${s.id}:${s.index}:${choice}`,message:s.message,...extra});
    await service.handle(i);return i;
  }
  async function tick(s) {
    const t=s.timer;assert.ok(timers.has(t));timers.delete(t);time=s.deadline;t.fn();await s.operation;
  }
  return {db,store,service,channels,logs,timers,channel,interaction,start,answer,tick,setTime:t=>{time=t;},close:()=>{service.shutdown();db.close();}};
}

test('bank has exactly 150 unique complete questions across 15 topics, with 4 distinct options and one answer',()=>{
  assert.equal(questions.length,150);assert.equal(new Set(questions.map(q=>q.id)).size,150);
  assert.equal(new Set(questions.map(q=>q.prompt.toLowerCase())).size,150);
  assert.equal(new Set(questions.map(q=>q.category)).size,15);
  assert.deepEqual(new Set(questions.map(q=>q.difficulty)),new Set(['easy','medium','hard']));
  for(const q of questions) {assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.prompt.endsWith('?'));assert.ok(q.options[q.answer]);assert.ok(!/placeholder|TODO/i.test(JSON.stringify(q)));}
});
test('randomization preserves answer identity and unique selection; validation rejects invalid sizes',()=>{
  for(const count of [1,10,50,150]) for(let j=0;j<10;j++) {
    const selected=selectQuestions(count);assert.equal(selected.length,count);assert.equal(new Set(selected.map(q=>q.id)).size,count);
    for(const q of selected) {const source=questions.find(o=>o.id===q.id);assert.equal(q.options[q.answer],source.options[source.answer]);}
  }
  const swapped=selectQuestions(150,()=>0);assert.ok(swapped.some(q=>q.answer!==0));
  for(const n of [0,151,1.5,NaN])assert.throws(()=>selectQuestions(n));
  assert.equal(timerSeconds(),20);assert.equal(timerSeconds('30'),30);for(const n of ['0','121','NaN','2.5'])assert.throws(()=>timerSeconds(n));
});
for(const count of [1,10,50,150]) test(`${count}-question multiplayer quiz advances on timers and persists correct totals`,async()=>{
  const h=harness();try {
    const s=await h.start(count);
    for(let n=0;n<count;n++) {
      assert.equal(s.index,n);
      const before=JSON.stringify(h.channel().sent);
      const [correct,wrong]=await Promise.all([h.answer(s,'200'),h.answer(s,'300',(s.questions[n].answer+1)%4)]);
      assert.equal(correct.initial.flags,MessageFlags.Ephemeral);assert.equal(wrong.initial.flags,MessageFlags.Ephemeral);
      assert.match(correct.outputs[0].content,/Correct!/);assert.match(wrong.outputs[0].content,/Incorrect/);
      assert.equal(JSON.stringify(h.channel().sent),before,'Answer clicks must not change shared messages');
      const duplicate=await h.answer(s,'200');assert.match(duplicate.outputs[0].content,/already answered/);
      if(n===count-1)await h.answer(s,'400');
      await h.tick(s);
    }
    assert.equal(h.service.sessions.size,0);assert.equal(h.timers.size,0);
    const result=h.store.results(s.id);assert.equal(result.session.status,'completed');assert.equal(result.session.played,count);
    const a=result.players.find(r=>r.user==='200'),b=result.players.find(r=>r.user==='300'),late=result.players.find(r=>r.user==='400');
    assert.equal(a.score,count);assert.equal(a.accuracy,100);assert.equal(a.unanswered,0);
    assert.equal(b.score,0);assert.equal(b.incorrect,count);assert.equal(b.accuracy,0);
    assert.equal(late.score,1);assert.equal(late.unanswered,count-1);
    assert.equal(h.store.leaderboard('g').length,3);assert.equal(h.store.leaderboard('other').length,0);
    assert.match(h.channel().sent.at(-1).payload.embeds[0].title,/Completed/);
  } finally {h.close();}
});
test('overlap prevention and simultaneous independent channels and servers',async()=>{
  const h=harness();try {
    const a=h.interaction(),b=h.interaction();await Promise.all([h.service.handle(a),h.service.handle(b)]);
    assert.equal(h.service.sessions.size,1);assert.ok([a,b].some(i=>i.outputs.some(p=>/already active/.test(p.content))));
    await h.start(1,'other');await h.start(1,'c','otherguild');assert.equal(h.service.sessions.size,3);
  } finally {h.close();}
});
test('simultaneous duplicate answers persist exactly once; expiry and forged channel buttons reject',async()=>{
  const h=harness();try {
    const s=await h.start(2);await Promise.all(Array.from({length:20},()=>h.answer(s,'200')));
    assert.equal(h.store.results(s.id).players[0].answered,1);
    const cross=await h.answer(s,'300',0,{channelId:'another'});assert.match(cross.outputs[0].content,/closed/);
    h.setTime(s.deadline);const expired=await h.answer(s,'300');assert.match(expired.outputs[0].content,/closed/);
    const old=s.message,index=s.index;await h.tick(s);
    const stale=h.interaction({customId:`tq:a:${s.id}:${index}:0`,message:old});await h.service.handle(stale);assert.match(stale.outputs[0].content,/closed/);
  } finally {h.close();}
});
test('review is blocked while active; cancelling preserves partial results but not leaderboard points',async()=>{
  const h=harness();try {
    const s=await h.start(10);await h.answer(s,'200');
    const review=h.interaction({customId:`tq:v:${s.id}:0`,message:s.message});await h.service.handle(review);assert.match(review.outputs[0].content,/only after/);
    const forbidden=h.interaction({sub:'stop',user:'500'});await h.service.handle(forbidden);assert.match(forbidden.outputs[0].content,/Only the quiz starter/);
    const stop=h.interaction({sub:'stop'});await h.service.handle(stop);
    assert.equal(h.store.get(s.id).status,'cancelled');assert.equal(h.store.leaderboard('g').length,0);assert.equal(h.timers.size,0);
    const after=h.interaction({customId:`tq:v:${s.id}:0`,message:s.message});await h.service.handle(after);
    assert.equal(after.initial.flags,MessageFlags.Ephemeral);assert.match(after.outputs[0].embeds[0].description,/Correct answer:/);
    assert.doesNotMatch(after.outputs[0].embeds[0].description,/Player200/);
    const next=h.interaction({customId:`tq:r:${s.id}:0`,message:s.message,ephemeral:true});await h.service.handle(next);assert.ok(next.updated);
  } finally {h.close();}
});
test('authorized moderator can cancel another member’s quiz',async()=>{
  const h=harness();try {const s=await h.start(10);const i=h.interaction({sub:'stop',user:'500',moderator:true});await h.service.handle(i);assert.equal(h.store.get(s.id).status,'cancelled');}finally{h.close();}
});
test('completed records and leaderboard survive database reopen; active sessions recover as interrupted',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'tav-quiz-')),file=join(folder,'test.sqlite');
  let h=harness(new DatabaseSync(file));
  try {
    const done=await h.start();await h.answer(done,'200');await h.tick(done);
    const active=await h.start(10);await h.answer(active,'300');h.close();
    h=harness(new DatabaseSync(file));assert.equal(h.store.leaderboard('g')[0].score,1);
    await h.service.recover({channels:{fetch:async id=>h.channel(id)}});
    assert.equal(h.store.get(active.id).status,'interrupted');assert.equal(h.store.results(active.id).players[0].score,1);
    assert.equal(h.store.leaderboard('g').length,1);assert.match(h.channel().sent.at(-1).payload.embeds[0].title,/Interrupted/);
    assert.deepEqual(h.store.recover(),[]);await h.start();
  }finally {h.close();rmSync(folder,{recursive:true,force:true});}
});
test('ties use score then accuracy, share rank, and have stable ID order',()=>{
  const rows=rank([{user:'3',correct:2,answered:4,played:5},{user:'2',correct:2,answered:2,played:5},{user:'1',correct:2,answered:2,played:5}]);
  assert.deepEqual(rows.map(r=>r.user),['1','2','3']);assert.deepEqual(rows.map(r=>r.place),[1,1,3]);
});
test('result and review pagination remain within Discord limits for large sessions',()=>{
  const players=rank(Array.from({length:100},(_,n)=>({user:String(n+1),name:'Name'.repeat(20),correct:100,answered:120,played:150})));
  const s={id:'session',questions:selectQuestions(150),played:150,status:'completed'};
  for(let page=0;page<13;page++){validate(resultsView({session:s,players},page));validate(leaderboardView('g',players,page));}
  for(let page=0;page<150;page++)validate(reviewView(s,page));
  for(let index=0;index<150;index++)validate(questionView({...s,index,seconds:20,deadline:2000000}));
});
test('no-answer quiz completes cleanly without adding leaderboard rows',async()=>{
  const h=harness();try{const s=await h.start();await h.tick(s);assert.equal(h.store.get(s.id).status,'completed');assert.deepEqual(h.store.results(s.id).players,[]);}finally{h.close();}
});
test('send failure terminates a quiz safely, saves partial results, and frees the channel',async()=>{
  const h=harness();try {
    const s=await h.start(2);await h.answer(s,'200');h.channel().send=async()=>{throw Object.assign(new Error('Forbidden'),{code:50013});};
    await h.tick(s);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.store.get(s.id).status,'failed');assert.equal(h.service.sessions.size,0);assert.equal(h.timers.size,0);
    const i=h.interaction({sub:'results'});await h.service.handle(i);assert.match(i.outputs[0].embeds[0].title,/error/);
  } finally {h.close();}
});
test('missing permissions stop startup and release reservations',async()=>{
  const h=harness();try {h.channel().permissionsFor=()=>({has:()=>false});const i=h.interaction();await h.service.handle(i);assert.match(i.outputs[0].content,/Embed Links/);assert.equal(h.service.sessions.size,0);}finally{h.close();}
});
test('quiz registration payload includes required bounded count and all subcommands',()=>{
  const quiz=commands.find(c=>c.name==='quiz');assert.ok(quiz);
  assert.deepEqual(quiz.options.map(o=>o.name),['start','questions','leaderboard','stop','results']);
  const option=quiz.options[0].options[0];assert.equal(option.name,'number_of_questions');assert.equal(option.required,true);assert.equal(option.min_value,1);assert.equal(option.max_value,150);
  for(const name of ['warn','warnings','timeout','ask','forget','role','invite']) assert.ok(commands.some(c=>c.name===name));
});
test('leaderboard aggregates completed games only and keeps servers isolated',async()=>{
  const h=harness();try {
    for(let n=0;n<2;n++){const s=await h.start();await h.answer(s,'200');await h.tick(s);}
    const cancelled=await h.start();await h.answer(cancelled,'200');await h.service.handle(h.interaction({sub:'stop'}));
    const other=await h.start(1,'c','another');await h.answer(other,'200');await h.tick(other);
    const [r]=h.store.leaderboard('g');assert.equal(r.score,2);assert.equal(r.games,2);assert.equal(r.answered,2);
    assert.equal(h.store.leaderboard('another')[0].score,1);
  } finally {h.close();}
});
test('stop during a queued question transition cancels once without an extra live timer',async()=>{
  const h=harness();try {
    const s=await h.start(2);const tick=h.tick(s);
    const stop=h.interaction({sub:'stop'});await Promise.all([tick,h.service.handle(stop)]);
    assert.equal(h.store.get(s.id).status,'cancelled');assert.equal(h.timers.size,0);assert.equal(h.service.sessions.size,0);
    assert.equal(h.channel().sent.filter(m=>m.payload.embeds[0].title.includes('Quiz Cancelled')).length,1);
  } finally {h.close();}
});
test('question edit failure and expired response token do not create phantom points or sessions',async()=>{
  const h=harness();try {
    const s=await h.start(2);
    const i=h.interaction({customId:`tq:a:${s.id}:0:${s.questions[0].answer}`,message:s.message,user:'200'});
    i.deferReply=async()=>{throw Object.assign(new Error('Unknown interaction'),{code:10062});};
    await h.service.handle(i);assert.equal(h.store.results(s.id).players.length,0);
    const original=h.channel().send;h.channel().send=async payload=>{
      const m=await original(payload);
      if(payload.embeds[0].title.includes('Question'))m.edit=async()=>{throw Object.assign(new Error('Missing permissions'),{code:50013});};
      return m;
    };
    await h.tick(s);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.store.get(s.id).status,'failed');assert.equal(h.timers.size,0);
  } finally {h.close();}
});
test('slash quiz start denies non-administrators while everyone can participate',async()=>{
  const h=harness();try {
    const i=h.interaction({user:'500',moderator:true});await h.service.handle(i);
    assert.match(i.outputs[0].content,/Only the server owner or a server administrator/);assert.equal(h.service.sessions.size,0);
    const s=await h.start();const answer=await h.answer(s,'500');assert.match(answer.outputs[0].content,/Correct!/);
  } finally {h.close();}
});
