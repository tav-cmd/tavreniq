import {randomInt} from 'node:crypto';
import {questions} from './questions.js';
export function shuffle(items, draw = randomInt) {
  const copy = [...items];
  for(let i=copy.length-1;i>0;i--) { const j=draw(i+1); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}
export function selectQuestions(count, draw = randomInt) {
  if(!Number.isInteger(count) || count<1 || count>questions.length) throw new Error('Choose 1 to 150 questions.');
  return shuffle(questions,draw).slice(0,count).map(q=>{
    const order=shuffle([0,1,2,3],draw);
    return {...q,options:order.map(n=>q.options[n]),answer:order.indexOf(q.answer)};
  });
}
export function rank(rows) {
  const result=rows.map(r=>({...r,score:r.correct,incorrect:r.answered-r.correct,
    unanswered:Math.max(0,r.played-r.answered),accuracy:r.answered?r.correct/r.answered*100:0}));
  result.sort((a,b)=>b.score-a.score || b.accuracy-a.accuracy || (BigInt(a.user)<BigInt(b.user)?-1:1));
  let place=0;
  return result.map((r,i)=>{
    if(!i || r.score!==result[i-1].score || r.accuracy!==result[i-1].accuracy) place=i+1;
    return {...r,place};
  });
}
export function timerSeconds(value) {
  if(value===undefined || value==='') return 20;
  const n=Number(value);
  if(!Number.isInteger(n)||n<5||n>120) throw new Error('QUIZ_SECONDS must be a whole number from 5 to 120.');
  return n;
}
