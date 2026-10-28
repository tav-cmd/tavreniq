import {PermissionFlagsBits as P,ChannelType} from 'discord.js';
export const PERMISSIONS=['ViewChannel','SendMessages','ReadMessageHistory','EmbedLinks','AttachFiles','AddReactions','UseExternalEmojis','UseApplicationCommands','Connect','Speak','Stream','UseVAD','ChangeNickname','ManageNicknames','ManageMessages','ManageThreads','CreatePublicThreads','CreatePrivateThreads','SendMessagesInThreads','ModerateMembers','KickMembers','BanMembers','ManageChannels','ManageRoles','ManageGuild','ViewAuditLog','MentionEveryone','Administrator'];
const fail=text=>{throw new Error(`Invalid server plan: ${text}`);};
function object(o,keys) {if(!o || typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('unexpected fields. Please describe roles, categories, and text/voice channels only.');}
function str(v,min,max,label) {if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\x00-\x1f<>@]/.test(v))fail(`invalid ${label}.`);return v.trim();}
function list(v,max,label) {if(!Array.isArray(v)||v.length>max)fail(`${label} exceeds its limit of ${max}.`);return v;}
function unique(items,label) {if(new Set(items).size!==items.length)fail(`duplicate ${label}.`);}
export const canonical=s=>s.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g,'-').trim();
export function validatePlan(raw) {
  object(raw,['roles','categories','channels']);
  const keys=new Set();
  const key=k=>{k=str(k,1,32,'key');if(!/^[a-z][a-z0-9_]*$/.test(k)||k==='everyone'||keys.has(k))fail('keys must be unique lowercase identifiers.');keys.add(k);return k;};
  const roles=list(raw.roles,15,'roles').map(r=>{
    object(r,['key','name','color','permissions']);
    const permissions=list(r.permissions,PERMISSIONS.length,'permissions');unique(permissions,'permissions');
    if(permissions.some(p=>!PERMISSIONS.includes(p)))fail('unsupported role permission.');
    if(!/^#[0-9a-f]{6}$/i.test(r.color))fail('role colors must use #RRGGBB.');
    return {key:key(r.key),name:str(r.name,1,100,'role name'),color:r.color,permissions};
  });
  unique(roles.map(r=>canonical(r.name)),'role names');
  const roleKeys=new Set(['everyone',...roles.map(r=>r.key)]);
  const access=(v,label)=>{
    const a=list(v,16,label);unique(a,label);
    if(a.some(k=>!roleKeys.has(k)))fail(`unknown role in ${label}.`);
    if(a.includes('everyone')&&a.length>1)fail(`use everyone alone in ${label}.`);
    return [...a];
  };
  const categories=list(raw.categories,10,'categories').map(c=>{
    object(c,['key','name','view']);return {key:key(c.key),name:str(c.name,1,100,'category name'),view:access(c.view,'category visibility')};
  });
  unique(categories.map(c=>canonical(c.name)),'category names');
  const channels=list(raw.channels,25,'channels').map(c=>{
    object(c,['key','name','type','category','topic','view','post','connect','slowmode']);
    if(!['text','voice'].includes(c.type))fail('only text and voice channels are supported.');
    const parent=categories.find(p=>p.key===c.category);if(!parent)fail('every channel must reference a planned category.');
    const name=str(c.name,1,100,'channel name');
    if(c.type==='text'&&!/^[\p{L}\p{N}_-]+$/u.test(name))fail('text channel names must use letters, digits, hyphens or underscores.');
    const view=access(c.view,'channel visibility'),post=access(c.post,'posting access'),connect=access(c.connect,'voice access');
    if(!parent.view.includes('everyone')&&view.some(r=>!parent.view.includes(r)))fail('a private category cannot contain a channel visible to a broader audience.');
    for(const a of [post,connect])if(!view.includes('everyone')&&a.some(r=>!view.includes(r)))fail('posting and voice access must be limited to viewers.');
    if(c.type==='text'&&connect.length)fail('text channels cannot grant voice access.');
    if(c.type==='voice'&&post.length)fail('voice channel text chat is disabled in this builder.');
    if(!Number.isInteger(c.slowmode)||c.slowmode<0||c.slowmode>21600)fail('slow mode must be 0–21600 seconds.');
    const topic=c.topic===''?'':str(c.topic,1,1024,'topic');
    return {key:key(c.key),name,type:c.type,category:c.category,topic,view,post,connect,slowmode:c.slowmode};
  });
  if(!channels.length)fail('include at least one channel.');
  unique(channels.map(c=>`${c.type}:${canonical(c.name)}`),'channel names of the same type');
  return {roles,categories,channels};
}
export async function requireBuilderAdmin(guild,user) {
  const owner=(await guild.fetch()).ownerId;
  if(user===owner)return;
  const member=await guild.members.fetch({user,force:true});
  if(!member.permissions.has(P.Administrator))throw new Error('Only the server owner or a server administrator can use the server builder.');
}
export const mask=names=>names.reduce((bits,n)=>bits|P[n],0n);
export async function preflight(guild,user,plan) {
  await requireBuilderAdmin(guild,user);
  const me=await guild.members.fetchMe({force:true});
  if(!me.permissions.has([P.ManageChannels,P.ManageRoles]))throw new Error('I need Manage Channels and Manage Roles to build this layout.');
  if(me.roles.highest.position<1)throw new Error('Move my role above @everyone before building.');
  for(const r of plan.roles)if(!me.permissions.has(mask(r.permissions)))throw new Error(`I cannot grant the permissions planned for ${r.name}. Give me those permissions or change the plan.`);
  // Channel overwrites may only allow/deny capabilities available to the bot.
  const needed=['ViewChannel','ReadMessageHistory','SendMessages','EmbedLinks','SendMessagesInThreads','CreatePublicThreads','CreatePrivateThreads'];
  if(plan.channels.some(c=>c.type==='voice'))needed.push('Connect','Speak');
  if(!me.permissions.has(mask(needed)))throw new Error(`For this plan I need these channel permissions: ${needed.join(', ')}.`);
  const [roles,channels]=await Promise.all([guild.roles.fetch(),guild.channels.fetch()]);
  if(roles.size+plan.roles.length>250 || channels.size+plan.categories.length+plan.channels.length>500)throw new Error('This plan would exceed Discord’s role or channel limit.');
  for(const r of plan.roles)if([...roles.values()].some(o=>canonical(o.name)===canonical(r.name)))throw new Error(`A role named “${r.name}” already exists. Change the plan to use a new name; existing roles will not be modified.`);
  for(const c of [...plan.categories,...plan.channels])if([...channels.values()].filter(Boolean).some(o=>o.type===(c.type==='text'?ChannelType.GuildText:c.type==='voice'?ChannelType.GuildVoice:ChannelType.GuildCategory)&&canonical(o.name)===canonical(c.name)))throw new Error(`A channel/category named “${c.name}” already exists. Change the plan to avoid duplicating it.`);
  return me;
}
export function overwrites(plan,item,guildId,botId,ids) {
  const view=item.view,post=item.post || [],connect=item.connect || [];
  const rules=[['ViewChannel',view],['ReadMessageHistory',view],['SendMessages',post],['SendMessagesInThreads',post],['CreatePublicThreads',[]],['CreatePrivateThreads',[]]];
  if(item.type==='voice'){rules.push(['Connect',connect],['Speak',connect]);}
  const out=[{id:guildId,type:0,allow:[],deny:[]}];
  for(const [perm,allowed] of rules)out[0][allowed.includes('everyone')?'allow':'deny'].push(P[perm]);
  for(const role of plan.roles) {
    const allow=rules.filter(([,allowed])=>allowed.includes(role.key)).map(([perm])=>P[perm]);
    if(allow.length)out.push({id:ids[role.key],type:0,allow,deny:[]});
  }
  out.push({id:botId,type:1,allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.EmbedLinks],deny:[]});
  return out;
}
export function channelOptions(plan,item,guild,botId,ids) {
  const isCategory=!item.type;
  return {name:item.name,type:isCategory?ChannelType.GuildCategory:item.type==='text'?ChannelType.GuildText:ChannelType.GuildVoice,
    ...(isCategory?{}:{parent:ids[item.category],...(item.type==='text'?{topic:item.topic,rateLimitPerUser:item.slowmode}:{})}),
    permissionOverwrites:overwrites(plan,item,guild.id,botId,ids)};
}
