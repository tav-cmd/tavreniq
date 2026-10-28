import {randomInt,randomUUID} from 'node:crypto';
import {defaults,MAX_MONEY,integer,validateSection,validateJob,validateItem,dayKey,percent} from './config.js';
import {rank} from '../quiz/core.js';
export class EconomyStore {
 constructor(db,{now=Date.now,draw=randomInt}={}) {
  this.db=db;this.now=now;this.draw=draw;this.inTx=false;
  db.exec(`
  CREATE TABLE IF NOT EXISTS econ_config(guild TEXT PRIMARY KEY,data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS econ_accounts(guild TEXT,user TEXT,wallet INTEGER NOT NULL DEFAULT 0 CHECK(wallet>=0),bank INTEGER NOT NULL DEFAULT 0 CHECK(bank>=0),hold INTEGER NOT NULL DEFAULT 0 CHECK(hold>=0 AND hold<=bank),streak INTEGER NOT NULL DEFAULT 0,last_daily INTEGER NOT NULL DEFAULT 0,boost INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(guild,user));
  CREATE TABLE IF NOT EXISTS econ_jobs(guild TEXT,id TEXT,data TEXT NOT NULL,PRIMARY KEY(guild,id));
  CREATE TABLE IF NOT EXISTS econ_items(guild TEXT,id TEXT,data TEXT NOT NULL,PRIMARY KEY(guild,id));
  CREATE TABLE IF NOT EXISTS econ_inventory(guild TEXT,user TEXT,item TEXT,quantity INTEGER NOT NULL CHECK(quantity>=0),PRIMARY KEY(guild,user,item));
  CREATE TABLE IF NOT EXISTS econ_cd(guild TEXT,user TEXT,action TEXT,until INTEGER NOT NULL,PRIMARY KEY(guild,user,action));
  CREATE TABLE IF NOT EXISTS econ_earned(guild TEXT,user TEXT,day TEXT,total INTEGER NOT NULL DEFAULT 0,quiz INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(guild,user,day));
  CREATE TABLE IF NOT EXISTS econ_operations(id TEXT PRIMARY KEY,result TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS econ_ledger(id INTEGER PRIMARY KEY,guild TEXT,user TEXT,wallet INTEGER,bank INTEGER,reason TEXT,ref TEXT,at INTEGER);
  CREATE INDEX IF NOT EXISTS econ_user_ledger ON econ_ledger(guild,user,id);
  CREATE TABLE IF NOT EXISTS econ_audit(id INTEGER PRIMARY KEY,guild TEXT,actor TEXT,action TEXT,detail TEXT,at INTEGER);
  CREATE TABLE IF NOT EXISTS econ_payments(id TEXT PRIMARY KEY,guild TEXT,sender TEXT,target TEXT,amount INTEGER,expires INTEGER,status TEXT);
  CREATE TABLE IF NOT EXISTS econ_robberies(id TEXT PRIMARY KEY,guild TEXT,channel TEXT,message TEXT,target TEXT,starter TEXT,status TEXT,deadline INTEGER,panic INTEGER NOT NULL DEFAULT 0,settings TEXT,result TEXT,notified INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS econ_crew(robbery TEXT,user TEXT,hold INTEGER,PRIMARY KEY(robbery,user));
  CREATE TABLE IF NOT EXISTS econ_bank_locks(guild TEXT,user TEXT,robbery TEXT,PRIMARY KEY(guild,user));
  CREATE TABLE IF NOT EXISTS econ_quiz_batches(session TEXT PRIMARY KEY,guild TEXT,settings TEXT,status TEXT);
  CREATE TABLE IF NOT EXISTS econ_quiz_rewards(session TEXT,user TEXT,guild TEXT,amount INTEGER,PRIMARY KEY(session,user));
  `);
 }
 tx(fn) {if(this.inTx)return fn();this.db.exec('BEGIN IMMEDIATE');this.inTx=true;try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}finally{this.inTx=false;}}
 once(id,fn) {return this.tx(()=>{const old=this.db.prepare('SELECT result FROM econ_operations WHERE id=?').get(id);if(old)return JSON.parse(old.result);const r=fn();this.db.prepare('INSERT INTO econ_operations VALUES(?,?)').run(id,JSON.stringify(r));return r;});}
 init(g) {
  if(this.db.prepare('SELECT 1 FROM econ_config WHERE guild=?').get(g))return;
  return this.tx(()=>{
  this.db.prepare('INSERT INTO econ_config VALUES(?,?)').run(g,JSON.stringify(defaults));
  for(const j of [{id:'courier',name:'Courier',min:50,max:150,cooldown:1800,enabled:true},{id:'developer',name:'Developer',min:100,max:250,cooldown:3600,enabled:true}])this.db.prepare('INSERT INTO econ_jobs VALUES(?,?,?)').run(g,j.id,JSON.stringify(j));
  for(const item of [{id:'security_guard',name:'Security Guard',emoji:'🛡️',description:'Automatically blocks one wallet robbery. Maximum five guards held.',price:500,effect:'guard',value:0,enabled:true},
   {id:'double_shift',name:'Double Shift',emoji:'⚡',description:'Use for +100% on your next successful work claim.',price:150,effect:'boost',value:100,enabled:true},
   {id:'golden_ticket',name:'Golden Ticket',emoji:'🎫',description:'A collectible for your inventory.',price:1000,effect:'collectible',value:0,enabled:true}])this.db.prepare('INSERT INTO econ_items VALUES(?,?,?)').run(g,item.id,JSON.stringify(item));
  });
 }
 config(g) {this.init(g);return JSON.parse(this.db.prepare('SELECT data FROM econ_config WHERE guild=?').get(g).data);}
 account(g,u) {this.init(g);this.db.prepare('INSERT OR IGNORE INTO econ_accounts(guild,user) VALUES(?,?)').run(g,u);return this.db.prepare('SELECT * FROM econ_accounts WHERE guild=? AND user=?').get(g,u);}
 audit(g,actor,action,detail) {this.db.prepare('INSERT INTO econ_audit(guild,actor,action,detail,at) VALUES(?,?,?,?,?)').run(g,actor,action,JSON.stringify(detail),this.now());}
 change(g,u,wallet,bank,reason,ref) {
  const a=this.account(g,u),w=a.wallet+wallet,b=a.bank+bank;
  if(!Number.isSafeInteger(w)||!Number.isSafeInteger(b)||w<0||b<a.hold||w>MAX_MONEY||b>MAX_MONEY)throw new Error('Insufficient available funds or the maximum balance would be exceeded. Held bank money cannot be spent.');
  this.db.prepare('UPDATE econ_accounts SET wallet=?,bank=? WHERE guild=? AND user=?').run(w,b,g,u);
  this.db.prepare('INSERT INTO econ_ledger(guild,user,wallet,bank,reason,ref,at) VALUES(?,?,?,?,?,?,?)').run(g,u,wallet,bank,reason,ref,this.now());
 }
 configure(id,g,actor,section,data) {return this.once(id,()=>{const c=this.config(g),next=validateSection(section,data);c[section]=next;this.db.prepare('UPDATE econ_config SET data=? WHERE guild=?').run(JSON.stringify(c),g);this.audit(g,actor,'config:'+section,next);return next;});}
 jobs(g) {this.init(g);return this.db.prepare('SELECT data FROM econ_jobs WHERE guild=? ORDER BY id').all(g).map(r=>JSON.parse(r.data));}
 items(g) {this.init(g);return this.db.prepare('SELECT data FROM econ_items WHERE guild=? ORDER BY id').all(g).map(r=>JSON.parse(r.data));}
 saveJob(id,g,actor,data) {return this.once(id,()=>{const j=validateJob(data),jobs=this.jobs(g);if(!jobs.some(o=>o.id===j.id)&&jobs.length>=25)throw new Error('Maximum 25 jobs per server. Edit an existing job.');this.db.prepare('INSERT INTO econ_jobs VALUES(?,?,?) ON CONFLICT(guild,id) DO UPDATE SET data=excluded.data').run(g,j.id,JSON.stringify(j));this.audit(g,actor,'job',j);return j;});}
 saveItem(id,g,actor,data) {return this.once(id,()=>{const v=validateItem(data),items=this.items(g),old=items.find(i=>i.id===v.id);if(!old&&items.length>=50)throw new Error('Maximum 50 shop items. Disable or edit an existing item.');
  if(old&&(old.effect!==v.effect||old.value!==v.value)&&this.db.prepare('SELECT 1 FROM econ_inventory WHERE guild=? AND item=? AND quantity>0').get(g,v.id))throw new Error('Members own this item. Create a new item to change its effect/strength; its name, price and description can still be edited.');
  this.db.prepare('INSERT INTO econ_items VALUES(?,?,?) ON CONFLICT(guild,id) DO UPDATE SET data=excluded.data').run(g,v.id,JSON.stringify(v));this.audit(g,actor,'item',v);return v;});}
 setBalance(id,g,actor,u,bucket,amount) {return this.once(id,()=>{if(!['wallet','bank'].includes(bucket))throw new Error('Choose wallet or bank.');amount=integer(amount,0,MAX_MONEY);const a=this.account(g,u);this.change(g,u,bucket==='wallet'?amount-a.wallet:0,bucket==='bank'?amount-a.bank:0,'admin set balance',id);this.audit(g,actor,'set balance',{user:u,bucket,before:a[bucket],after:amount});return {amount,bucket};});}
 move(id,g,u,amount,deposit) {return this.once(id,()=>{amount=integer(amount,1,MAX_MONEY);this.change(g,u,deposit?-amount:amount,deposit?amount:-amount,deposit?'deposit':'withdraw',id);return {amount};});}
 cooldown(g,u,action,seconds) {
  const row=this.db.prepare('SELECT until FROM econ_cd WHERE guild=? AND user=? AND action=?').get(g,u,action);
  if(row?.until>this.now())throw new Error(`Try again in ${Math.ceil((row.until-this.now())/1000)} seconds.`);
  this.db.prepare('INSERT INTO econ_cd VALUES(?,?,?,?) ON CONFLICT(guild,user,action) DO UPDATE SET until=excluded.until').run(g,u,action,this.now()+seconds*1000);
 }
 earnings(g,u) {return this.db.prepare('SELECT total,quiz FROM econ_earned WHERE guild=? AND user=? AND day=?').get(g,u,dayKey(this.now())) || {total:0,quiz:0};}
 mint(g,u,amount,kind,ref,limits=this.config(g).limits) {
  const e=this.earnings(g,u),a=this.account(g,u);
  const paid=Math.max(0,Math.min(amount,limits.daily-e.total,kind==='quiz'?limits.quiz-e.quiz:amount,MAX_MONEY-a.wallet));
  this.change(g,u,paid,0,kind,ref);
  this.db.prepare('INSERT INTO econ_earned VALUES(?,?,?,?,?) ON CONFLICT(guild,user,day) DO UPDATE SET total=total+excluded.total,quiz=quiz+excluded.quiz').run(g,u,dayKey(this.now()),paid,kind==='quiz'?paid:0);
  return paid;
 }
 daily(id,g,u) {return this.once(id,()=>{const c=this.config(g),a=this.account(g,u);if(this.earnings(g,u).total>=c.limits.daily)throw new Error('Your daily earning limit is reached. It resets at midnight Africa/Lagos.');this.cooldown(g,u,'daily',c.daily.cooldown);
  const streak=a.last_daily&&this.now()-a.last_daily<=c.daily.cooldown*2000?a.streak+1:1;
  const paid=this.mint(g,u,c.daily.amount+Math.min(streak-1,c.daily.maxStreak-1)*c.daily.streakBonus,'daily',id);
  this.db.prepare('UPDATE econ_accounts SET streak=?,last_daily=? WHERE guild=? AND user=?').run(streak,this.now(),g,u);return {paid,streak};});}
 work(id,g,u,jobId) {return this.once(id,()=>{const j=this.jobs(g).find(j=>j.id===jobId&&j.enabled);if(!j)throw new Error('Choose an enabled job from /jobs.');const c=this.config(g);if(this.earnings(g,u).total>=c.limits.daily)throw new Error('Daily earning limit reached.');this.cooldown(g,u,'work',j.cooldown);const a=this.account(g,u),base=this.draw(j.min,j.max+1),paid=this.mint(g,u,base+percent(base,a.boost),'work',id);
  this.db.prepare('UPDATE econ_accounts SET boost=0 WHERE guild=? AND user=?').run(g,u);return {paid,job:j.name,boost:a.boost};});}
 crime(id,g,u) {return this.once(id,()=>{const c=this.config(g).crime,a=this.account(g,u);if(a.wallet<c.fine)throw new Error('You need enough in your wallet to cover the possible crime fine.');this.cooldown(g,u,'crime',c.cooldown);
  if(this.draw(0,100)<c.success)return {success:true,amount:this.mint(g,u,this.draw(c.minReward,c.maxReward+1),'crime',id)};
  this.change(g,u,-c.fine,0,'crime fine',id);return {success:false,amount:c.fine};});}
 payment(g,u,target,amount) {amount=integer(amount,1,MAX_MONEY);if(u===target)throw new Error('You cannot pay yourself.');if(this.account(g,u).wallet<amount)throw new Error('Not enough money in your wallet.');const id=randomUUID();this.db.prepare('INSERT INTO econ_payments VALUES(?,?,?,?,?,?,?)').run(id,g,u,target,amount,this.now()+120000,'pending');return {id,amount,target};}
 confirmPay(op,g,u,id,confirm) {return this.once(op,()=>{const p=this.db.prepare('SELECT * FROM econ_payments WHERE id=? AND guild=? AND sender=?').get(id,g,u);if(!p||p.status!=='pending'||p.expires<=this.now())throw new Error('This transfer expired or was already handled.');
  if(confirm){this.change(g,u,-p.amount,0,'payment sent',id);this.change(g,p.target,p.amount,0,'payment received',id);}
  this.db.prepare('UPDATE econ_payments SET status=? WHERE id=?').run(confirm?'paid':'cancelled',id);return {...p,status:confirm?'paid':'cancelled'};});}
 inventory(g,u) {return this.db.prepare('SELECT item,quantity FROM econ_inventory WHERE guild=? AND user=? AND quantity>0 ORDER BY item').all(g,u).map(row=>({...this.items(g).find(i=>i.id===row.item),quantity:row.quantity}));}
 guards(g,u) {return this.inventory(g,u).filter(i=>i.effect==='guard').reduce((s,i)=>s+i.quantity,0);}
 inv(g,u,item,delta) {const n=this.db.prepare('SELECT quantity FROM econ_inventory WHERE guild=? AND user=? AND item=?').get(g,u,item)?.quantity||0;if(n+delta<0||n+delta>10000)throw new Error('Invalid inventory quantity.');this.db.prepare('INSERT INTO econ_inventory VALUES(?,?,?,?) ON CONFLICT(guild,user,item) DO UPDATE SET quantity=excluded.quantity').run(g,u,item,n+delta);}
 buy(id,g,u,itemId,quantity) {return this.once(id,()=>{quantity=integer(quantity,1,100,'Quantity');const item=this.items(g).find(i=>i.id===itemId&&i.enabled);if(!item)throw new Error('That item is not on sale.');if(item.effect==='guard'&&this.guards(g,u)+quantity>5)throw new Error('You can hold a maximum of five Security Guards (including custom guard items).');const cost=item.price*quantity;this.change(g,u,-cost,0,'shop purchase',id);this.inv(g,u,itemId,quantity);return {item:item.name,quantity,cost};});}
 use(id,g,u,itemId) {return this.once(id,()=>{const item=this.inventory(g,u).find(i=>i.id===itemId);if(!item)throw new Error('You do not own that item.');if(item.effect==='guard')throw new Error('Security Guards protect your wallet automatically. One is consumed per blocked robbery.');if(item.effect==='collectible')throw new Error('This is a collectible; it stays in your inventory.');if(this.account(g,u).boost)throw new Error('You already have a work boost active. Use /work first.');this.inv(g,u,itemId,-1);this.db.prepare('UPDATE econ_accounts SET boost=? WHERE guild=? AND user=?').run(item.value,g,u);return {boost:item.value};});}
 robWallet(id,g,u,target) {return this.once(id,()=>{if(u===target)throw new Error('You cannot rob yourself.');const c=this.config(g).wallet,a=this.account(g,u),v=this.account(g,target);if(a.wallet<c.minimum)throw new Error(`You need at least ${c.minimum} in your wallet to attempt robbery.`);this.cooldown(g,u,'rob_wallet',c.cooldown);
  const guard=this.inventory(g,target).find(i=>i.effect==='guard');if(guard){const fine=percent(a.wallet,c.finePercent);this.change(g,u,-fine,0,'wallet robbery fine',id);this.change(g,target,fine,0,'guard compensation',id);this.inv(g,target,guard.id,-1);return {success:false,amount:fine,guards:this.guards(g,target)};}
  const rate=this.draw(c.minPercent,c.maxPercent+1),amount=percent(v.wallet,rate);this.change(g,target,-amount,0,'wallet robbery loss',id);this.change(g,u,amount,0,'wallet robbery gain',id);return {success:true,amount,rate};});}
 robbery(id) {const r=this.db.prepare('SELECT * FROM econ_robberies WHERE id=?').get(id);return r?{...r,settings:JSON.parse(r.settings),result:r.result?JSON.parse(r.result):null,crew:this.db.prepare('SELECT user,hold FROM econ_crew WHERE robbery=? ORDER BY rowid').all(id)}:null;}
 lock(g,u,id) {if(this.db.prepare('SELECT 1 FROM econ_bank_locks WHERE guild=? AND user=?').get(g,u))throw new Error('That member is already involved in an active bank robbery.');this.db.prepare('INSERT INTO econ_bank_locks VALUES(?,?,?)').run(g,u,id);}
 enlist(r,u) {if(u===r.target)throw new Error('You are the target; use the panic button instead.');if(r.crew.length>=10)throw new Error('This robbery already has ten participants.');const a=this.account(r.guild,u);if(a.bank<r.settings.minimum)throw new Error(`You need at least ${r.settings.minimum} in your bank to join.`);this.lock(r.guild,u,r.id);this.cooldown(r.guild,u,'rob_bank',r.settings.cooldown);const hold=percent(a.bank,r.settings.finePercent);this.db.prepare('UPDATE econ_accounts SET hold=hold+? WHERE guild=? AND user=?').run(hold,r.guild,u);this.db.prepare('INSERT INTO econ_crew VALUES(?,?,?)').run(r.id,u,hold);return hold;}
 startBank(op,g,channel,u,target) {return this.once(op,()=>{if(u===target)throw new Error('You cannot rob yourself.');const c=this.config(g).bank,v=this.account(g,target);if(v.bank<=0)throw new Error('That member has no money in their bank.');const id=randomUUID();this.lock(g,target,id);this.db.prepare('INSERT INTO econ_robberies(id,guild,channel,target,starter,status,deadline,settings) VALUES(?,?,?,?,?,?,?,?)').run(id,g,channel,target,u,'pending',this.now()+30000,JSON.stringify(c));const r=this.robbery(id),hold=this.enlist(r,u);return {id,hold};});}
 setMessage(id,message) {this.db.prepare("UPDATE econ_robberies SET message=?,deadline=? WHERE id=? AND status='pending' AND message IS NULL").run(message,this.now()+30000,id);}
 joinBank(op,g,u,id) {return this.once(op,()=>{const r=this.robbery(id);if(!r||r.guild!==g||r.status!=='pending'||r.deadline<=this.now())throw new Error('This robbery is closed.');return {hold:this.enlist(r,u)};});}
 panic(op,g,u,id) {return this.once(op,()=>{const r=this.robbery(id);if(!r||r.guild!==g||r.status!=='pending'||r.deadline<=this.now())throw new Error('This robbery is closed.');if(u!==r.target)throw new Error('Only the targeted member can press this panic button.');this.db.prepare('UPDATE econ_robberies SET panic=1 WHERE id=?').run(id);return {message:'Panic button activated privately. The robbery will fail when the countdown ends.'};});}
 release(r) {for(const member of r.crew)this.db.prepare('UPDATE econ_accounts SET hold=hold-? WHERE guild=? AND user=?').run(member.hold,r.guild,member.user);this.db.prepare('DELETE FROM econ_bank_locks WHERE robbery=?').run(r.id);}
 cancelBank(id,reason) {return this.tx(()=>{const r=this.robbery(id);if(!r||r.status!=='pending')return r;this.release(r);for(const m of r.crew)this.db.prepare("DELETE FROM econ_cd WHERE guild=? AND user=? AND action='rob_bank'").run(r.guild,m.user);this.db.prepare("UPDATE econ_robberies SET status='cancelled',result=? WHERE id=?").run(JSON.stringify({reason}),id);return this.robbery(id);});}
 settleBank(id) {
  const initial=this.robbery(id);if(!initial||initial.status!=='pending'||initial.deadline>this.now())return initial;
  try{return this.once('bank-settle:'+id,()=>{
   const r=this.robbery(id);this.release(r);let result;
   if(r.panic){let total=0;for(const m of r.crew){this.change(r.guild,m.user,0,-m.hold,'bank panic fine',id);total+=m.hold;}this.change(r.guild,r.target,0,total,'bank panic compensation',id);result={success:false,total,shares:r.crew.map(m=>({user:m.user,amount:m.hold}))};}
   else {const a=this.account(r.guild,r.target),rate=this.draw(r.settings.minPercent,r.settings.maxPercent+1),total=percent(a.bank,rate),base=Math.floor(total/r.crew.length),remainder=total%r.crew.length;
    this.change(r.guild,r.target,0,-total,'bank robbery loss',id);const shares=r.crew.map((m,index)=>({user:m.user,amount:base+(index<remainder?1:0)}));for(const m of shares)this.change(r.guild,m.user,0,m.amount,'bank robbery gain',id);result={success:true,total,rate,shares};}
   this.db.prepare("UPDATE econ_robberies SET status='settled',result=? WHERE id=?").run(JSON.stringify(result),id);return this.robbery(id);
  });}catch(error){return this.cancelBank(id,'Settlement could not complete safely. All holds released; no robbery money transferred.');}
 }
 markBankReported(id) {this.db.prepare('UPDATE econ_robberies SET notified=1 WHERE id=?').run(id);}
 unreportedBanks() {return this.db.prepare("SELECT id FROM econ_robberies WHERE status!='pending' AND notified=0").all().map(r=>this.robbery(r.id));}
 pendingBanks() {return this.db.prepare("SELECT id FROM econ_robberies WHERE status='pending'").all().map(r=>this.robbery(r.id));}
 snapshotQuiz(id,g) {const c=this.config(g);this.db.prepare('INSERT OR IGNORE INTO econ_quiz_batches VALUES(?,?,?,?)').run(id,g,JSON.stringify({quiz:c.quiz,limits:c.limits,currency:c.currency}),'pending');}
 payQuiz(id) {
  const batch=this.db.prepare('SELECT * FROM econ_quiz_batches WHERE session=?').get(id);if(!batch||batch.status!=='pending')return;
  const s=this.db.prepare('SELECT * FROM quiz_sessions WHERE id=?').get(id);if(s.status!=='completed')return;
  const cfg=JSON.parse(batch.settings),rows=this.db.prepare('SELECT user,COUNT(*) AS answered,SUM(correct) AS correct FROM quiz_answers WHERE session=? GROUP BY user').all(id),players=rank(rows.map(r=>({...r,played:s.played})));
  for(const p of players){const bonus=players.length>=cfg.quiz.minPlayers&&p.correct>0?({1:cfg.quiz.first,2:cfg.quiz.second,3:cfg.quiz.third}[p.place]||0):0;const amount=this.mint(s.guild,p.user,p.correct*cfg.quiz.correct+bonus,'quiz',id,cfg.limits);this.db.prepare('INSERT INTO econ_quiz_rewards VALUES(?,?,?,?)').run(id,p.user,s.guild,amount);}
  this.db.prepare("UPDATE econ_quiz_batches SET status='paid' WHERE session=?").run(id);
 }
 cancelQuiz(id) {this.db.prepare("UPDATE econ_quiz_batches SET status='cancelled' WHERE session=? AND status='pending'").run(id);}
 quizRewards(id) {return this.db.prepare('SELECT user,amount FROM econ_quiz_rewards WHERE session=?').all(id);}
 quizTotal(g,u) {return this.db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM econ_quiz_rewards WHERE guild=? AND user=?').get(g,u).total;}
 richest(g,metric='wealth',offset=0) {return metric==='quiz'?this.db.prepare('SELECT user,SUM(amount) AS total FROM econ_quiz_rewards WHERE guild=? GROUP BY user ORDER BY total DESC,user LIMIT 10 OFFSET ?').all(g,offset):this.db.prepare('SELECT user,wallet+bank AS total FROM econ_accounts WHERE guild=? ORDER BY total DESC,user LIMIT 10 OFFSET ?').all(g,offset);}
 transactions(g,u,offset=0) {return this.db.prepare('SELECT * FROM econ_ledger WHERE guild=? AND user=? ORDER BY id DESC LIMIT 10 OFFSET ?').all(g,u,offset);}
 logs(g,offset=0) {return this.db.prepare('SELECT * FROM econ_audit WHERE guild=? ORDER BY id DESC LIMIT 5 OFFSET ?').all(g,offset);}
}
