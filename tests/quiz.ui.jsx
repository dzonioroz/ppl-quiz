import React from 'react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent as events,cleanup,act,waitFor} from '@testing-library/react';
const cloud=vi.hoisted(()=>({sessions:[],attempts:[],pending:0,error:'',loading:false,changed:vi.fn(),refresh:vi.fn(),sync:vi.fn()}));
const marks=vi.hoisted(()=>({marked:new Set(),toggle:vi.fn(),pending:0,error:'',loading:false,sync:vi.fn()}));
vi.mock('../src/useReviewMarks',()=>({useReviewMarks:()=>marks}));
vi.mock('../src/useCloudProgress',()=>({useCloudProgress:()=>cloud}));
vi.mock('../src/AuthGate',()=>({default:()=>null}));
import {localRecords} from '../src/offlineStore';
import {App} from '../src/main';
let owner;
beforeEach(()=>{owner=crypto.randomUUID();localStorage.clear();vi.clearAllMocks();cloud.sessions=[];cloud.attempts=[];marks.marked=new Set();});
afterEach(cleanup);
const fireEvent={
 change:events.change,
 async click(element){
  await act(async()=>events.click(element));
  if(element.textContent.includes('Start quiz')&&element.classList.contains('primary'))await screen.findByRole('button',{name:'Submit'});
  if(element.textContent.includes('See results'))await screen.findByRole('heading',{name:'Quiz results'});
  await waitFor(()=>expect(document.querySelector('.quiz-session:disabled')).toBeNull());
 }
};
const pending=async()=> (await localRecords(owner,'outbox')).at(-1)?.payload;
async function start(count=1,end=false){render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);fireEvent.change(screen.getByRole('spinbutton'),{target:{value:String(count)}});if(end)await fireEvent.click(screen.getByLabelText('At the end'));await fireEvent.click(screen.getByRole('button',{name:/Start quiz →/}));}
async function answer(){const choices=screen.getAllByRole('button').filter(b=>b.classList.contains('answer'));await fireEvent.click(choices[0]);await fireEvent.click(screen.getByRole('button',{name:'Submit'}));}
it('immediate feedback, completed payload and review are preserved',async()=>{await start();await answer();expect(screen.getAllByRole('status')[0].textContent).toBeTruthy();expect(document.querySelector('.feedback')).toBeTruthy();await fireEvent.click(screen.getByRole('button',{name:/See results/}));expect(screen.getByText('Quiz results')).toBeTruthy();expect(screen.getByText('Review answers')).toBeTruthy();expect(cloud.changed).toHaveBeenCalledTimes(1);const payload=await pending();expect(payload.user_id).toBe(owner);expect(payload.attempts).toHaveLength(1);expect(typeof payload.attempts[0].selected_answer).toBe('number');expect(payload.total_questions).toBe(1);});
it('end feedback hides answer correctness until results',async()=>{await start(1,true);await answer();expect(screen.getByText('Answer saved. Feedback appears at the end.')).toBeTruthy();expect(document.querySelector('.answer.right')).toBeNull();expect(document.querySelector('.answer.wrong')).toBeNull();await fireEvent.click(screen.getByRole('button',{name:/See results/}));expect(screen.getByText('Review answers')).toBeTruthy();});
it('regular quiz selection has no repeated logical question',async()=>{await start(5);const ids=[];for(let i=0;i<5;i++){ids.push(document.querySelector('.quiz-top .eyebrow').textContent);await answer();await fireEvent.click(screen.getByRole('button',{name:i===4?/See results/:/Next →/}));}expect(new Set(ids).size).toBe(5);expect((await pending()).attempts).toHaveLength(5);});
it('new users with no incorrect history get an empty selection',async()=>{render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);await fireEvent.click(screen.getByRole('button',{name:'Practice Incorrect Answers'}));expect(screen.getByText(/No questions in this selection/)).toBeTruthy();expect(screen.getByRole('button',{name:/Start quiz →/}).disabled).toBe(true);});

