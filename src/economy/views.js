import {escapeMarkdown} from 'discord.js';
import {fields} from './config.js';
export const noMentions={parse:[],repliedUser:false};
export const esc=v=>escapeMarkdown(String(v));
export const money=(c,n)=>`${c.currency.emoji} ${Number(n).toLocaleString('en-US')} ${esc(c.currency.name)}`;
export const row=components=>({type:1,components});
export const btn=(id,label,style=2,disabled=false)=>({type:2,custom_id:id,label,style,disabled});
export const select=(id,options,placeholder)=>({type:3,custom_id:id,placeholder,options});
export const message=(title,description,components=[])=>({embeds:[{color:0x3366ee,title:`TAVRENIQ • ${title}`,description:description.slice(0,4000)}],components,allowedMentions:noMentions});
export const sections={currency:'Currency name & emoji',daily:'Daily rewards',limits:'Daily earning limits',quiz:'Quiz rewards',wallet:'Wallet robbery',bank:'Bank robbery',crime:'Crime & risk',jobs:'Jobs & cooldowns',shop:'Shop items & prices',logs:'Administrator logs'};
export function configHome(user) {return message('Economy configuration','Changes apply only to this server. All changes are logged. Choose a section.',[row([select(`ec:config:${user}`,Object.entries(sections).map(([value,label])=>({value,label})),'Choose what to configure')])]);}
export function sectionView(user,section,c) {return message(sections[section],fields[section].map(([key,label])=>`**${label}:** ${esc(c[section][key])}`).join('\n')+(section==='bank'?'\n\nCountdown: 30 seconds • Up to 10 robbers. Fine percentage is reserved from each robber’s bank. No panic = success.':'')+(section==='limits'?'\n\nDaily reset: midnight Africa/Lagos. Limits cover daily, work, crime rewards and quiz rewards. Transfers and robbery proceeds do not mint money.':''),[row([btn(`ec:edit:${user}:${section}`,'Edit settings',1),btn(`ec:home:${user}`,'Back')])]);}
export function modal(id,title,inputs) {return {custom_id:id,title:title.slice(0,45),components:inputs.map(([key,label,value,max=100])=>row([{type:4,custom_id:key,label:label.slice(0,45),style:1,required:true,max_length:max,value:String(value)}]))};}
export function configModal(user,section,c) {return modal(`ec:save:${user}:${section}`,sections[section],fields[section].map(([key,label])=>[key,label,c[section][key],section==='currency'?(key==='name'?32:64):12]));}
export function jobModal(user,j) {return modal(`ec:jobform:${user}:${j?.id||'new'}`,'Configure job',[
 ['id','Job ID (lowercase; cannot change existing)',j?.id||'new_job',32],['name','Job name',j?.name||'New Job',60],['pay','Minimum,maximum pay (e.g. 50,150)',j?`${j.min},${j.max}`:'50,150',30],['cooldown','Cooldown in seconds',j?.cooldown||1800,10],['enabled','Enabled: yes or no',j?.enabled===false?'no':'yes',3]]);}
export function itemModal(user,item,effect) {return modal(`ec:itemform:${user}:${item?.id||'new'}:${effect}`,'Configure shop item',[
 ['name','Item name',item?.name||'New Item',60],['emoji','Emoji',item?.emoji||'🎁',64],['price','Wallet price',item?.price??100,12],['value','Work boost % (guard/collectible: 0)',item?.value??(effect==='boost'?100:0),4],['description','Description',item?.description||'A custom server item.',250]]);}
