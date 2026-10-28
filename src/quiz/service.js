import {randomUUID} from 'node:crypto';
import {MessageFlags,PermissionFlagsBits as P} from 'discord.js';
import {selectQuestions,timerSeconds} from './core.js';
import {questions} from './questions.js';
import {questionView,resultsView,reviewView,leaderboardView,noMentions} from './views.js';

export class QuizService {
  constructor(store,{seconds=timerSeconds(process.env.QUIZ_SECONDS),now=Date.now,
    schedule=setTimeout,cancel=clearTimeout,logger=console}={}) {
    this.store=store;this.seconds=seconds;this.now=now;this.schedule=schedule;this.cancel=cancel;
    this.logger=logger;this.sessions=new Map();this.closed=false;
  }
  key(guild,channel) {return `${guild}:${channel}`;}
  owns(i) {return (i.isChatInputCommand() && i.commandName==='quiz') || (i.isButton() && i.customId.startsWith('tq:'));}
  async handle(i) {
    if(!this.owns(i)) return false;
    try {
      if(!i.inGuild()) {await i.reply({content:'Use quizzes in a server channel.',flags:MessageFlags.Ephemeral});return true;}
      // Only update private pagination messages. Never update a shared question on a player's click.
      const privatePage=i.isButton() && !i.customId.startsWith('tq:a:') && i.message.flags?.has(MessageFlags.Ephemeral);
      if(privatePage) await i.deferUpdate();
      else await i.deferReply({flags:MessageFlags.Ephemeral});
      if(this.closed) throw new Error('TAVRENIQ is restarting. Please try again shortly.');
      if(i.isButton()) await this.button(i);
      else {
        switch(i.options.getSubcommand()) {
          case 'start': await this.start(i);break;
          case 'stop': await this.stop(i);break;
          case 'questions': await i.editReply({content:`**TAVRENIQ Quiz • ${questions.length} built-in questions**\n15 topics • Mixed difficulty • Four choices • ${this.seconds} seconds per question\nStart immediately with /quiz start number_of_questions:10 (1–150). Click A, B, C, or D to join. One answer per question; feedback is private.\nCorrect = 1 point. Accuracy = correct ÷ answered. Missed questions, including before joining, count as unanswered.\nUse /quiz leaderboard for server rankings and /quiz results for the latest finished quiz here.`,allowedMentions:noMentions});break;
          case 'leaderboard': await i.editReply(leaderboardView(i.guildId,this.store.leaderboard(i.guildId)));break;
          case 'results': {
            const id=this.store.latest(i.guildId,i.channelId);
            if(!id) throw new Error('No finished quiz is saved in this channel yet.');
            await i.editReply(resultsView(this.store.results(id)));break;
          }
        }
      }
    } catch(error) {
      this.logger.error('Quiz interaction failed:',error.code || error.name);
      const content=error.code?'Discord could not complete that action. Check my channel permissions and try again.':
        (error.name==='Error'?error.message:'The quiz action failed. Please try again.');
      const payload={content:content.slice(0,1800),embeds:[],components:[],allowedMentions:noMentions};
      if(i.deferred || i.replied) await i.editReply(payload).catch(()=>{});
      else await i.reply({...payload,flags:MessageFlags.Ephemeral}).catch(()=>{});
    }
    return true;
  }
  async start(i) {
    const key=this.key(i.guildId,i.channelId);
    if(this.sessions.has(key)) throw new Error('A quiz is already active in this channel. Join it or use /quiz stop.');
    const selected=selectQuestions(i.options.getInteger('number_of_questions',true));
    if(!i.channel?.isTextBased() || typeof i.channel.send!=='function') throw new Error('Start a quiz in a server text channel or thread.');
    const s={id:randomUUID(),guild:i.guildId,channel:i.channelId,starter:i.user.id,questions:selected,
      seconds:this.seconds,index:-1,played:0,accepting:false,channelObject:i.channel,operation:Promise.resolve(),persisted:false};
    this.sessions.set(key,s); // Reserve before any Discord/network await.
    try {
      const me=await i.guild.members.fetchMe();
      const send=i.channel.isThread()?P.SendMessagesInThreads:P.SendMessages;
      if(!i.channel.permissionsFor(me)?.has([P.ViewChannel,send,P.EmbedLinks]))
        throw new Error('I need View Channel, Send Messages, and Embed Links here (Send Messages in Threads for threads).');
      if(s.stopRequested || this.closed) throw new Error('Quiz startup was cancelled.');
      this.store.start(s);s.persisted=true;
      await this.enqueue(s,()=>this.advance(s));
    } catch(error) {
      if(s.persisted) this.store.finish(s.id,'failed');
      this.cancel(s.timer);this.sessions.delete(key);throw error;
    }
    await i.editReply({content:'Quiz started. Everyone in this channel can answer using the buttons.',allowedMentions:noMentions});
  }
  enqueue(s,work) {
    const operation=s.operation.then(work);
    s.operation=operation.catch(()=>{});
    return operation;
  }
  async disable(s) {
    if(s.message) await s.message.edit(questionView(s,true)).catch(error=>this.logger.error('Quiz button cleanup failed:',error.code || error.name));
  }
  async advance(s) {
    if(s.ended || this.closed) return;
    s.accepting=false;this.cancel(s.timer);
    await this.disable(s);
    if(s.stopRequested) return this.finish(s,'cancelled');
    if(s.index+1===s.questions.length) return this.finish(s,'completed');
    s.index++;
    // Post inert buttons first, then open the timer and activate them together.
    s.message=await s.channelObject.send(questionView(s,true));
    if(s.stopRequested) return this.finish(s,'cancelled');
    if(this.closed) return;
    s.deadline=this.now()+s.seconds*1000;
    await s.message.edit(questionView(s));
    if(this.closed) return;
    s.played=s.index+1;
    this.store.progress(s.id,s.played,s.message.id);
    if(s.stopRequested) return this.finish(s,'cancelled');
    s.accepting=true;
    s.timer=this.schedule(()=>{
      s.accepting=false;
      this.enqueue(s,()=>this.advance(s)).catch(error=>this.fail(s,error));
    },Math.max(0,s.deadline-this.now()));
    s.timer?.unref?.();
  }
  async finish(s,status) {
    if(s.ended) return;
    s.accepting=false;this.cancel(s.timer);
    this.store.finish(s.id,status);s.ended=true;
    try {
      await this.disable(s);
      await s.channelObject.send(resultsView(this.store.results(s.id)));
    } finally {this.sessions.delete(this.key(s.guild,s.channel));}
  }
  async fail(s,error) {
    this.logger.error('Quiz stopped:',error.code || error.name);
    try {await this.finish(s,'failed');}
    catch(e) {this.logger.error('Quiz results unavailable in channel; saved results can be retrieved with /quiz results:',e.code || e.name);}
  }
  async stop(i) {
    const s=this.sessions.get(this.key(i.guildId,i.channelId));
    if(!s || s.ended) throw new Error('There is no active quiz in this channel.');
    if(i.user.id!==s.starter) {
      const member=await i.guild.members.fetch({user:i.user.id,force:true});
      if(!member.permissions.has(P.ManageGuild) && !member.permissions.has(P.ModerateMembers))
        throw new Error('Only the quiz starter or a moderator with Moderate Members or Manage Server can stop it.');
    }
    s.stopRequested=true;s.accepting=false;this.cancel(s.timer);
    await this.enqueue(s,async()=>{if(s.persisted) await this.finish(s,'cancelled');});
    await i.editReply({content:'Quiz cancelled. Partial results do not count toward the leaderboard.',allowedMentions:noMentions});
  }
  async button(i) {
    const [,kind,id,rawPage,rawChoice]=i.customId.split(':');
    if(kind==='a') {
      const s=this.sessions.get(this.key(i.guildId,i.channelId));
      const index=Number(rawPage),choice=Number(rawChoice);
      if(!s || s.id!==id || !s.accepting || s.ended || s.stopRequested || s.index!==index ||
        this.now()>=s.deadline || s.message.id!==i.message.id)
        throw new Error('That question has closed. Use the buttons on the current question.');
      if(!Number.isInteger(choice)||choice<0||choice>3) throw new Error('Invalid answer button.');
      const correct=s.questions[index].answer===choice;
      const name=(i.member?.displayName || i.member?.nick || i.user.globalName || i.user.username).slice(0,80);
      const saved=this.store.answer(s.id,index,i.user.id,name,choice,correct);
      if(!saved) throw new Error('You have already answered this question. Your first answer is final.');
      await i.editReply({content:correct?'Correct! +1 point. Your answer is private.':'Incorrect. 0 points. Your answer is private; review answers after the quiz ends.',allowedMentions:noMentions});
      return;
    }
    const page=Number(rawPage);
    if(!Number.isSafeInteger(page)) throw new Error('Invalid page.');
    if(kind==='l') {
      if(id!==i.guildId) throw new Error('This leaderboard belongs to another server.');
      await i.editReply(leaderboardView(i.guildId,this.store.leaderboard(i.guildId),page));return;
    }
    const result=this.store.results(id);
    if(!result || result.session.guild!==i.guildId || result.session.channel!==i.channelId)
      throw new Error('These quiz results are not available in this channel.');
    if(result.session.status==='active') throw new Error('Results and answer review are available only after the quiz ends.');
    if(kind==='r') await i.editReply(resultsView(result,page));
    else if(kind==='v' && result.session.played) await i.editReply(reviewView(result.session,page));
    else throw new Error('This quiz button is no longer available.');
  }
  async recover(client) {
    const interrupted=this.store.recover();
    for(const s of interrupted) {
      try {
        const channel=await client.channels.fetch(s.channel);
        if(!channel || channel.guildId!==s.guild) continue;
        if(s.message) {
          const message=await channel.messages.fetch(s.message).catch(()=>null);
          if(message) await message.edit({components:[]}).catch(()=>{});
        }
        await channel.send(resultsView(this.store.results(s.id)));
      } catch(error) {this.logger.error('Interrupted quiz notice could not be sent:',error.code || error.name);}
    }
  }
  shutdown() {
    this.closed=true;
    for(const s of this.sessions.values()) {s.accepting=false;this.cancel(s.timer);}
    // Persisted active sessions are marked interrupted and announced on the next boot.
  }
}