it('My Progress renders accuracy and subject statistics for saved history',async()=>{
 cloud.sessions=[{id:'session',subject_id:'air-law',mode:'regular',total_questions:2,correct_answers:1,completed_at:'2026-10-08T10:00:00Z'}];
 cloud.attempts=[{id:'a1',session_id:'session',subject_id:'air-law',question_id:'AIR-LAW-001',is_correct:true,answered_at:'2026-10-08T09:59:00Z'},{id:'a2',session_id:'session',subject_id:'air-law',question_id:'AIR-LAW-002',is_correct:false,answered_at:'2026-10-08T10:00:00Z'}];
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 await fireEvent.click(screen.getByRole('button',{name:'My Progress'}));
 expect(screen.getByRole('heading',{name:'Statistics'})).toBeTruthy();
 expect(screen.getByText('Overall accuracy').closest('.stat').querySelector('strong').textContent).toBe('50%');
 expect(screen.getByText('Answers submitted').closest('.stat').querySelector('strong').textContent).toBe('2');
 expect(screen.getByText('1 quizzes · 2 attempts · 1 correct · 50% · 1 to revise')).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Recent quizzes'})).toBeTruthy();
});
it('My Progress renders an empty state without fabricated accuracy',async()=>{
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 await fireEvent.click(screen.getByRole('button',{name:'My Progress'}));
 expect(screen.getByText('Overall accuracy').closest('.stat').querySelector('strong').textContent).toBe('—');
 expect(screen.getByText(/No saved quizzes yet/)).toBeTruthy();
});

it('AI explanation appears only after submission, and delayed feedback exposes it in review',async()=>{
 await start();expect(screen.queryByText('Explain with AI')).toBeNull();await answer();
 expect(screen.getByText('Explain with AI')).toBeTruthy();
 cleanup();await start(1,true);await answer();expect(screen.queryByText('Explain with AI')).toBeNull();
 await fireEvent.click(screen.getByRole('button',{name:/See results/}));expect(screen.getByText('Explain with AI')).toBeTruthy();
});
it('AI failure does not prevent quiz completion and progress saving',async()=>{
 await start();await answer();await fireEvent.click(screen.getByText('Explain with AI'));
 await fireEvent.click(screen.getByRole('button',{name:/See results/}));
 expect(screen.getByText('Quiz results')).toBeTruthy();expect(cloud.changed).toHaveBeenCalledTimes(1);
});

it('learning mode reveals without submitting, resets each question, and saves selected answers',async()=>{
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 await fireEvent.click(screen.getByLabelText('Enable learning mode'));
 await fireEvent.click(screen.getByLabelText('At the end'));
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'2'}});
 await fireEvent.click(screen.getByRole('button',{name:/Start quiz →/}));
 expect(document.querySelector('.answer.right')).toBeNull();
 await fireEvent.click(screen.getByRole('button',{name:'Show answer'}));
 const correct=document.querySelector('.answer.right');
 expect(correct.textContent).toContain('Correct answer');
 expect(correct.disabled).toBe(false);
 expect(screen.getByRole('button',{name:'Submit'}).disabled).toBe(true);
 expect(screen.getByRole('button',{name:/Next →/}).disabled).toBe(true);
 expect(cloud.changed).not.toHaveBeenCalled();
 await fireEvent.click(document.querySelector('.answer:not(.right)'));
 expect(correct.classList.contains('right')).toBe(true);
 await fireEvent.click(screen.getByRole('button',{name:'Submit'}));
 await fireEvent.click(screen.getByRole('button',{name:/Next →/}));
 expect(document.querySelector('.answer.right')).toBeNull();
 expect(screen.getByRole('button',{name:'Show answer'}).disabled).toBe(false);
 await fireEvent.click(screen.getByRole('button',{name:'Show answer'}));
 await fireEvent.click(document.querySelector('.answer.right'));
 await fireEvent.click(screen.getByRole('button',{name:'Submit'}));
 await fireEvent.click(screen.getByRole('button',{name:/See results/}));
 expect(cloud.changed).toHaveBeenCalledTimes(1);
 const payload=await pending();
 expect(payload.total_questions).toBe(2);
 expect(payload.correct_answers).toBe(1);
 expect(payload.attempts.map(a=>a.is_correct)).toEqual([false,true]);
});

it('learning mode is opt-in and its preference persists for the account',async()=>{
 await start();expect(screen.queryByRole('button',{name:'Show answer'})).toBeNull();cleanup();
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 await fireEvent.click(screen.getByLabelText('Enable learning mode'));cleanup();
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 expect(screen.getByLabelText('Enable learning mode').checked).toBe(true);
});

it('Notes navigation returns to quiz setup with account settings intact',async()=>{
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'7'}});
 await fireEvent.click(screen.getByRole('button',{name:'Notes',exact:true}));
 expect(screen.getByRole('heading',{name:'Notes',exact:true})).toBeTruthy();
 await fireEvent.click(screen.getByRole('button',{name:'Lesson Notes',exact:true}));
 expect(screen.getByText('No lesson notes yet.')).toBeTruthy();
 await fireEvent.click(screen.getByRole('button',{name:'Start Quiz',exact:true}));
 expect(screen.getByRole('spinbutton').value).toBe('7');
});

