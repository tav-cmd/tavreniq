export const MAX_MONEY=1_000_000_000_000;
export const defaults={
 currency:{name:'dollar',emoji:'💵'},
 daily:{amount:250,streakBonus:25,maxStreak:7,cooldown:86400},
 limits:{daily:10000,quiz:2000},
 quiz:{correct:10,first:150,second:100,third:50,minPlayers:3},
 wallet:{cooldown:3600,minPercent:5,maxPercent:15,finePercent:10,minimum:100},
 bank:{cooldown:21600,minPercent:10,maxPercent:30,finePercent:20,minimum:100},
 crime:{cooldown:3600,minReward:100,maxReward:300,fine:100,success:60}
};
export const fields={
 currency:[['name','Currency name'],['emoji','Currency emoji']],
 daily:[['amount','Daily amount'],['streakBonus','Bonus per streak day'],['maxStreak','Maximum streak bonus days'],['cooldown','Cooldown (seconds)']],
 limits:[['daily','Total daily earning limit'],['quiz','Daily quiz earning limit']],
 quiz:[['correct','Per correct answer'],['first','First-place bonus'],['second','Second-place bonus'],['third','Third-place bonus'],['minPlayers','Minimum players for podium bonus']],
 wallet:[['cooldown','Cooldown (seconds)'],['minPercent','Minimum stolen %'],['maxPercent','Maximum stolen %'],['finePercent','Failed robbery fine % of wallet'],['minimum','Minimum attacker wallet']],
 bank:[['cooldown','Cooldown (seconds)'],['minPercent','Minimum stolen %'],['maxPercent','Maximum stolen %'],['finePercent','Panic fine % of each bank'],['minimum','Minimum robber bank']],
 crime:[['cooldown','Cooldown (seconds)'],['minReward','Minimum reward'],['maxReward','Maximum reward'],['fine','Failure fine from wallet'],['success','Success chance %']]
};
export function integer(v,min=0,max=1_000_000,label='Amount') {
 if(typeof v==='string'&&!/^\d+$/.test(v.trim()))throw new Error(`${label} must be a whole number (${min}–${max}).`);
 const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`${label} must be a whole number (${min}–${max}).`);return n;
}
export function text(v,max,label) {if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f]/.test(v))throw new Error(`${label} must be 1–${max} characters.`);return v.trim();}
export function validateSection(section,data) {
 if(!fields[section])throw new Error('Unknown configuration section.');
 const o={};for(const [key,label]of fields[section]) {
  if(section==='currency'){o[key]=text(data[key],key==='name'?32:64,label);continue;}
  let min=0,max=1_000_000;
  if(key==='cooldown'){min=10;max=604800;}
  if(/Percent$/.test(key)||key==='success')max=100;
  if(key==='minPlayers'){min=1;max=100;}
  if(key==='maxStreak'){min=1;max=365;}
  if(section==='limits')max=100_000_000;
  o[key]=integer(data[key],min,max,label);
 }
 if(o.minPercent>o.maxPercent||o.minReward>o.maxReward)throw new Error('The minimum cannot exceed the maximum.');
 return o;
}
export function validateJob(data) {
 const o={id:text(data.id,32,'Job ID'),name:text(data.name,60,'Job name'),min:integer(data.min),max:integer(data.max),cooldown:integer(data.cooldown,10,604800,'Cooldown'),enabled:!!data.enabled};
 if(!/^[a-z][a-z0-9_]*$/.test(o.id))throw new Error('Job ID must be lowercase letters, digits and underscores.');
 if(o.min>o.max)throw new Error('Minimum pay cannot exceed maximum pay.');return o;
}
export function validateItem(data) {
 if(!['guard','boost','collectible'].includes(data.effect))throw new Error('Choose guard, boost or collectible.');
 return {id:text(data.id,40,'Item ID'),name:text(data.name,60,'Item name'),emoji:text(data.emoji,64,'Emoji'),description:text(data.description,250,'Description'),price:integer(data.price),effect:data.effect,
 value:data.effect==='boost'?integer(data.value,1,500,'Work boost %'):0,enabled:!!data.enabled};
}
export const dayKey=now=>new Date(now+3600000).toISOString().slice(0,10); // Africa/Lagos, UTC+1
export const percent=(amount,p)=>Number(BigInt(amount)*BigInt(p)/100n);
