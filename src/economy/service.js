import {randomUUID} from 'node:crypto';
import {MessageFlags,PermissionFlagsBits as P} from 'discord.js';
import {fields} from './config.js';
import {economyCommands} from './commands.js';
import {message,money,configHome,sectionView,configModal,jobModal,itemModal,listView,itemView,bankView,row,btn,select,noMentions} from './views.js';
const names=new Set(economyCommands.map(c=>c.name));
export async function requireEconomyAdmin(guild,user) {
 const live=await guild.fetch();if(live.ownerId===user)return;
 const member=await guild.members.fetch({user,force:true});
 if(!member.permissions.has(P.Administrator))throw new Error('Only this server’s owner or administrators can configure its economy or set balances.');
}
export class EconomyService {
 constructor(store,{schedule=setTimeout,cancel=clearTimeout,logger=console}={}) {this.store=store;this.schedule=schedule;this.cancel=cancel;this.logger=logger;this.timers=new Map();this.updates=new Map();this.closed=false;}
 owns(i) {return ((i.isChatInputCommand()||i.isAutocomplete())&&names.has(i.commandName))||((i.isButton()||i.isStringSelectMenu()||i.isModalSubmit())&&i.customId.startsWith('ec:'));}
 async target(i) {const u=i.options.getUser('user',true);if(u.bot)throw new Error('Choose a human server member, not a bot.');const m=await i.guild.members.fetch({user:u.id,force:true});return m;}
 async member(i) {const m=await i.guild.members.fetch({user:i.user.id,force:true});if(m.user?.bot)throw new Error('Bots cannot use the economy.');return m;}
 checkMenu(i,owner) {if(owner!==i.user.id)throw new Error('Open your own menu to use these controls.');}
 async adminModal(i,owner,build) {
  this.checkMenu(i,owner);
  // Fresh authorization is mandatory again on modal submission, before any write.
  if(i.guild.ownerId!==i.user.id&&!i.memberPermissions?.has(P.Administrator))throw new Error('Only server administrators or the owner may configure the economy.');
  await i.showModal(build());
 }
 async handle(i) {
  if(!this.owns(i))return false;
  const s=this.store,g=i.guildId,u=i.user.id;
  try {
   if(!i.inGuild())throw new Error('Use economy commands inside a server.');
   if(this.closed)throw new Error('TAVRENIQ is restarting. Try again shortly.');
   if(i.isAutocomplete()) {
    const q=i.options.getFocused().toLowerCase(),source=i.commandName==='work'?s.jobs(g).filter(j=>j.enabled):i.commandName==='use'?s.inventory(g,u):s.items(g).filter(item=>item.enabled);
    await i.respond(source.filter(item=>item.name.toLowerCase().includes(q)||item.id.includes(q)).slice(0,25).map(item=>({name:item.name.slice(0,100),value:item.id})));return true;
   }
   const [,action,owner,arg,more]=i.customId?.split(':')||[];
   // Modals must be the initial interaction response, not a deferred reply.
   if(i.isButton()&&action==='edit') {await this.adminModal(i,owner,()=>configModal(u,arg,s.config(g)));return true;}
   if((i.isButton()&&action==='newjob')||(i.isStringSelectMenu()&&action==='job')) {
    await this.adminModal(i,owner,()=>jobModal(u,action==='job'?s.jobs(g).find(j=>j.id===i.values[0]):null));return true;
   }
   if(i.isButton()&&action==='edititem') {
    const item=s.items(g).find(v=>v.id===arg);if(!item)throw new Error('Item no longer exists.');
    await this.adminModal(i,owner,()=>itemModal(u,item,item.effect));return true;
   }
   if(i.isStringSelectMenu()&&action==='effect') {await this.adminModal(i,owner,()=>itemModal(u,null,i.values[0]));return true;}
   // Record the target's panic synchronously before network awaits can consume
   // the last moments of the countdown. Guild/channel/message/target IDs bind it.
   if(i.isButton()&&action==='panic') {
    const r=s.robbery(arg);
    if(!r||r.guild!==g||r.channel!==i.channelId||r.message!==i.message.id)throw new Error('This robbery is not available here.');
    const result=s.panic(i.id,g,u,arg);
    await i.reply({content:result.message,flags:MessageFlags.Ephemeral,allowedMentions:noMentions});
    return true;
   }
   await i.deferReply({flags:MessageFlags.Ephemeral});
   if(i.isChatInputCommand()) {
    const c=s.config(g);
    switch(i.commandName) {
     case 'economy': await requireEconomyAdmin(i.guild,u);await i.editReply(configHome(u));break;
     case 'set': {await requireEconomyAdmin(i.guild,u);const target=await this.target(i),r=s.setBalance(i.id,g,u,target.id,i.options.getString('account'),i.options.getInteger('amount'));await i.editReply(message('Balance updated',`<@${target.id}> • ${r.bucket}: ${money(c,r.amount)}`));break;}
     case 'balance':case 'profile': {
      const target=i.options.getUser('user')?.id||u,a=s.account(g,target),earned=s.earnings(g,target);
      await i.editReply(message(i.commandName==='profile'?'Economy profile':'Balance',`<@${target}>\nWallet: **${money(c,a.wallet)}**\nBank: **${money(c,a.bank)}**\nReserved bank funds: ${money(c,a.hold)}\nAvailable bank: ${money(c,a.bank-a.hold)}\nSecurity Guards: ${s.guards(g,target)}/5\nActive work boost: +${a.boost}%\nDaily streak: ${a.streak}\nEarned today: ${money(c,earned.total)} / ${c.limits.daily}\nLifetime quiz earnings: ${money(c,s.quizTotal(g,target))}`));break;
     }
     case 'deposit':case 'withdraw': {const r=s.move(i.id,g,u,i.options.getInteger('amount'),i.commandName==='deposit');await i.editReply(message('Transfer complete',`${i.commandName==='deposit'?'Deposited':'Withdrew'} ${money(c,r.amount)}.`));break;}
     case 'daily': {const r=s.daily(i.id,g,u);await i.editReply(message('Daily reward',`Received ${money(c,r.paid)} • Streak: ${r.streak}.`));break;}
     case 'work': {const r=s.work(i.id,g,u,i.options.getString('job')||'courier');await i.editReply(message('Work completed',`${r.job}: earned ${money(c,r.paid)}.${r.boost?` Used your +${r.boost}% work boost.`:''}`));break;}
     case 'crime': {const r=s.crime(i.id,g,u);await i.editReply(message(r.success?'Crime succeeded':'Crime failed',r.success?`Earned ${money(c,r.amount)}.`:`You paid a ${money(c,r.amount)} wallet fine.`));break;}
     case 'jobs':case 'shop':case 'inventory':case 'transactions': await i.editReply(listView(s,g,u,i.commandName));break;
     case 'richest':await i.editReply(listView(s,g,u,'richest',0,i.options.getString('type')||'wealth'));break;
     case 'buy':{const r=s.buy(i.id,g,u,i.options.getString('item'),i.options.getInteger('quantity')||1);await i.editReply(message('Purchase complete',`Bought ${r.quantity} × ${r.item} for ${money(c,r.cost)}.`));break;}
     case 'use':{const r=s.use(i.id,g,u,i.options.getString('item'));await i.editReply(message('Item activated',`Your next /work reward has a +${r.boost}% boost. Earning limits still apply.`));break;}
     case 'pay':{const target=await this.target(i),r=s.payment(g,u,target.id,i.options.getInteger('amount'));await i.editReply(message('Confirm payment',`Send **${money(c,r.amount)}** from your wallet to <@${r.target}>? Expires in 2 minutes.`,[row([btn(`ec:pay:${u}:${r.id}`,'Confirm payment',3),btn(`ec:cancelpay:${u}:${r.id}`,'Cancel',4)])]));break;}
     case 'rob': {
      const target=await this.target(i);await this.member(i);
      if(i.options.getSubcommand()==='wallet') {
       const r=s.robWallet(i.id,g,u,target.id);
       await i.editReply(message(r.success?'Wallet robbery succeeded':'Security Guard blocked you',r.success?`You stole ${money(c,r.amount)} from <@${target.id}>.`:`You paid ${money(c,r.amount)} to <@${target.id}>. One Security Guard was consumed.`));
      }else {
       if(!i.channel.permissionsFor(target)?.has([P.ViewChannel,P.ReadMessageHistory]))throw new Error('The target must be able to see this channel and its message history to use the panic button.');
       const me=await i.guild.members.fetchMe();if(!i.channel.permissionsFor(me)?.has([P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.EmbedLinks]))throw new Error('I need View Channel, Read Message History, Send Messages and Embed Links here.');
       const result=s.startBank(i.id,g,i.channelId,u,target.id),r=s.robbery(result.id);
       try {
        const view=bankView(r,c);const msg=await i.channel.send({...view,content:`<@${target.id}> Your bank is being targeted.`,allowedMentions:{parse:[],users:[target.id],repliedUser:false}});
        s.setMessage(r.id,msg.id);await msg.edit(bankView(s.robbery(r.id),c));this.arm(i.client,r.id);
       }catch(error){s.cancelBank(r.id,'Could not open the robbery message.');throw error;}
       await i.editReply(message('Robbery started',`${money(c,result.hold)} of your bank is reserved as the possible fine.`));
      }break;
     }
    }
    return true;
   }
   if(action==='join'||action==='panic') {
    const r=s.robbery(arg);if(!r||r.guild!==g||r.channel!==i.channelId||r.message!==i.message.id)throw new Error('This robbery is not available here.');
    await this.member(i);
    if(action==='panic') {const result=s.panic(i.id,g,u,arg);await i.editReply({content:result.message,allowedMentions:noMentions});}
    else {const result=s.joinBank(i.id,g,u,arg);await i.editReply({content:`Joined. Reserved: ${money(s.config(g),result.hold)}.`,allowedMentions:noMentions});await this.refreshBank(arg,i.message).catch(()=>{});}
    return true;
   }
   this.checkMenu(i,owner);
   if(action==='pay'||action==='cancelpay') {await this.member(i);const r=s.confirmPay(i.id,g,u,arg,action==='pay');await i.editReply(message('Payment',r.status==='paid'?`Sent ${money(s.config(g),r.amount)} to <@${r.target}>.`:'Payment cancelled.'));return true;}
   if(action==='page') {
    if(['shopconfig','jobconfig','logs'].includes(arg))await requireEconomyAdmin(i.guild,u);
    const extra=i.customId.split(':')[5]||'';await i.editReply(listView(s,g,u,arg,Number(more),extra));return true;
   }
   await requireEconomyAdmin(i.guild,u);
   if(i.isModalSubmit()) {
    const value=k=>i.fields.getTextInputValue(k);
    if(action==='save') {const data=Object.fromEntries(fields[arg].map(([k])=>[k,value(k)]));s.configure(i.id,g,u,arg,data);await i.editReply(sectionView(u,arg,s.config(g)));}
    else if(action==='jobform') {
     const id=value('id');if(arg!=='new'&&id!==arg)throw new Error('An existing job’s ID cannot be changed. Create a new job instead.');
     const pay=value('pay').split(',').map(v=>v.trim());if(pay.length!==2)throw new Error('Enter minimum,maximum pay, for example 50,150.');
     if(!/^(yes|no)$/i.test(value('enabled')))throw new Error('Enabled must be yes or no.');
     s.saveJob(i.id,g,u,{id,name:value('name'),min:pay[0],max:pay[1],cooldown:value('cooldown'),enabled:/^yes$/i.test(value('enabled'))});await i.editReply(listView(s,g,u,'jobconfig'));
    }else if(action==='itemform') {
     const old=arg==='new'?null:s.items(g).find(v=>v.id===arg);if(arg!=='new'&&!old)throw new Error('Item not found.');
     const item={id:old?.id||'item_'+randomUUID().slice(0,8),effect:old?.effect||more,enabled:old?.enabled??true,name:value('name'),emoji:value('emoji'),price:value('price'),value:value('value'),description:value('description')};
     const saved=s.saveItem(i.id,g,u,item);await i.editReply(itemView(u,saved,s.config(g)));
    } else throw new Error('Unknown economy form.');
   }else if(action==='home')await i.editReply(configHome(u));
   else if(action==='config') {
    const section=i.values[0];if(fields[section])await i.editReply(sectionView(u,section,s.config(g)));
    else await i.editReply(listView(s,g,u,{jobs:'jobconfig',shop:'shopconfig',logs:'logs'}[section]));
   }else if(action==='item') {const item=s.items(g).find(v=>v.id===i.values[0]);if(!item)throw new Error('Item not found.');await i.editReply(itemView(u,item,s.config(g)));}
   else if(action==='toggleitem') {const item=s.items(g).find(v=>v.id===arg);if(!item)throw new Error('Item not found.');const changed=s.saveItem(i.id,g,u,{...item,enabled:!item.enabled});await i.editReply(itemView(u,changed,s.config(g)));}
   else if(action==='newitem')await i.editReply(message('Custom item effect','Choose an effect. Security Guards act automatically; boosts apply to the next /work; collectibles have no effect.',[row([select(`ec:effect:${u}`,[{label:'Security Guard protection',value:'guard'},{label:'Work reward boost',value:'boost'},{label:'Collectible',value:'collectible'}],'Choose an effect')])]));
   else throw new Error('This economy control is no longer available.');
  }catch(error) {
   this.logger.error('Economy request failed:',error.code||error.name);
   if(i.isAutocomplete()){await i.respond([]).catch(()=>{});return true;}
   const payload={content:error.code?'The request could not be completed. Check permissions and try again.':error.name==='Error'?error.message.slice(0,1800):'The economy request failed. Please try again.',allowedMentions:noMentions};
   if(i.deferred||i.replied)await i.editReply(payload).catch(()=>{});else await i.reply({...payload,flags:MessageFlags.Ephemeral}).catch(()=>{});
  }
  return true;
 }
 arm(client,id) {const r=this.store.robbery(id);if(!r||r.status!=='pending'||this.closed)return;this.cancel(this.timers.get(id));const t=this.schedule(()=>{this.timers.delete(id);this.finishBank(client,id).catch(e=>this.logger.error('Bank settlement failed:',e.code||e.name));},Math.max(0,r.deadline-this.store.now()));this.timers.set(id,t);t?.unref?.();}
 async finishBank(client,id) {
  if(this.closed)return;const r=this.store.robbery(id);if(!r||r.status!=='pending')return;
  let msg,channel,valid=false;
  try{channel=await client.channels.fetch(r.channel);msg=await channel.messages.fetch(r.message);const target=await channel.guild.members.fetch({user:r.target,force:true});valid=channel.permissionsFor(target)?.has([P.ViewChannel,P.ReadMessageHistory]);}catch{}
  if(this.closed)return;
  const done=valid?this.store.settleBank(id):this.store.cancelBank(id,'The robbery message or victim became unavailable.');
  if(done.status==='pending'){this.arm(client,id);return;}
  if(msg)await this.refreshBank(id,msg).catch(()=>{});
 }
 async refreshBank(id,msg) {
  const previous=this.updates.get(id)||Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
   if(this.closed)return;
   const r=this.store.robbery(id);if(!r)return;
   const payload=bankView(r,this.store.config(r.guild));
   if(r.status!=='pending')payload.content='';
   await msg.edit(payload);
   if(r.status!=='pending'&&!this.closed)this.store.markBankReported(id);
  });
  this.updates.set(id,next);
  try{await next;}finally{if(this.updates.get(id)===next)this.updates.delete(id);}
 }
 async recover(client) {
  for(const r of this.store.pendingBanks())this.store.cancelBank(r.id,'The bot restarted during the countdown.');
  for(const done of this.store.unreportedBanks()) {
   try{
    const channel=await client.channels.fetch(done.channel);if(channel?.guildId!==done.guild)continue;
    const msg=done.message?await channel.messages.fetch(done.message).catch(()=>null):null;
    if(msg)await this.refreshBank(done.id,msg);
    else {await channel.send(bankView(done,this.store.config(done.guild)));this.store.markBankReported(done.id);}
   }catch(error){this.logger.error('Robbery recovery notification failed:',error.code||error.name);}
  }
 }
 shutdown() {this.closed=true;for(const t of this.timers.values())this.cancel(t);this.timers.clear();}
}
