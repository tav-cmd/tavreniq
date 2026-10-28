import {escapeMarkdown} from 'discord.js';
export const allowedMentions={parse:[],repliedUser:false};
const esc=s=>escapeMarkdown(String(s));
const button=(id,label,style=2,disabled=false)=>({type:2,custom_id:id,label,style,disabled});
export function previewPages(s) {
  const p=s.plan,names=new Map([['everyone','@everyone'],...p.roles.map(r=>[r.key,r.name])]);
  const access=a=>a.length?a.map(k=>esc(names.get(k))).join(', '):'No ordinary members (administrators can still access)';
  const blocks=[`**Build inside this server** • ${p.roles.length} new roles, ${p.categories.length} categories, ${p.channels.length} channels.\nExisting objects are preserved. No roles will be assigned to members. Review every page before Build.\nOnly text/voice channels are supported. Administrator always bypasses channel restrictions.\nExpires <t:${Math.floor(s.expires/1000)}:R>.`,
    ...p.roles.map(r=>`**Role: ${esc(r.name)}** • ${r.color}\nPermissions: ${r.permissions.join(', ') || 'None'}${r.permissions.includes('Administrator')?'\n⚠ Administrator grants full server access and bypasses private channels.':''}`),
    ...p.categories.map(c=>`**Category: ${esc(c.name)}**\nView: ${access(c.view)}`),
    ...p.channels.map(c=>`**${c.type==='voice'?'Voice':'Text'}: ${esc(c.name)}** in ${esc(p.categories.find(x=>x.key===c.category).name)}\nView: ${access(c.view)}\n${c.type==='text'?`Post: ${access(c.post)}\nSlow mode: ${c.slowmode}s${c.topic?'\nTopic: '+esc(c.topic):''}`:`Connect / Speak: ${access(c.connect)}`}\nNew threads disabled.`)];
  const full=blocks.join('\n\n'),pages=[];
  for(let n=0;n<full.length;n+=3500)pages.push(full.slice(n,n+3500));
  return pages;
}
export function preview(s,page=0) {
  const pages=previewPages(s);page=Math.min(pages.length-1,Math.max(0,Number.isSafeInteger(page)?page:0));
  return {content:'',embeds:[{color:0x3366ee,title:'TAVRENIQ • Server layout preview',description:pages[page],footer:{text:`Page ${page+1}/${pages.length} • Requested by ${s.requester}`}}],
    components:[{type:1,components:[button(`sb:page:${s.id}:${page-1}`,'Previous',2,page===0),button(`sb:page:${s.id}:${page+1}`,'Next',2,page===pages.length-1),button(`sb:build:${s.id}`,'Build',3),button(`sb:change:${s.id}`,'Change plan'),button(`sb:cancel:${s.id}`,'Cancel',4)]}],allowedMentions};
}
export function report(s) {
  const counts={role:0,category:0,channel:0};for(const r of s.result)counts[r.kind]++;
  const lines=s.result.map(r=>`${r.kind}: ${r.name} (${r.id})`);
  const content=`**TAVRENIQ server builder: ${s.status}**\nCreated: ${counts.role} roles, ${counts.category} categories, ${counts.channel} channels.\n${s.error || ''}${s.pending?'\nLast request needing inspection: '+s.pending:''}\nExisting objects were preserved. New roles are unassigned. Use /create status to retrieve this report.`;
  return {content,embeds:[],components:[],allowedMentions,
    ...(lines.length?{files:[{attachment:Buffer.from(`Build ${s.id}\nStatus: ${s.status}\n${lines.join('\n')}\n${s.error || ''}\nPending: ${s.pending || 'none'}\n`),name:'tavreniq-build-report.txt'}]}:{})};
}
