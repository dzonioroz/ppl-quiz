import {readFile,writeFile} from 'node:fs/promises';
const subjects=['air-law','aircraft-general-knowledge','communication','flight-performance-and-planning','human-performance','meteorology','navigation','operational-procedures','principles-of-flight'];
const questions={};
for(const subjectId of subjects){
 const bank=JSON.parse(await readFile(new URL(`../src/data/${subjectId}.json`,import.meta.url),'utf8'));
 for(const q of bank.questions){
  const key=JSON.stringify([subjectId,q.id]);
  if(questions[key])throw Error(`Duplicate question ${key}`);
  if(!Number.isInteger(q.correctAnswer)||!q.answers[q.correctAnswer])throw Error(`Invalid answer ${key}`);
  questions[key]={subjectId,subject:bank.subject,id:q.id,question:q.question,answers:q.answers,correctAnswer:q.correctAnswer,requiresFigure:!!q.requiresFigure};
 }
}
const output=JSON.stringify(questions)+'\n';
const target=new URL('../supabase/functions/_shared/question-bank.json',import.meta.url);
if(process.argv.includes('--check')){
 if(await readFile(target,'utf8')!==output)throw Error('AI question bank is stale: run npm run ai:bank');
}else await writeFile(target,output);
