import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {PermissionFlagsBits as P,PermissionsBitField,ChannelType,EmbedBuilder,MessageFlags} from 'discord.js';
import {validatePlan,overwrites,preflight,requireBuilderAdmin} from '../src/builder/plan.js';
import {generatePlan} from '../src/builder/planner.js';
import {createBuilderStore} from '../src/builder/storage.js';
import {ServerBuilder,executeBuild,parseBuildRequest} from '../src/builder/service.js';
import {preview,previewPages} from '../src/builder/views.js';
import {commands} from '../src/commands.js';
const plan=()=>({roles:[{key:'staff',name:'Staff',color:'#3366ee',permissions:['ManageMessages']}],
  categories:[{key:'community',name:'Community',view:['everyone']},{key:'staffarea',name:'Staff Area',view:['staff']}],
  channels:[{key:'rules',name:'rules',type:'text',category:'community',topic:'Read the rules',view:['everyone'],post:['staff'],connect:[],slowmode:0},
    {key:'staffchat',name:'staff-chat',type:'text',category:'staffarea',topic:'Staff discussion',view:['staff'],post:['staff'],connect:[],slowmode:0},
    {key:'voice',name:'Lounge',type:'voice',category:'community',topic:'',view:['everyone'],post:[],connect:['everyone'],slowmode:0}]});
