import {ActivityType,Client,GatewayIntentBits as I,Events,MessageFlags,PermissionFlagsBits as P} from 'discord.js';
import {createServer} from 'node:http';
import {register} from './register.js';
import {moderate} from './moderation.js';
import {parseAction} from './policy.js';
import {ask,forget} from './ai.js';
import {close} from './store.js';
if(!process.env.DISCORD_TOKEN) {console.error('Set DISCORD_TOKEN before starting. See README.md.');process.exit(1);}
const client=new Client({intents:[I.Guilds,I.GuildMessages,I.MessageContent],allowedMentions:{parse:[],repliedUser:false}});
let commandsReady=false;
const server=createServer((req,res)=>{
  if(req.url!=='/api/healthz'){res.writeHead(404);res.end('Not found');return;}
  const ready=client.isReady() && commandsReady;
  res.writeHead(ready?200:503,{'Content-Type':'application/json'});
  res.end(JSON.stringify({status:ready?'ready':'starting',discord:client.isReady(),uptime:Math.floor(process.uptime())}));
}).listen(Number(process.env.PORT)||3000,'0.0.0.0');
const help=`**TAVRENIQ · Moderation & AI**
**AI:** /ask, /forget — or mention me, say “Tavreniq” / “Tav”, or reply to my message.
**Moderation:** /warn, /warnings, /timeout, /untimeout, /kick, /ban, /unban, /purge, /role
**Utility:** /help, /ping, /invite
**Text commands:** Tav timeout @member 10m reason; Tav warn @member reason; Tav kick @member reason; Tav ban @member reason; Tav untimeout @member
Permissions and role hierarchy apply to every moderation action.
AI messages and your display/server names are sent to Google Gemini. Conversation memory expires after 30 minutes of inactivity or on restart. /forget clears your memory here. Private /ask memory is separate from public chat.`;
const chunks = value => value.match(/[\s\S]{1,1900}/g) || ['No response.'];
function safeError(error) {
  // API errors can contain request details: never echo raw Discord/network errors.
  if(error.code || error.name==='TypeError' || error.name==='DiscordAPIError') return 'The action failed. Check my Discord permissions and role position, then try again.';
  return error.message || 'Something went wrong. Please try again.';
}
client.once(Events.ClientReady,async ready=>{
  try {
    await register(ready.user.id);commandsReady=true;
    ready.user.setPresence({
      status: 'online',
      activities: [{name: 'Custom Status', type: ActivityType.Custom, state: 'tavreniq.bot'}]
    });
    console.log(`TAVRENIQ online as ${ready.user.tag}.`);
  } catch(error) {console.error('Command registration failed:',error.code || error.name);shutdown(1);}
});
client.on(Events.InteractionCreate,async i=>{
  if(!i.isChatInputCommand() || !i.inGuild()) return;
  try {
    await i.deferReply({flags:MessageFlags.Ephemeral});
    let result;
    if(i.commandName==='help') result=help;
    else if(i.commandName==='ping') result=`Online. Gateway latency: ${client.ws.ping} ms.`;
    else if(i.commandName==='invite') {
      const permissions=P.ViewChannel|P.SendMessages|P.ReadMessageHistory|P.ModerateMembers|P.KickMembers|P.BanMembers|P.ManageMessages|P.ManageRoles;
      result=`https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot%20applications.commands&permissions=${permissions}`;
    } else if(i.commandName==='forget') {forget(i.guildId,i.channelId,i.user.id);result='Your AI conversation memory in this channel has been cleared.';}
    else if(i.commandName==='ask') result=await ask({guild:i.guildId,channel:i.channelId,user:i.user.id,mode:'private',prompt:i.options.getString('message'),displayName:i.user.username,serverName:i.guild.name});
    else result=await moderate(i.guild,i.channel,i.user.id,{
      action:i.commandName,userId:i.options.getUser('user')?.id || i.options.getString('user_id'),
      reason:i.options.getString('reason'),duration:i.options.getString('duration'),count:i.options.getInteger('count'),
      roleId:i.options.getRole('role')?.id,roleAction:i.options.getString('action')
    });
    const parts=chunks(result);
    await i.editReply({content:parts.shift(),allowedMentions:{parse:[]}});
    for(const content of parts) await i.followUp({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  } catch(error) {
    console.error('Interaction failed:',error.code || error.name);
    const payload={content:safeError(error).slice(0,1900),allowedMentions:{parse:[]}};
    if(i.deferred || i.replied) await i.editReply(payload).catch(()=>{});
    else await i.reply({...payload,flags:MessageFlags.Ephemeral}).catch(()=>{});
  }
});
client.on(Events.MessageCreate,async m=>{
  if(!m.guild || m.author.bot || m.webhookId) return;
  let ticker;
  try {
    const prefix=new RegExp(`^(?:<@!?${client.user.id}>|tavreniq\\b|tav\\b)[\\s,:]*`,'i');
    const triggered=prefix.test(m.content);
    let replyToBot=false;
    if(!triggered && m.reference?.messageId) {
      const replied=await m.channel.messages.fetch(m.reference.messageId).catch(()=>null);
      replyToBot=replied?.author.id===client.user.id;
    }
    if(!triggered && !replyToBot) return;
    const prompt=(triggered?m.content.replace(prefix,''):m.content).trim();
    if(!prompt) {await m.reply('Hi! Ask me something, or use /help.');return;}
    if(/^help$/i.test(prompt)) {await m.reply(help);return;}
    const action=parseAction(prompt);
    if(action) {await m.reply(await moderate(m.guild,m.channel,m.author.id,action));return;}
    // Malformed moderation requests never go to the language model.
    if(/^(timeout|untimeout|kick|ban|warn|purge|unban|role)\b/i.test(prompt)) {await m.reply('Use the matching slash command, or “Tav timeout @member 10m reason”.');return;}
    await m.channel.sendTyping();
    ticker=setInterval(()=>m.channel.sendTyping().catch(()=>{}),8000);
    const answer=await ask({guild:m.guild.id,channel:m.channel.id,user:m.author.id,prompt,displayName:m.member?.displayName || m.author.username,serverName:m.guild.name});
    for(const content of chunks(answer)) await m.reply({content,allowedMentions:{parse:[],repliedUser:false}});
  } catch(error) {
    console.error('Message failed:',error.code || error.name);
    await m.reply({content:safeError(error).slice(0,1900),allowedMentions:{parse:[],repliedUser:false}}).catch(()=>{});
  } finally {if(ticker) clearInterval(ticker);}
});
client.on(Events.Error,error=>console.error('Discord connection error:',error.code || error.name));
let stopping=false;
function shutdown(code=0) {
  if(stopping)return;stopping=true;commandsReady=false;
  client.destroy();close();server.close(()=>process.exit(code));
  setTimeout(()=>process.exit(code),3000).unref();
}
process.on('SIGTERM',()=>shutdown());process.on('SIGINT',()=>shutdown());
client.login(process.env.DISCORD_TOKEN).catch(error=>{console.error('Discord login failed:',error.code || error.name);shutdown(1);});
