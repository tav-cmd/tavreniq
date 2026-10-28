import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PermissionsBitField,PermissionFlagsBits as P,MessageFlags,EmbedBuilder,ActionRowBuilder} from 'discord.js';
import {EconomyStore} from '../src/economy/store.js';
import {EconomyService,requireEconomyAdmin} from '../src/economy/service.js';
import {MAX_MONEY,dayKey,validateSection} from '../src/economy/config.js';
import {bankView,configHome,sectionView,configModal,jobModal,itemModal,listView} from '../src/economy/views.js';
import {createQuizStore} from '../src/quiz/storage.js';
import {commands} from '../src/commands.js';
function harness(db=new DatabaseSync(':memory:')) {
 let clock=Date.UTC(2026,9,28,10),seq=0;const store=new EconomyStore(db,{now:()=>clock,draw:(min,max)=>min});
 const id=()=>String(++seq),set=(u,account,amount,g='g')=>store.setBalance(id(),g,'admin',u,account,amount);
 return {db,s:store,id,set,tick:ms=>{clock+=ms;},now:()=>clock,close:()=>db.close()};
}
function total(h,g='g') {return h.db.prepare('SELECT SUM(wallet+bank) AS n FROM econ_accounts WHERE guild=?').get(g).n||0;}
test('economies, currencies, shop and balances are independent per server',()=>{
 const h=harness();try{assert.deepEqual(h.s.config('g').currency,{name:'dollar',emoji:'💵'});h.set('1','wallet',1000);assert.equal(h.s.account('other','1').wallet,0);
 h.s.configure(h.id(),'g','admin','currency',{name:'credit',emoji:'⭐'});assert.equal(h.s.config('other').currency.name,'dollar');assert.equal(h.s.config('g').currency.name,'credit');
 h.s.saveJob(h.id(),'g','admin',{id:'driver',name:'Driver',min:10,max:50,cooldown:100,enabled:true});assert.ok(!h.s.jobs('other').some(j=>j.id==='driver'));
 }finally{h.close();}
});
test('deposit, withdrawal, balance setting and repeated requests are atomic',()=>{
 const h=harness();try{h.set('1','wallet',1000);const op=h.id();h.s.move(op,'g','1',600,true);h.s.move(op,'g','1',600,true);assert.equal(h.s.account('g','1').wallet,400);assert.equal(h.s.account('g','1').bank,600);
 assert.throws(()=>h.s.move(h.id(),'g','1',601,false));assert.equal(total(h),1000);
 for(const amount of [-1,1.5,NaN,MAX_MONEY+1])assert.throws(()=>h.s.move(h.id(),'g','1',amount,true));
 assert.equal(h.s.logs('g').length,1);assert.equal(h.s.transactions('g','1').length,2);
 }finally{h.close();}
});
test('payments require confirmation and cannot be paid twice, cross-server, after expiry or by another user',()=>{
 const h=harness();try{h.set('1','wallet',1000);const p=h.s.payment('g','1','2',300);assert.equal(h.s.account('g','1').wallet,1000);
 assert.throws(()=>h.s.confirmPay(h.id(),'g','3',p.id,true));assert.throws(()=>h.s.confirmPay(h.id(),'other','1',p.id,true));
 h.s.confirmPay(h.id(),'g','1',p.id,true);assert.equal(h.s.account('g','2').wallet,300);assert.throws(()=>h.s.confirmPay(h.id(),'g','1',p.id,true));assert.equal(total(h),1000);
 const expired=h.s.payment('g','1','2',100);h.tick(120001);assert.throws(()=>h.s.confirmPay(h.id(),'g','1',expired.id,true));
 const cancelled=h.s.payment('g','1','2',100);h.s.confirmPay(h.id(),'g','1',cancelled.id,false);assert.equal(total(h),1000);
 }finally{h.close();}
});
test('recipient cap rolls a payment back rather than destroying sender money',()=>{
 const h=harness();try{h.set('1','wallet',1000);h.set('2','wallet',MAX_MONEY);const p=h.s.payment('g','1','2',10);assert.throws(()=>h.s.confirmPay(h.id(),'g','1',p.id,true));assert.equal(h.s.account('g','1').wallet,1000);}finally{h.close();}
});
test('daily streak, job cooldowns, daily caps and Africa/Lagos reset work',()=>{
 const h=harness();try{const op=h.id(),r=h.s.daily(op,'g','1');assert.equal(r.paid,250);assert.deepEqual(h.s.daily(op,'g','1'),r);assert.throws(()=>h.s.daily(h.id(),'g','1'));
 h.tick(86400000);assert.equal(h.s.daily(h.id(),'g','1').paid,275);
 h.s.configure(h.id(),'g','admin','limits',{daily:300,quiz:200});const work=h.s.work(h.id(),'g','1','courier');assert.equal(work.paid,25);assert.throws(()=>h.s.work(h.id(),'g','1','developer'));
 h.tick(86400000);assert.equal(h.s.work(h.id(),'g','1','courier').paid,50);
 assert.equal(dayKey(Date.UTC(2026,9,28,23,0,0)),'2026-10-29');
 }finally{h.close();}
});
test('crime succeeds or fines exactly once and respects funds',()=>{
 const h=harness();try{h.set('1','wallet',1000);assert.equal(h.s.crime(h.id(),'g','1').success,true);h.tick(3600001);h.s.draw=(min,max)=>max-1;const r=h.s.crime(h.id(),'g','1');assert.deepEqual(r,{success:false,amount:100});assert.equal(h.s.account('g','1').wallet,1000);
 assert.throws(()=>h.s.crime(h.id(),'g','2'));}finally{h.close();}
});
test('shop purchases are atomic, guard cap is five across custom items, boosts consume one item',()=>{
 const h=harness();try{h.set('1','wallet',10000);h.s.buy(h.id(),'g','1','security_guard',5);assert.equal(h.s.guards('g','1'),5);assert.throws(()=>h.s.buy(h.id(),'g','1','security_guard',1));
 h.s.saveItem(h.id(),'g','admin',{id:'custom_guard',name:'Guardian',emoji:'🛡️',description:'Another guard',price:1,effect:'guard',value:0,enabled:true});assert.throws(()=>h.s.buy(h.id(),'g','1','custom_guard',1));
 const op=h.id();h.s.buy(op,'g','1','double_shift',1);h.s.buy(op,'g','1','double_shift',1);assert.equal(h.s.inventory('g','1').find(i=>i.id==='double_shift').quantity,1);
 h.s.use(h.id(),'g','1','double_shift');assert.equal(h.s.work(h.id(),'g','1','courier').paid,100);assert.equal(h.s.account('g','1').boost,0);assert.throws(()=>h.s.use(h.id(),'g','1','double_shift'));
 assert.throws(()=>h.s.use(h.id(),'g','1','security_guard'));
 const before=h.s.account('g','2').wallet;assert.throws(()=>h.s.buy(h.id(),'g','2','golden_ticket',1));assert.equal(h.s.account('g','2').wallet,before);assert.equal(h.s.inventory('g','2').length,0);
 }finally{h.close();}
});
test('owned item effects cannot silently change, off-sale items remain usable',()=>{
 const h=harness();try{h.set('1','wallet',1000);h.s.buy(h.id(),'g','1','double_shift',1);const item=h.s.items('g').find(i=>i.id==='double_shift');assert.throws(()=>h.s.saveItem(h.id(),'g','admin',{...item,value:300}));
 h.s.saveItem(h.id(),'g','admin',{...item,enabled:false});assert.throws(()=>h.s.buy(h.id(),'g','1','double_shift',1));assert.equal(h.s.use(h.id(),'g','1','double_shift').boost,100);
 }finally{h.close();}
});
test('wallet guard consumes one, transfers attacker fine, then unguarded robbery steals configured percentage',()=>{
 const h=harness();try{h.set('1','wallet',1000);h.set('2','wallet',5000);h.s.buy(h.id(),'g','2','security_guard',1);const before=total(h),r=h.s.robWallet(h.id(),'g','1','2');assert.deepEqual(r,{success:false,amount:100,guards:0});assert.equal(total(h),before);assert.equal(h.s.account('g','1').wallet,900);
 assert.throws(()=>h.s.robWallet(h.id(),'g','1','2'));h.tick(3600001);assert.equal(h.s.robWallet(h.id(),'g','1','2').amount,230);assert.equal(total(h),before);
 }finally{h.close();}
});
test('bank party is capped at ten, fines reserved, and withdrawal or admin set cannot spend held money',()=>{
 const h=harness();try{h.set('victim','bank',10000);for(let n=1;n<=11;n++)h.set(String(n),'bank',1000);const r=h.s.startBank(h.id(),'g','c','1','victim');assert.equal(r.hold,200);
 for(let n=2;n<=10;n++)h.s.joinBank(h.id(),'g',String(n),r.id);assert.throws(()=>h.s.joinBank(h.id(),'g','11',r.id));assert.equal(h.s.robbery(r.id).crew.length,10);
 assert.throws(()=>h.s.move(h.id(),'g','1',801,false));assert.throws(()=>h.set('1','bank',199));h.s.move(h.id(),'g','1',800,false);assert.equal(h.s.account('g','1').bank,200);
 assert.throws(()=>h.s.startBank(h.id(),'g','c','2','victim'));assert.throws(()=>h.s.joinBank(h.id(),'g','1',r.id));assert.throws(()=>h.s.joinBank(h.id(),'g','victim',r.id));
 }finally{h.close();}
});
test('panic is private, target-only, and collects each starting-bank fine after 30 seconds',()=>{
 const h=harness();try{h.set('1','bank',1000);h.set('2','bank',2000);h.set('victim','bank',10000);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.s.joinBank(h.id(),'g','2',id);
 const before=JSON.stringify(bankView(h.s.robbery(id),h.s.config('g')));assert.throws(()=>h.s.panic(h.id(),'g','1',id));assert.throws(()=>h.s.panic(h.id(),'another','victim',id));h.s.panic(h.id(),'g','victim',id);
 assert.equal(JSON.stringify(bankView(h.s.robbery(id),h.s.config('g'))),before);assert.equal(h.s.settleBank(id).status,'pending');
 h.s.move(h.id(),'g','1',800,false);h.tick(30000);const done=h.s.settleBank(id);assert.equal(done.result.total,600);assert.equal(done.result.success,false);assert.equal(h.s.account('g','victim').bank,10600);assert.equal(h.s.account('g','1').bank,0);assert.equal(h.s.account('g','1').hold,0);assert.equal(h.s.account('g','2').bank,1600);
 h.s.settleBank(id);assert.equal(h.s.account('g','victim').bank,10600);assert.equal(total(h),13000);
 }finally{h.close();}
});
test('no panic always succeeds, shares only one 10–30% total, and distributes rounding deterministically',()=>{
 const h=harness();try{h.set('1','bank',1000);h.set('2','bank',1000);h.set('3','bank',1000);h.set('victim','bank',10010);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.s.joinBank(h.id(),'g','2',id);h.s.joinBank(h.id(),'g','3',id);h.tick(30000);const r=h.s.settleBank(id);
 assert.equal(r.result.success,true);assert.equal(r.result.rate,10);assert.equal(r.result.total,1001);assert.deepEqual(r.result.shares.map(s=>s.amount),[334,334,333]);assert.equal(total(h),13010);assert.equal(h.s.account('g','1').hold,0);assert.throws(()=>h.s.joinBank(h.id(),'g','4',id));assert.throws(()=>h.s.panic(h.id(),'g','victim',id));
 }finally{h.close();}
});
test('a member can only be involved in one active bank robbery, and cancellation refunds holds and cooldown',()=>{
 const h=harness();try{for(const u of ['1','2','3'])h.set(u,'bank',1000);const id=h.s.startBank(h.id(),'g','c','1','2').id;assert.throws(()=>h.s.startBank(h.id(),'g','c','1','3'));assert.throws(()=>h.s.startBank(h.id(),'g','c','3','1'));
 h.s.cancelBank(id,'test');assert.equal(h.s.account('g','1').hold,0);assert.equal(total(h),3000);h.s.startBank(h.id(),'g','c','1','3');
 }finally{h.close();}
});
test('settlement balance overflow cancels atomically without taking any fine',()=>{
 const h=harness();try{h.set('1','bank',1000);h.set('victim','bank',MAX_MONEY);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.s.panic(h.id(),'g','victim',id);h.tick(30000);assert.equal(h.s.settleBank(id).status,'cancelled');assert.equal(h.s.account('g','1').bank,1000);assert.equal(h.s.account('g','1').hold,0);}finally{h.close();}
});
test('quiz rewards are atomic, exactly once, capped, scoped, and excluded for cancellations',()=>{
 const h=harness();try{
 const q=createQuizStore(h.db,{economy:h.s});let seq=0;
 const game=(status='completed',players=3)=>{const id='quiz'+(++seq);q.start({id,guild:'g',channel:'c',starter:'1',questions:[{},{}],seconds:20});q.progress(id,2,'m');for(let n=1;n<=players;n++){q.answer(id,0,String(n),'P'+n,0,true);q.answer(id,1,String(n),'P'+n,0,n===1);}q.finish(id,status);return id;};
 const id=game();assert.equal(h.s.account('g','1').wallet,170);assert.equal(h.s.account('g','2').wallet,110);assert.equal(h.s.account('g','3').wallet,110);q.finish(id,'completed');assert.equal(h.s.account('g','1').wallet,170);assert.equal(q.results(id).players[0].earnings,170);
 const before=total(h);game('cancelled');assert.equal(total(h),before);
 game('completed',1);assert.equal(h.s.account('g','1').wallet,190,'solo gets answer rewards but no podium');
 h.s.configure(h.id(),'g','admin','limits',{daily:200,quiz:200});game();assert.equal(h.s.account('g','1').wallet,200);assert.equal(h.s.account('other','1').wallet,0);
 }finally{h.close();}
});
test('quiz settings snapshot and failed payout transaction cannot partially complete a quiz',()=>{
 const h=harness();try{const q=createQuizStore(h.db,{economy:h.s});q.start({id:'q',guild:'g',channel:'c',starter:'1',questions:[{}],seconds:20});q.progress('q',1,'m');q.answer('q',0,'1','P',0,true);
 h.s.configure(h.id(),'g','admin','quiz',{correct:100,first:0,second:0,third:0,minPlayers:3});
 const original=h.s.mint.bind(h.s);h.s.mint=()=>{throw Error('simulated storage failure');};assert.throws(()=>q.finish('q','completed'));assert.equal(q.get('q').status,'active');assert.equal(h.s.quizRewards('q').length,0);
 h.s.mint=original;q.finish('q','completed');assert.equal(h.s.account('g','1').wallet,10);
 }finally{h.close();}
});
test('balances, inventory, cooldowns and robbery holds persist across reopen; restart releases holds',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'tav-econ-')),file=join(folder,'db.sqlite');let h=harness(new DatabaseSync(file));try{
 h.set('1','wallet',1000);h.set('1','bank',1000);h.set('victim','bank',5000);h.s.buy(h.id(),'g','1','security_guard',1);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.close();
 h=harness(new DatabaseSync(file));assert.equal(h.s.account('g','1').hold,200);assert.equal(h.s.guards('g','1'),1);assert.equal(h.s.account('g','1').wallet,500);
 const service=new EconomyService(h.s,{logger:{error:()=>{}}});await service.recover({channels:{fetch:async()=>null}});assert.equal(h.s.account('g','1').hold,0);assert.equal(h.s.robbery(id).status,'cancelled');assert.equal(h.s.account('g','1').bank,1000);
 }finally{h.close();rmSync(folder,{recursive:true,force:true});}
});
test('configuration validates ranges and rejects non-integers',()=>{
 assert.throws(()=>validateSection('bank',{cooldown:20,minPercent:40,maxPercent:10,finePercent:20,minimum:10}));
 assert.throws(()=>validateSection('currency',{name:'',emoji:'💵'}));
 assert.throws(()=>validateSection('limits',{daily:1.5,quiz:20}));
});
function uiHarness(h,opts={}) {
 let seq=100;const changes=[],timers=[];const member={id:'1',user:{bot:false},permissions:new PermissionsBitField(0n)};
 const guild={id:'g',ownerId:'owner',fetch:async()=>guild,members:{fetch:async()=>member,fetchMe:async()=>({id:'bot'})}};
 const channel={id:'c',guildId:'g',guild,permissionsFor:()=>new PermissionsBitField(P.Administrator),send:async p=>({id:'m',edit:async p=>changes.push(p)}),messages:{fetch:async()=>({id:'m',edit:async p=>changes.push(p)})}};
 const client={channels:{fetch:async()=>channel}};
 const service=new EconomyService(h.s,{schedule:(fn,delay)=>{const t={fn,delay};timers.push(t);return t;},cancel:()=>{},logger:{error:()=>{}}});
 function interaction({user='owner',command='economy',action,id,modal=false,select=false,values=[],form={},sub='config',target='victim',amount=100,account='wallet'}={}) {
  const component=!!action,i={id:'ui'+(++seq),guildId:'g',channelId:'c',guild,channel,client,user:{id:user},memberPermissions:member.permissions,commandName:command,
   customId:component?`ec:${action}:${id}`:undefined,message:{id:'m',edit:async p=>changes.push(p)},values,
   isChatInputCommand:()=>!component,isAutocomplete:()=>false,isButton:()=>component&&!modal&&!select,isStringSelectMenu:()=>select,isModalSubmit:()=>modal,inGuild:()=>true,
   options:{getSubcommand:()=>sub,getUser:()=>({id:target,bot:false}),getInteger:k=>k==='amount'?amount:1,getString:k=>k==='account'?account:null},fields:{getTextInputValue:k=>form[k]},
   outputs:[],deferReply:async p=>{i.deferred=true;i.initial=p;},editReply:async p=>i.outputs.push(p),reply:async p=>{i.outputs.push(p);},showModal:async p=>{i.modal=p;}};return i;
 }
 return {service,interaction,changes,guild,member,channel,client,timers};
}
test('runtime config and set-balance permission checks reject ordinary members and revoked administrators',async()=>{
 const h=harness();try{const ui=uiHarness(h);
 let i=ui.interaction({user:'regular'});await ui.service.handle(i);assert.match(i.outputs.at(-1).content,/Only this server/);
 i=ui.interaction({user:'regular',command:'set',sub:'balance'});await ui.service.handle(i);assert.equal(h.s.account('g','1').wallet,0);
 i=ui.interaction({action:'save',id:'regular:currency',user:'regular',modal:true,form:{name:'Fake',emoji:'x'}});await ui.service.handle(i);assert.equal(h.s.config('g').currency.name,'dollar');
 i=ui.interaction({action:'save',id:'owner:currency',modal:true,form:{name:'credit',emoji:'⭐'}});await ui.service.handle(i);assert.equal(h.s.config('g').currency.name,'credit');
 }finally{h.close();}
});
test('panic interaction is ephemeral and never edits shared messages; joins work after panic',async()=>{
 const h=harness();try{const ui=uiHarness(h);for(const u of ['1','2','victim'])h.set(u,'bank',1000);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.s.setMessage(id,'m');
 const i=ui.interaction({action:'panic',id:`bank:${id}`,user:'victim'});await ui.service.handle(i);assert.equal(i.outputs[0].flags,MessageFlags.Ephemeral);assert.match(i.outputs[0].content,/privately/);assert.equal(ui.changes.length,0);
 const j=ui.interaction({action:'join',id:`bank:${id}`,user:'2'});await ui.service.handle(j);assert.equal(h.s.robbery(id).crew.length,2);assert.ok(!JSON.stringify(ui.changes).includes('activated'));
 h.tick(30000);await ui.service.finishBank(ui.client,id);assert.equal(h.s.robbery(id).result.success,false);
 }finally{h.close();}
});
test('bank timer arms for 30 seconds and resolves once; deleted robbery message cancels safely',async()=>{
 const h=harness();try{const ui=uiHarness(h);h.set('1','bank',1000);h.set('victim','bank',1000);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.s.setMessage(id,'m');ui.service.arm(ui.client,id);assert.equal(ui.timers[0].delay,30000);
 ui.channel.messages.fetch=async()=>{throw Error('deleted');};h.tick(30000);await ui.service.finishBank(ui.client,id);assert.equal(h.s.robbery(id).status,'cancelled');assert.equal(h.s.account('g','1').hold,0);
 }finally{h.close();}
});
test('menus, modals and pagination produce valid Discord payloads; commands preserve existing features',()=>{
 const h=harness();try{
 const c=h.s.config('g'),views=[configHome('1'),sectionView('1','bank',c),listView(h.s,'g','1','shop'),listView(h.s,'g','1','jobconfig')];
 for(const v of views){for(const e of v.embeds)new EmbedBuilder(e).toJSON();for(const r of v.components)new ActionRowBuilder(r).toJSON();}
 for(const m of [configModal('1','bank',c),jobModal('1'),itemModal('1',null,'boost')]){assert.ok(m.components.length<=5);assert.ok(m.custom_id.length<=100);for(const r of m.components)new ActionRowBuilder(r).toJSON();}
 const names=commands.map(c=>c.name);assert.equal(new Set(names).size,names.length);for(const n of ['ask','quiz','create','balance','economy','set','rob','inventory','pay'])assert.ok(names.includes(n));
 assert.equal(commands.find(c=>c.name==='economy').options[0].name,'config');assert.equal(commands.find(c=>c.name==='set').default_member_permissions,P.Administrator.toString());
 }finally{h.close();}
});
test('ten robbers each pay the reserved percentage of their own bank, not a shared fine',()=>{
 const h=harness();try{h.set('victim','bank',50000);for(let n=1;n<=10;n++)h.set(String(n),'bank',n*1000);const id=h.s.startBank(h.id(),'g','c','1','victim').id;
 for(let n=2;n<=10;n++)h.s.joinBank(h.id(),'g',String(n),id);h.s.panic(h.id(),'g','victim',id);h.tick(30000);const r=h.s.settleBank(id);assert.equal(r.result.total,11000);assert.equal(h.s.account('g','victim').bank,61000);
 for(let n=1;n<=10;n++)assert.equal(h.s.account('g',String(n)).bank,n*800);assert.equal(total(h),105000);
 }finally{h.close();}
});
test('custom shop item and job configuration forms persist valid server settings',async()=>{
 const h=harness();try{const ui=uiHarness(h);
 const job=ui.interaction({action:'jobform',id:'owner:new',modal:true,form:{id:'chef',name:'Chef',pay:'100,200',cooldown:'60',enabled:'yes'}});await ui.service.handle(job);assert.equal(h.s.jobs('g').find(j=>j.id==='chef').cooldown,60);
 const item=ui.interaction({action:'itemform',id:'owner:new:boost',modal:true,form:{name:'Double Shift Custom',emoji:'⚡',price:'50',value:'150',description:'Next work bonus'}});await ui.service.handle(item);assert.equal(h.s.items('g').find(i=>i.name==='Double Shift Custom').value,150);
 const other=ui.interaction({action:'save',id:'someone_else:currency',user:'owner',modal:true,form:{name:'Bad',emoji:'x'}});await ui.service.handle(other);assert.equal(h.s.config('g').currency.name,'dollar');
 }finally{h.close();}
});
test('panic at the end of the countdown is recorded before any network acknowledgement',async()=>{
 const h=harness();try{const ui=uiHarness(h);h.set('1','bank',1000);h.set('victim','bank',1000);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.s.setMessage(id,'m');h.tick(29999);
 const i=ui.interaction({action:'panic',id:`bank:${id}`,user:'victim'});i.reply=async p=>{assert.equal(h.s.robbery(id).panic,1);h.tick(100);i.outputs.push(p);};await ui.service.handle(i);assert.equal(h.s.settleBank(id).result.success,false);assert.equal(ui.changes.length,0);
 }finally{h.close();}
});
test('finished robbery reports retry after restart without replaying money transfers',async()=>{
 const h=harness();try{const ui=uiHarness(h);h.set('1','bank',1000);h.set('victim','bank',1000);const id=h.s.startBank(h.id(),'g','c','1','victim').id;h.s.setMessage(id,'m');h.tick(30000);h.s.settleBank(id);assert.equal(h.s.account('g','1').bank,1100);
 await ui.service.recover(ui.client);assert.equal(h.s.robbery(id).notified,1);assert.equal(h.s.account('g','1').bank,1100);const n=ui.changes.length;await ui.service.recover(ui.client);assert.equal(ui.changes.length,n);
 }finally{h.close();}
});