function harness() {
  const db=new DatabaseSync(':memory:'),store=createBuilderStore(db),calls=[],channels=new Map(),roles=new Map();
  let serial=100,clock=1000;
  const guild={id:'guild',ownerId:'owner',fetch:async()=>guild,
    members:{fetch:async()=>({permissions:{has:()=>false}}),fetchMe:async()=>({id:'bot',permissions:new PermissionsBitField(P.Administrator),roles:{highest:{position:10}}})},
    roles:{fetch:async()=>roles,create:async opts=>{calls.push(['role',opts]);const r={id:String(++serial),name:opts.name};roles.set(r.id,r);return r;}},
    channels:{fetch:async()=>channels,create:async opts=>{calls.push(['channel',opts]);const c={id:String(++serial),...opts};channels.set(c.id,c);return c;}}};
  const channel={id:'source',guildId:'guild',sent:[],send:async p=>{const m={id:String(++serial),payload:p,edit:async next=>{m.payload=next;return m;}};channel.sent.push(m);return m;}};
  const service=new ServerBuilder(store,{planner:async()=>plan(),now:()=>clock,logger:{error:()=>{}}});
  function interaction({user='owner',command=false,sub='server',action='build',id,modal=false,channelId='source',guildId='guild'}={}) {
    const i={guildId,channelId,guild,channel,user:{id:user},commandName:'create',customId:command?undefined:`sb:${action}:${id}`,
      isChatInputCommand:()=>command,isButton:()=>!command&&!modal,isModalSubmit:()=>modal,inGuild:()=>true,
      options:{getSubcommand:()=>sub,getString:()=>'A community with public rules and private staff channels'},fields:{getTextInputValue:()=>'A new gaming community with staff channels'},
      outputs:[],deferReply:async o=>{i.initial=o;i.deferred=true;},deferUpdate:async()=>{i.deferred=true;},
      editReply:async p=>{i.outputs.push(p);},reply:async p=>{i.outputs.push(p);},followUp:async p=>{i.outputs.push(p);},showModal:async p=>{i.modal=p;}};
    return i;
  }
  async function previewPlan() {const i=interaction({command:true});await service.handle(i);const s=store.latest('guild');assert.equal(s.status,'preview',JSON.stringify(i.outputs));return s;}
  return {db,store,calls,guild,channel,channels,roles,service,interaction,previewPlan,setTime:t=>{clock=t;},close:()=>db.close()};
}
test('plan validates structure and rejects injected operations, privilege names and invalid access',()=>{
  assert.equal(validatePlan(plan()).channels.length,3);
  const cases=[];
  let p=plan();p.deleteAll=true;cases.push(p);
  p=plan();p.roles[0].permissions=['MadeUpPermission'];cases.push(p);
  p=plan();p.channels[1].view=['everyone'];cases.push(p);
  p=plan();p.channels[0].post=['unknown'];cases.push(p);
  p=plan();p.roles.push({...p.roles[0]});cases.push(p);
  p=plan();p.channels[0].name='@everyone';cases.push(p);
  p=plan();p.channels=Array.from({length:26},()=>p.channels[0]);cases.push(p);
  for(const bad of cases)assert.throws(()=>validatePlan(bad),/Invalid server plan/);
});
test('channel overwrite rules hide private channels and make announcements read-only before role grants',()=>{
  const p=validatePlan(plan()),ids={[p.roles[0].key]:'staffid'};
  const privateRules=overwrites(p,p.channels[1],'guild','bot',ids);
  assert.ok(privateRules[0].deny.includes(P.ViewChannel));
  assert.ok(privateRules.find(o=>o.id==='staffid').allow.includes(P.ViewChannel));
  assert.ok(privateRules.find(o=>o.id==='bot').allow.includes(P.ViewChannel));
  const publicRules=overwrites(p,p.channels[0],'guild','bot',ids);
  assert.ok(publicRules[0].allow.includes(P.ViewChannel));assert.ok(publicRules[0].deny.includes(P.SendMessages));
  assert.ok(publicRules[0].deny.includes(P.SendMessagesInThreads));assert.ok(publicRules[0].deny.includes(P.CreatePublicThreads));
  assert.ok(publicRules.find(o=>o.id==='staffid').allow.includes(P.SendMessages));
  const voice=overwrites(p,p.channels[2],'guild','bot',ids);assert.ok(voice[0].allow.includes(P.Connect));assert.ok(voice[0].allow.includes(P.Speak));
});
test('owner or actual Administrator required; Manage Server alone is insufficient',async()=>{
  const h=harness();try {
    await requireBuilderAdmin(h.guild,'owner');
    await assert.rejects(requireBuilderAdmin(h.guild,'other'),/Only the server owner/);
    h.guild.members.fetch=async()=>({permissions:new PermissionsBitField(P.ManageGuild)});
    await assert.rejects(requireBuilderAdmin(h.guild,'other'),/Only the server owner/);
    h.guild.members.fetch=async()=>({permissions:new PermissionsBitField(P.Administrator)});await requireBuilderAdmin(h.guild,'other');
  }finally{h.close();}
});
test('preflight refuses existing names and permissions the bot cannot grant',async()=>{
  const h=harness();try {
    await preflight(h.guild,'owner',plan());h.roles.set('old',{name:'Staff'});
    await assert.rejects(preflight(h.guild,'owner',plan()),/already exists/);h.roles.clear();
    h.guild.members.fetchMe=async()=>({permissions:new PermissionsBitField([P.ManageChannels,P.ManageRoles]),roles:{highest:{position:10}}});
    await assert.rejects(preflight(h.guild,'owner',plan()),/cannot grant/);
    assert.equal(h.calls.length,0);
  }finally{h.close();}
});
test('generation creates a preview only; confirmed build creates objects once and preserves old objects',async()=>{
  const h=harness();try {
    h.roles.set('old-role',{id:'old-role',name:'Old role'});h.channels.set('old-channel',{id:'old-channel',name:'old-chat',type:0});
    const s=await h.previewPlan();assert.equal(h.calls.length,0);
    const a=h.interaction({id:s.id}),b=h.interaction({id:s.id});await Promise.all([h.service.handle(a),h.service.handle(b)]);
    assert.equal(h.store.get(s.id).status,'completed');assert.equal(h.calls.length,6);assert.equal(h.store.get(s.id).result.length,6);
    assert.ok(h.roles.has('old-role'));assert.ok(h.channels.has('old-channel'));
    const privateCall=h.calls.find(([,o])=>o.name==='staff-chat')[1];assert.ok(privateCall.parent);assert.ok(privateCall.permissionOverwrites[0].deny.includes(P.ViewChannel));
    assert.equal(a.initial.flags,MessageFlags.Ephemeral);
    assert.ok(h.channel.sent.at(-1).payload.files[0].attachment.toString().includes('completed'));
  }finally{h.close();}
});
test('another requester, another channel and expired plans cannot build',async()=>{
  const h=harness();try {
    const s=await h.previewPlan();
    for(const opts of [{user:'intruder'},{channelId:'elsewhere'}]){const i=h.interaction({id:s.id,...opts});await h.service.handle(i);assert.equal(h.calls.length,0);}
    h.setTime(s.expires+1);const i=h.interaction({id:s.id});await h.service.handle(i);assert.equal(h.calls.length,0);assert.match(i.outputs.at(-1).content,/expired/);
  }finally{h.close();}
});
test('permission revoked after preview prevents any creation',async()=>{
  const h=harness();try {
    const s=await h.previewPlan();h.guild.ownerId='newowner';const i=h.interaction({id:s.id});await h.service.handle(i);
    assert.equal(h.calls.length,0);assert.equal(h.store.get(s.id).status,'preview');
  }finally{h.close();}
});
test('cancel and Change plan invalidate old confirmation buttons',async()=>{
  const h=harness();try {
    const s=await h.previewPlan();const change=h.interaction({id:s.id,action:'change'});await h.service.handle(change);assert.ok(change.modal);assert.equal(h.store.get(s.id).status,'cancelled');
    await h.service.handle(h.interaction({id:s.id}));assert.equal(h.calls.length,0);
    h.setTime(40000);const form=h.interaction({id:s.id,action:'revise',modal:true});await h.service.handle(form);
    const next=h.store.latest('guild');assert.notEqual(next.id,s.id);assert.equal(next.status,'preview');
    await h.service.handle(h.interaction({id:next.id,action:'cancel'}));assert.equal(h.store.get(next.id).status,'cancelled');assert.equal(h.calls.length,0);
  }finally{h.close();}
});
test('partial Discord failure retains created IDs and does not retry or delete',async()=>{
  const h=harness();try {
    const s=await h.previewPlan();h.guild.channels.create=async()=>{throw {code:50013};};await h.service.handle(h.interaction({id:s.id}));
    const done=h.store.get(s.id);assert.equal(done.status,'failed');assert.equal(done.result.length,1);assert.ok(done.pending);assert.equal(h.roles.size,1);
    await h.service.handle(h.interaction({id:s.id}));assert.equal(h.roles.size,1);
  }finally{h.close();}
});
test('database lock permits one build per guild and restart interrupts rather than replays',async()=>{
  const h=harness();try {
    const s=await h.previewPlan();h.store.claim(s.id,1001);
    h.store.create({id:'second',guild:'guild',requester:'owner',channel:'source',prompt:'test prompt',created:1,expires:10000});
    h.store.preview('second',plan(),10000);assert.throws(()=>h.store.claim('second',1002));
    const recovered=h.store.recover();assert.equal(recovered.length,1);assert.equal(h.store.get(s.id).status,'interrupted');assert.equal(h.calls.length,0);
    assert.equal(h.store.claim(s.id,1003),false);
  }finally{h.close();}
});
test('text flow asks for prompt, restricts requester and supports cancellation',async()=>{
  const h=harness();try {
    assert.equal(parseBuildRequest('create a server'),'');assert.equal(parseBuildRequest('build a server for gaming'),'for gaming');assert.equal(parseBuildRequest('who owns this server'),null);
    const replies=[],m={guild:h.guild,channel:h.channel,author:{id:'owner'},reply:async p=>{replies.push(p);return {edit:async p=>replies.push(p)};}};
    await h.service.handleMessage(m,'create a server');assert.ok(h.service.hasPending(m));assert.match(replies[0].content,/Describe/);
    assert.equal(h.service.hasPending({...m,author:{id:'another'}}),false);
    await h.service.handleMessage(m,'A community with private staff channels',{addressed:false});assert.equal(h.store.latest('guild').status,'preview');assert.equal(h.calls.length,0);
    await h.service.handleMessage(m,'create a server');await h.service.handleMessage(m,'cancel',{addressed:false});assert.equal(h.service.hasPending(m),false);
  }finally{h.close();}
});
test('planner handles malformed JSON, rate limits and valid responses without Discord mutations',async()=>{
  const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
  try {
    await assert.rejects(generatePlan('Build a community',{fetcher:async()=>({ok:false,status:429})}),/quota/);
    await assert.rejects(generatePlan('Build a community',{fetcher:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'not JSON'}]}}]})})}),/JSON/);
    const result=await generatePlan('Build a community',{fetcher:async(url,options)=>{assert.equal(JSON.parse(options.body).generationConfig.responseMimeType,'application/json');return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(plan())}]}}]})};}});
    assert.equal(result.channels.length,3);
  }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('preview includes access and permissions, paginates within embed limits; command is admin-only',()=>{
  const p=plan();for(let n=0;n<12;n++)p.roles.push({key:'role'+n,name:'Role '+n,color:'#123456',permissions:['ViewChannel','SendMessages']});
  for(let n=0;n<20;n++)p.channels.push({...p.channels[0],key:'channel'+n,name:'channel-'+n,topic:'Topic '.repeat(150)});
  const s={id:'id',requester:'owner',expires:9000,plan:validatePlan(p)};
  assert.ok(previewPages(s).length>1);
  for(let n=0;n<previewPages(s).length;n++){const v=preview(s,n);new EmbedBuilder(v.embeds[0]).toJSON();assert.ok(v.embeds[0].description.length<=3500);assert.equal(v.components[0].components.length,5);}
  const command=commands.find(c=>c.name==='create');assert.equal(command.default_member_permissions,P.Administrator.toString());assert.equal(command.options[0].options[0].name,'prompt');assert.equal(command.options[0].options[0].required,true);
});
test('same-named channels in different categories are normalized and built without dropping either',async()=>{
  const h=harness();try {
    const p=plan();p.channels[0].name='general';p.channels[1].name='general';
    p.channels[0].key='general';p.channels[1].key='general';
    h.service.planner=async()=>p;
    h.channels.set('existing',{id:'existing',name:'general',type:0,parentId:'old-category'});
    const s=await h.previewPlan();assert.equal(s.plan.channels.length,3);
    await h.service.handle(h.interaction({id:s.id}));
    assert.equal(h.store.get(s.id).status,'completed');
    const created=h.calls.filter(([kind,o])=>kind==='channel'&&o.name==='general');
    assert.equal(created.length,2);assert.notEqual(created[0][1].parent,created[1][1].parent);
    assert.ok(created[1][1].permissionOverwrites[0].deny.includes(P.ViewChannel));
    assert.ok(h.channels.has('existing'));
  }finally{h.close();}
});