function pagination(user,kind,page,hasNext,extra='') {return row([btn(`ec:page:${user}:${kind}:${Math.max(0,page-1)}:${extra}`,'Previous',2,page===0),btn(`ec:page:${user}:${kind}:${page+1}:${extra}`,'Next',2,!hasNext)]);}
export function listView(store,g,user,kind,page=0,extra='') {
 page=Math.min(100000,Math.max(0,Number.isSafeInteger(page)?page:0));const c=store.config(g);let lines,hasNext,components=[];
 if(kind==='shop'||kind==='inventory'||kind==='shopconfig') {
  const all=kind==='inventory'?store.inventory(g,user):store.items(g).filter(i=>kind==='shopconfig'||i.enabled),items=all.slice(page*8,page*8+8);hasNext=all.length>(page+1)*8;
  lines=items.map(i=>`${i.emoji} **${esc(i.name)}** ${kind==='inventory'?`×${i.quantity}`:money(c,i.price)}${!i.enabled?' • Off sale':''}\n${esc(i.description)}\nID: \`${i.id}\` • Effect: ${i.effect}${i.effect==='boost'?` +${i.value}% next work`:''}`);
  if(kind==='shopconfig'){if(items.length)components.push(row([select(`ec:item:${user}`,items.map(i=>({label:i.name.slice(0,100),value:i.id})),'Edit an item')]));components.push(row([btn(`ec:newitem:${user}`,'Create item',1),btn(`ec:home:${user}`,'Back')]));}
 } else if(kind==='jobs'||kind==='jobconfig') {
  const all=store.jobs(g).filter(j=>kind==='jobconfig'||j.enabled),jobs=all.slice(page*8,page*8+8);hasNext=all.length>(page+1)*8;
  lines=jobs.map(j=>`**${esc(j.name)}** (\`${j.id}\`)${j.enabled?'':' • Disabled'}\nPay: ${money(c,j.min)}–${j.max} • Cooldown: ${j.cooldown}s`);
  if(kind==='jobconfig'){if(jobs.length)components.push(row([select(`ec:job:${user}`,jobs.map(j=>({label:j.name,value:j.id})),'Edit a job')]));components.push(row([btn(`ec:newjob:${user}`,'Create job',1),btn(`ec:home:${user}`,'Back')]));}
 } else if(kind==='logs') {
  const rows=store.logs(g,page*5);hasNext=rows.length===5;lines=rows.map(r=>`**${esc(r.action)}** • <@${r.actor}>\n${esc(r.detail).slice(0,550)}\n<t:${Math.floor(r.at/1000)}:f>`);components.push(row([btn(`ec:home:${user}`,'Back')]));
 } else if(kind==='transactions') {
  const rows=store.transactions(g,user,page*10);hasNext=rows.length===10;lines=rows.map(r=>`${esc(r.reason)} • Wallet ${r.wallet>=0?'+':''}${r.wallet} • Bank ${r.bank>=0?'+':''}${r.bank}\n<t:${Math.floor(r.at/1000)}:f>`);
 } else {
  const rows=store.richest(g,extra||'wealth',page*10);hasNext=rows.length===10;lines=rows.map((r,n)=>`**${page*10+n+1}.** <@${r.user}> — ${money(c,r.total)}`);
 }
 components.push(pagination(user,kind,page,hasNext,extra));
 return message(`${kind==='richest'?(extra==='quiz'?'Quiz earnings':'Wealth leaderboard'):kind} • Page ${page+1}`,lines.join('\n\n')||'Nothing to show yet.',components);
}
export function itemView(user,item,c) {return message('Shop item',`${item.emoji} **${esc(item.name)}**\n${esc(item.description)}\nPrice: ${money(c,item.price)}\nEffect: ${item.effect}${item.effect==='boost'?` +${item.value}%`:''}\nOn sale: ${item.enabled?'Yes':'No'}`,[row([btn(`ec:edititem:${user}:${item.id}`,'Edit',1),btn(`ec:toggleitem:${user}:${item.id}`,item.enabled?'Disable sale':'Enable sale'),btn(`ec:page:${user}:shopconfig:0`,'Back')])]);}
export function bankView(r,c) {
 if(r.status==='pending')return message('Bank robbery',`Target: <@${r.target}>\nRobbers: ${r.crew.map(m=>`<@${m.user}>`).join(', ')} (${r.crew.length}/10)\nResolves <t:${Math.ceil(r.deadline/1000)}:R>.\nJoining reserves ${r.settings.finePercent}% of your current bank as a possible fine.\nVictim: press Panic to secretly stop this robbery. Nobody sees your response.\nIf no panic is pressed, ${r.settings.minPercent}%–${r.settings.maxPercent}% of the victim’s bank at resolution is shared among the crew.`,[row([btn(`ec:join:bank:${r.id}`,'Join robbery',1),btn(`ec:panic:bank:${r.id}`,'Panic',4)])]);
 if(r.status==='cancelled')return message('Bank robbery cancelled',`${r.result?.reason || 'Interrupted.'}\nAll reserved funds were released. No robbery money changed hands.`);
 const v=r.result;return message(v.success?'Bank robbery succeeded':'Bank robbery failed',v.success?`Total stolen: **${money(c,v.total)}** (${v.rate}%).\n${v.shares.map(m=>`<@${m.user}> received ${money(c,m.amount)}`).join('\n')}`:`The victim activated the panic button. **${money(c,v.total)}** went to <@${r.target}>.\n${v.shares.map(m=>`<@${m.user}> paid ${money(c,m.amount)}`).join('\n')}`);
}
