import {randomUUID} from 'node:crypto';
import {MessageFlags,ChannelType,PermissionFlagsBits as P} from 'discord.js';
import {generatePlan} from './planner.js';
import {requireBuilderAdmin,preflight,validatePlan,mask,channelOptions,canonical} from './plan.js';
import {preview,report,allowedMentions} from './views.js';

export function parseBuildRequest(text) {
  const m=text.trim().match(/^(?:please\s+)?(?:create|build|setup|set up)\s+(?:a\s+|the\s+)?server\b[\s:,-]*(.*)$/is);
  return m?m[1].trim():null;
}
export async function executeBuild(store,s,guild,{progress=async()=>{},stopping=()=>false}={}) {
  const ids={};
  const plan=validatePlan(s.plan);
  const tasks=[...plan.roles.map(item=>({kind:'role',item})),...plan.categories.map(item=>({kind:'category',item})),...plan.channels.map(item=>({kind:'channel',item}))];
  let lastProgress=0;
  try {
    for(let n=0;n<tasks.length;n++) {
      if(stopping())throw new Error('Bot is restarting. Inspect the saved report before trying again.');
      await requireBuilderAdmin(guild,s.requester);
      const me=await guild.members.fetchMe({force:true});
      if(!me.permissions.has([P.ManageChannels,P.ManageRoles]))throw new Error('My Manage Channels or Manage Roles permission was removed.');
      const {kind,item}=tasks[n];
      const objects=await (kind==='role'?guild.roles.fetch():guild.channels.fetch());
      if([...objects.values()].filter(Boolean).some(o=>(kind==='role'||(o.type===(kind==='category'?ChannelType.GuildCategory:item.type==='text'?ChannelType.GuildText:ChannelType.GuildVoice)&&(kind!=='channel'||(o.parentId ?? o.parent)===ids[item.category])))&&canonical(o.name)===canonical(item.name)))throw new Error(`An object named ${item.name} now exists. Stopping to avoid duplication.`);
      if(kind==='role'&&!me.permissions.has(mask(item.permissions)))throw new Error(`I no longer have the permissions required for role ${item.name}.`);
      store.pending(s.id,`${kind}: ${item.name}`); // Journal before sending a mutating request.
      const reason=`TAVRENIQ builder ${s.id}; approved by ${s.requester}`;
      let created;
      if(kind==='role')created=await guild.roles.create({name:item.name,colors:{primaryColor:parseInt(item.color.slice(1),16)},permissions:mask(item.permissions),hoist:false,mentionable:false,reason});
      else created=await guild.channels.create({...channelOptions(plan,item,guild,me.id,ids),reason});
      ids[item.key]=created.id;
      store.record(s.id,{kind,key:item.key,name:item.name,id:created.id});
      if(Date.now()-lastProgress>=3000 || n===tasks.length-1) {
        lastProgress=Date.now();await progress(`Building: ${n+1}/${tasks.length} objects created.`).catch(()=>{});
      }
    }
    store.close(s.id,'completed');
  } catch(error) {
    const reason=error.code?`Discord request failed (${error.code}). Check permissions, role hierarchy and server limits; inspect the last request before retrying.`:
      (error.name==='Error'?error.message:'An unexpected error stopped this build.');
    store.close(s.id,'failed',reason.slice(0,600));
  }
  return store.get(s.id);
}
export class ServerBuilder {
  constructor(store,{planner=generatePlan,now=Date.now,logger=console}={}) {
    this.store=store;this.planner=planner;this.now=now;this.logger=logger;
    this.waiting=new Map();this.planning=new Set();this.cooldowns=new Map();this.closed=false;
  }
  key(g,c,u) {return `${g}:${c}:${u}`;}
  hasPending(m) {
    for(const [k,v]of this.waiting)if(v<=this.now())this.waiting.delete(k);
    return this.waiting.has(this.key(m.guild.id,m.channel.id,m.author.id));
  }
  async makePlan(guild,channel,user,prompt,send) {
    if(this.closed)throw new Error('TAVRENIQ is restarting. Try again shortly.');
    await requireBuilderAdmin(guild,user);
    if(typeof prompt!=='string'||prompt.trim().length<5||prompt.length>3500)throw new Error('Describe your server in 5–3,500 characters.');
    const key=`${guild.id}:${user}`;
    for(const [k,v]of this.cooldowns)if(v<=this.now())this.cooldowns.delete(k);
    if(this.planning.has(key)||this.planning.size>=4)throw new Error('A plan is still being generated. Please wait.');
    if(this.cooldowns.has(key))throw new Error('Please wait 30 seconds between server-plan requests.');
    if(this.store.busy(guild.id))throw new Error('A server build is already running here. Use /create status.');
    const id=randomUUID(),s={id,guild:guild.id,channel:channel.id,requester:user,prompt,created:this.now(),expires:this.now()+600000};
    this.planning.add(key);this.cooldowns.set(key,this.now()+30000);
    this.store.create(s);
    try {
      const plan=validatePlan(await this.planner(prompt));
      if(this.closed)return;
      this.store.preview(id,plan,this.now()+600000);
      await send(preview(this.store.get(id)));
    } catch(error) {
      if(!this.closed)this.store.close(id,'failed','Could not generate or deliver the preview.');
      throw error;
    } finally {this.planning.delete(key);}
  }
  async handleMessage(m,text,{addressed=true}={}) {
    const request=addressed?parseBuildRequest(text):null,pending=this.hasPending(m);
    if(request===null&&!pending)return false;
    const key=this.key(m.guild.id,m.channel.id,m.author.id);
    try {
      await requireBuilderAdmin(m.guild,m.author.id);
      if(pending && /^cancel[.!]?$/i.test(text.trim())) {this.waiting.delete(key);await m.reply({content:'Server setup cancelled.',allowedMentions});return true;}
      const prompt=request===null?text:request;
      if(!prompt) {
        if(this.waiting.size>=1000)this.waiting.delete(this.waiting.keys().next().value);
        this.waiting.set(key,this.now()+300000);
        await m.reply({content:'Describe the server layout you want: roles, categories, text/voice channels, and who can access them. Reply here within 5 minutes, or say “cancel”. Your description goes to Gemini to create a preview; nothing is built until you approve.',allowedMentions});
        return true;
      }
      this.waiting.delete(key);
      const message=await m.reply({content:'Preparing your server layout preview…',allowedMentions});
      await this.makePlan(m.guild,m.channel,m.author.id,prompt,payload=>message.edit(payload));
    } catch(error) {
      await m.reply({content:this.errorText(error),allowedMentions}).catch(()=>{});
    }
    return true;
  }
  errorText(error) {
    this.logger.error('Server builder:',error.code || error.name);
    return error.code?'Discord could not complete the builder request. Check my permissions and try again.':
      error.name==='TimeoutError'?'Plan generation timed out. Please try again.':
      error.name==='Error'?error.message.slice(0,1800):'The builder could not complete that request. Please try again.';
  }
  owns(i) {
    return (i.isChatInputCommand()&&i.commandName==='create') ||
      ((i.isButton()||i.isModalSubmit())&&i.customId.startsWith('sb:'));
  }
  session(i,id) {
    const s=this.store.get(id);
    if(!s || s.guild!==i.guildId || s.channel!==i.channelId || s.requester!==i.user.id)throw new Error('Only the original requester can use this plan, in its original channel.');
    return s;
  }
  async handle(i) {
    if(!this.owns(i))return false;
    try {
      if(!i.inGuild())throw new Error('Use the server builder in a server channel.');
      if(this.closed)throw new Error('TAVRENIQ is restarting. Try again shortly.');
      const [,action,id,rawPage]=i.customId?.split(':') || [];
      if(i.isButton()&&action==='change') {
        const s=this.session(i,id);
        if(s.status!=='preview'||s.expires<=this.now())throw new Error('This preview expired or was already used. Start a new plan.');
        // Opening a modal acknowledges the button immediately; authorization is refreshed on submission.
        await i.showModal({custom_id:`sb:revise:${id}`,title:'Change server layout',components:[{type:1,components:[{type:4,custom_id:'prompt',label:'Describe the complete revised layout',style:2,required:true,min_length:5,max_length:3500,value:s.prompt}]}]});
        this.store.cancel(id);return true;
      }
      if(i.isButton()&&action==='page')await i.deferUpdate();
      else await i.deferReply({flags:MessageFlags.Ephemeral});
      await requireBuilderAdmin(i.guild,i.user.id);
      if(i.isModalSubmit()) {
        if(action!=='revise')throw new Error('Unknown builder form.');
        const s=this.session(i,id);
        if(s.status!=='cancelled')throw new Error('That plan has already been used.');
        await this.makePlan(i.guild,i.channel,i.user.id,i.fields.getTextInputValue('prompt'),p=>i.editReply(p));return true;
      }
      if(i.isChatInputCommand()) {
        if(i.options.getSubcommand()==='status') {
          const s=this.store.latest(i.guildId);if(!s)throw new Error('No server builds have been requested here yet.');
          await i.editReply(report(s));return true;
        }
        await this.makePlan(i.guild,i.channel,i.user.id,i.options.getString('prompt',true),p=>i.editReply(p));return true;
      }
      const s=this.session(i,id);
      if(s.status!=='preview'||s.expires<=this.now())throw new Error('This preview expired or was already used. Start a new plan or use /create status.');
      if(action==='page') {await i.editReply(preview(s,Number(rawPage)));return true;}
      if(action==='cancel') {this.store.cancel(id);await i.editReply({content:'Plan cancelled. Nothing was built.',allowedMentions});return true;}
      if(action!=='build')throw new Error('Unknown server builder button.');
      const plan=validatePlan(s.plan);
      await preflight(i.guild,i.user.id,plan);
      if(this.store.busy(i.guildId))throw new Error('A build is already running in this server.');
      if(!this.store.claim(id,this.now()))throw new Error('This plan was already used or has expired.');
      // No interaction tokens are used for the long-running build itself.
      let progress;
      try {
        await i.editReply({content:'Approved. Building now; progress will appear in this channel.',allowedMentions});
        progress=await i.channel.send({content:'TAVRENIQ • Building your approved server layout…',allowedMentions});
      } catch(error) {this.store.close(id,'failed','Could not post progress; no build requests were made.');throw error;}
      const done=await executeBuild(this.store,s,i.guild,{progress:content=>progress.edit({content,allowedMentions}),stopping:()=>this.closed});
      if(!this.closed) {
        const final=report(done);
        await progress.edit(final).catch(()=>progress.edit({content:final.content+'\nDetailed report: /create status.',embeds:[],components:[],allowedMentions}).catch(()=>{}));
      }
    } catch(error) {
      const payload={content:this.errorText(error),allowedMentions};
      // A public pagination message must not be overwritten with another user's error.
      if(i.isButton()&&i.customId.startsWith('sb:page:')&&i.deferred)await i.followUp({...payload,flags:MessageFlags.Ephemeral}).catch(()=>{});
      else if(i.deferred||i.replied)await i.editReply(payload).catch(()=>{});
      else await i.reply({...payload,flags:MessageFlags.Ephemeral}).catch(()=>{});
    }
    return true;
  }
  async recover(client) {
    for(const s of this.store.recover())try {
      const channel=await client.channels.fetch(s.channel);
      if(channel?.guildId===s.guild)await channel.send(report(s));
    }catch(error){this.logger.error('Builder recovery report failed:',error.code || error.name);}
  }
  shutdown() {this.closed=true;this.waiting.clear();}
}