it('previous questions remain locked and revisiting does not duplicate attempts',async()=>{
 await start(2,true);await answer();
 const original=document.querySelector('.answer.picked').textContent;
 await fireEvent.click(screen.getByRole('button',{name:/Next →/}));
 await fireEvent.click(screen.getByRole('button',{name:/Previous/}));
 expect(document.querySelector('.answer.picked').textContent).toBe(original);
 expect(screen.getByRole('button',{name:'Submit'}).disabled).toBe(true);
 expect(screen.getAllByRole('button').filter(b=>b.classList.contains('answer')).every(b=>b.disabled)).toBe(true);
 expect(document.querySelector('.answer.right')).toBeNull();
 await fireEvent.click(screen.getByRole('button',{name:/Next →/}));await answer();
 await fireEvent.click(screen.getByRole('button',{name:/Previous/}));
 await fireEvent.click(screen.getByRole('button',{name:/See results/}));
 expect(cloud.changed).toHaveBeenCalledTimes(1);
 expect((await pending()).attempts).toHaveLength(2);
 expect(new Set((await pending()).attempts.map(a=>a.subject_id+a.question_id)).size).toBe(2);
});
it('jumping out of order preserves drafts and requires all questions before finishing',async()=>{
 await start(3);await fireEvent.click(document.querySelectorAll('.answer')[1]);
 await fireEvent.click(screen.getByRole('button',{name:'Question 3, unanswered'}));await answer();
 expect(screen.queryByRole('button',{name:/See results/})).toBeNull();
 await fireEvent.click(screen.getByRole('button',{name:/Next unanswered/}));
 expect(document.querySelectorAll('.answer')[1].getAttribute('aria-pressed')).toBe('true');
 await fireEvent.click(screen.getByRole('button',{name:'Submit'}));
 await fireEvent.click(screen.getByRole('button',{name:'Question 2, unanswered'}));await answer();
 await fireEvent.click(screen.getByRole('button',{name:/See results/}));
 expect((await pending()).attempts).toHaveLength(3);
});
it('marked practice filters by saved question identity and allows marking from quiz and results',async()=>{
 marks.marked=new Set([JSON.stringify(['air-law','AIR-LAW-001'])]);
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 await fireEvent.click(screen.getByRole('button',{name:'Practice marked questions'}));
 expect(screen.getByText('1 available · quiz will use all available questions')).toBeTruthy();
 await fireEvent.click(screen.getByRole('button',{name:/Start quiz →/}));
 expect(document.querySelector('.quiz-top').textContent).toContain('AIR-LAW-001');
 await fireEvent.click(screen.getByRole('button',{name:'★ Marked for review'}));
 expect(marks.toggle).toHaveBeenCalledWith('air-law','AIR-LAW-001');
 await answer();await fireEvent.click(screen.getByRole('button',{name:/See results/}));
 await fireEvent.click(screen.getByRole('button',{name:'★ Marked for review'}));
 expect(marks.toggle).toHaveBeenCalledTimes(2);
});

it('shows the original circuit figure during a question and answer review',async()=>{
 marks.marked=new Set([JSON.stringify(['communication','COMMUNICATION-089'])]);
 render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
 await fireEvent.click(screen.getByRole('button',{name:'Practice marked questions'}));
 await fireEvent.click(screen.getByRole('button',{name:/Start quiz →/}));
 const image=screen.getByRole('img',{name:/Aerodrome circuit/});
 expect(image.getAttribute('src')).toContain('ppl-kom-1.png');
 expect(screen.getByRole('link',{name:'Open PPL Kom-1 at full size'})).toBeTruthy();
 expect(screen.queryByText(/not included in this library yet/)).toBeNull();
 expect(document.querySelector('.answer.right')).toBeNull();
 await answer();await fireEvent.click(screen.getByRole('button',{name:/See results/}));
 expect(screen.getByRole('img',{name:/Aerodrome circuit/})).toBeTruthy();
 expect(screen.queryByText(/Figure referenced but unavailable/)).toBeNull();
});

it('restores the answer, question order and feedback mode after an offline remount',async()=>{
 await start(2,true);
 const first=document.querySelector('.quiz-top .eyebrow').textContent;
 await answer();
 cleanup();
 const online=vi.spyOn(window.navigator,'onLine','get').mockReturnValue(false);
 try{
  render(<App user={{id:owner,email:'a@example.test'}} onSignOut={vi.fn()}/>);
  await fireEvent.click(await screen.findByRole('button',{name:/Resume .*1\/2 answered/}));
  expect(document.querySelector('.quiz-top .eyebrow').textContent).toBe(first);
  expect(screen.getByText('Answer saved. Feedback appears at the end.')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Submit'}).disabled).toBe(true);
  await fireEvent.click(screen.getByRole('button',{name:/Next →/}));
  await answer();
  await fireEvent.click(screen.getByRole('button',{name:/See results/}));
  expect((await pending()).attempts).toHaveLength(2);
 }finally{online.mockRestore();}
});
