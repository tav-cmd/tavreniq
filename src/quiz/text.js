import {PermissionFlagsBits as P} from 'discord.js';
import {noMentions} from './views.js';
export async function requireQuizAdmin(guild,user) {
  if(user===guild.ownerId) return;
  const member=await guild.members.fetch({user,force:true});
  if(!member.permissions.has(P.Administrator)) throw new Error('Only the server owner or a server administrator can start a quiz.');
}
export function parseQuizStart(text) {
  const s=text.trim().replace(/[.!?]+$/,'').trim();
  const match=s.match(/^(?:(?:please\s+)?(?:(?:can|could)\s+(?:you|u)\s+)?(?:start|begin|launch)\s+(?:a\s+)?quiz|quiz\s+start)(?:\s+(?:with\s+)?(.*?))?(?:\s+please)?$/i);
  if(!match) return null;
  const rest=(match[1] || '').replace(/\s*please$/i,'').trim();
  if(!rest) return {count:null};
  const count=rest.match(/^(\d+)\s*(?:questions?)?$/i);
  return {count:count?Number(count[1]):NaN};
}
export class QuizText {
  constructor(quiz,{now=Date.now}={}) {this.quiz=quiz;this.now=now;this.pending=new Map();}
  key(m) {return `${m.guild.id}:${m.channel.id}:${m.author.id}`;}
  hasPending(m) {
    for(const [key,p] of this.pending) if(p.expires<=this.now())this.pending.delete(key);
    return this.pending.has(this.key(m));
  }
  async handle(m,prompt,{addressed=true}={}) {
    const key=this.key(m),pending=this.hasPending(m);
    const request=addressed?parseQuizStart(prompt):null;
    const number=prompt.trim().match(/^(\d+)\s*(?:questions?)?[.!]?$/i);
    const cancel=/^cancel[.!]?$/i.test(prompt.trim());
    if(!request && !(pending && (number || cancel)))return false;
    const reply=content=>m.reply({content,allowedMentions:noMentions});
    try {
      await requireQuizAdmin(m.guild,m.author.id);
      if(cancel && pending) {this.pending.delete(key);await reply('Quiz setup cancelled.');return true;}
      const count=request?request.count:number?Number(number[1]):NaN;
      if(count===null) {
        if(this.quiz.sessions.has(this.quiz.key(m.guild.id,m.channel.id)))throw new Error('A quiz is already active in this channel.');
        if(this.pending.size>=1000)this.pending.delete(this.pending.keys().next().value);
        this.pending.set(key,{expires:this.now()+120000});
        await reply('How many questions? Reply with a number from 1 to 150 within 2 minutes, or say “cancel”.');
        return true;
      }
      if(!Number.isInteger(count)||count<1||count>150) {
        await reply('Choose a whole number from 1 to 150, for example “Tav start a quiz 2 questions”.');return true;
      }
      this.pending.delete(key);
      await this.quiz.start({guildId:m.guild.id,channelId:m.channel.id,guild:m.guild,channel:m.channel,user:m.author,
        options:{getInteger:()=>count},editReply:payload=>m.reply(payload)});
    } catch(error) {
      if(!error.code && /Only the server owner/.test(error.message))this.pending.delete(key);
      await reply(error.code?'I couldn’t check permissions or start the quiz. Please try again.':error.message).catch(()=>{});
    }
    return true;
  }
}
