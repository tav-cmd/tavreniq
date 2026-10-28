import {escapeMarkdown} from 'discord.js';
export const noMentions={parse:[],repliedUser:false};
const blue=0x3366ee;
const labels=['A','B','C','D'];
const button=(custom_id,label,disabled=false)=>({type:2,style:2,custom_id,label,disabled});
const row=components=>({type:1,components});
const clean=value=>escapeMarkdown(String(value).replace(/[\r\n]/g,' ').slice(0,60));
export function questionView(s,disabled=false) {
  const q=s.questions[s.index];
  return {embeds:[{color:blue,title:`TAVRENIQ • Question ${s.index+1}/${s.questions.length}`,
    description:`**${q.prompt}**\n\n${q.options.map((o,i)=>`**${labels[i]}.** ${o}`).join('\n')}`,
    fields:[{name:'Time',value:disabled?'Answers closed':`${s.seconds} seconds • Closes <t:${Math.ceil(s.deadline/1000)}:R>`}],
    footer:{text:`${q.category} • ${q.difficulty} • One answer each • Private feedback`}}],
    components:[row(labels.map((label,n)=>button(`tq:a:${s.id}:${s.index}:${n}`,label,disabled)))],allowedMentions:noMentions};
}
function paginate(total,page,size=8) {
  const pages=Math.max(1,Math.ceil(total/size));
  page=Math.min(pages-1,Math.max(0,Number.isSafeInteger(page)?page:0));
  return {page,pages,start:page*size,end:(page+1)*size};
}
function navigation(prefix,p,extra=[]) {
  return [row([button(`${prefix}:${p.page-1}`,'Previous',p.page===0),button(`${prefix}:${p.page+1}`,'Next',p.page===p.pages-1),...extra])];
}
const medal=n=>({1:'🥇',2:'🥈',3:'🥉'}[n] || `${n}.`);
export function resultsView({session:s,players},page=0) {
  const p=paginate(players.length,page);
  const status={completed:'Completed',cancelled:'Cancelled',interrupted:'Interrupted by restart',failed:'Stopped due to an error'}[s.status] || s.status;
  return {embeds:[{color:s.status==='completed'?blue:0xd49a32,title:`TAVRENIQ • Quiz ${status}`,
    description:`**${s.played}/${s.questions.length} questions played • ${players.length} participants**\n`+
      (s.status==='completed'?'Scores saved to this server’s leaderboard.':'Partial results only; excluded from the leaderboard.')+'\n\n'+
      (players.slice(p.start,p.end).map(r=>`${medal(r.place)} **${clean(r.name)}** (<@${r.user}>) — **${r.score} pts**\n`+
        `Answered ${r.answered} • Correct ${r.correct} • Incorrect ${r.incorrect} • Unanswered ${r.unanswered} • Accuracy ${r.accuracy.toFixed(1)}%`).join('\n\n') || 'No answers were submitted.'),
    footer:{text:`Page ${p.page+1}/${p.pages} • Rank: score, then accuracy; exact ties share rank. Accuracy = correct / answered.`}}],
    components:navigation(`tq:r:${s.id}`,p,s.played?[button(`tq:v:${s.id}:0`,'Review answers')]:[]),allowedMentions:noMentions};
}
export function reviewView(s,page=0) {
  const p=paginate(s.played,page,1),q=s.questions[p.page];
  return {embeds:[{color:blue,title:`TAVRENIQ • Answer review ${p.page+1}/${s.played}`,
    description:`**${q.prompt}**\n\n${q.options.map((o,i)=>`**${labels[i]}.** ${o}`).join('\n')}\n\n**Correct answer: ${labels[q.answer]}. ${q.options[q.answer]}**`,
    footer:{text:'Review is available only after the quiz ends. Individual answer choices remain private.'}}],
    components:navigation(`tq:v:${s.id}`,p,[button(`tq:r:${s.id}:0`,'Results')]),allowedMentions:noMentions};
}
export function leaderboardView(guild,players,page=0) {
  const p=paginate(players.length,page);
  return {embeds:[{color:blue,title:'TAVRENIQ • Server Quiz Leaderboard',
    description:players.slice(p.start,p.end).map(r=>`${medal(r.place)} <@${r.user}> — **${r.score} pts**\n${r.games} quizzes • ${r.correct}/${r.answered} correct • ${r.accuracy.toFixed(1)}% accuracy`).join('\n\n') || 'No completed quiz scores yet. Start with /quiz start.',
    footer:{text:`Page ${p.page+1}/${p.pages} • Completed quizzes only • Rank: points, then accuracy; exact ties share rank.`}}],
    components:navigation(`tq:l:${guild}`,p),allowedMentions:noMentions};
}
