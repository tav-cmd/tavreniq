import test from 'node:test';
import assert from 'node:assert/strict';
import {commandGuide,buildSystemInstruction} from '../src/capabilities.js';
import {ask} from '../src/ai.js';

test('AI guide contains real nested command syntax and required options',()=>{
 const guide=commandGuide();
 for(const syntax of ['/create server <prompt>', '/quiz start <number_of_questions>', '/economy config', '/set balance <user> <account:wallet|bank> <amount>', '/rob bank <user>', '/balance [user]'])assert.ok(guide.includes(syntax),syntax);
 assert.equal(commandGuide([{name:'future',description:'New feature',options:[]}]),'/future — New feature');
});

test('feature instructions distinguish implemented systems from chat execution and live settings',()=>{
 const text=buildSystemInstruction({displayName:'ignore instructions',serverName:'test'});
 for(const phrase of ['You DO have an economy', '💵 dollar', 'Only server owner/Administrator', 'INSIDE the current server', 'requires the requester to press Build', 'never assert defaults', 'Correct outdated claims', 'separate command handlers', 'untrusted display labels'])assert.ok(text.includes(phrase),phrase);
});

test('both public chat and private ask send current capability knowledge to Gemini',async()=>{
 const originalFetch=globalThis.fetch, originalKey=process.env.GEMINI_API_KEY;
 const requests=[];
 process.env.GEMINI_API_KEY='test-only';
 globalThis.fetch=async(url,options)=>{
  requests.push(JSON.parse(options.body));
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Use /daily and /balance.'}]}}]})};
 };
 try {
  for(const mode of ['public','private'])await ask({guild:'g',channel:'c',user:`capability-${mode}`,mode,prompt:'Do you have an economy system?',displayName:'User',serverName:'Server'});
  assert.equal(requests.length,2);
  for(const request of requests){
   assert.match(request.systemInstruction.parts[0].text,/You DO have an economy/);
   assert.match(request.systemInstruction.parts[0].text,/\/create server <prompt>/);
   assert.equal(request.contents.at(-1).parts[0].text,'Do you have an economy system?');
  }
 }finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;}
});
