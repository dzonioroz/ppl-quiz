import React from 'react';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
const cloud=vi.hoisted(()=>({sessions:[],attempts:[],pending:0,error:'',loading:false,save:vi.fn(),refresh:vi.fn(),sync:vi.fn()}));
vi.mock('../src/useCloudProgress',()=>({useCloudProgress:()=>cloud}));
vi.mock('../src/AuthGate',()=>({default:()=>null}));
import {App} from '../src/main';
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();cloud.sessions=[];cloud.attempts=[];});
afterEach(cleanup);
function start(count=1,end=false){render(<App user={{id:'A',email:'a@example.test'}} onSignOut={vi.fn()}/>);fireEvent.change(screen.getByRole('spinbutton'),{target:{value:String(count)}});if(end)fireEvent.click(screen.getByLabelText('At the end'));fireEvent.click(screen.getByRole('button',{name:/Start quiz →/}));}
function answer(){const choices=screen.getAllByRole('button').filter(b=>b.classList.contains('answer'));fireEvent.click(choices[0]);fireEvent.click(screen.getByRole('button',{name:'Submit'}));}
it('immediate feedback, completed payload and review are preserved',()=>{start();answer();expect(screen.getAllByRole('status')[0].textContent).toBeTruthy();expect(document.querySelector('.feedback')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/See results/}));expect(screen.getByText('Quiz results')).toBeTruthy();expect(screen.getByText('Review answers')).toBeTruthy();expect(cloud.save).toHaveBeenCalledTimes(1);const payload=cloud.save.mock.calls[0][0];expect(payload.user_id).toBe('A');expect(payload.attempts).toHaveLength(1);expect(typeof payload.attempts[0].selected_answer).toBe('number');expect(payload.total_questions).toBe(1);});
it('end feedback hides answer correctness until results',()=>{start(1,true);answer();expect(screen.getByText('Answer saved. Feedback appears at the end.')).toBeTruthy();expect(document.querySelector('.answer.right')).toBeNull();expect(document.querySelector('.answer.wrong')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/See results/}));expect(screen.getByText('Review answers')).toBeTruthy();});
it('regular quiz selection has no repeated logical question',()=>{start(5);const ids=[];for(let i=0;i<5;i++){ids.push(document.querySelector('.quiz-top .eyebrow').textContent);answer();fireEvent.click(screen.getByRole('button',{name:i===4?/See results/:/Next →/}));}expect(new Set(ids).size).toBe(5);expect(cloud.save.mock.calls[0][0].attempts).toHaveLength(5);});
it('new users with no incorrect history get an empty selection',()=>{render(<App user={{id:'A',email:'a@example.test'}} onSignOut={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Practice Incorrect Answers'}));expect(screen.getByText(/No questions in this selection/)).toBeTruthy();expect(screen.getByRole('button',{name:/Start quiz →/}).disabled).toBe(true);});

it('My Progress renders accuracy and subject statistics for saved history',()=>{
 cloud.sessions=[{id:'session',subject_id:'air-law',mode:'regular',total_questions:2,correct_answers:1,completed_at:'2026-10-08T10:00:00Z'}];
 cloud.attempts=[{id:'a1',session_id:'session',subject_id:'air-law',question_id:'AIR-LAW-001',is_correct:true,answered_at:'2026-10-08T09:59:00Z'},{id:'a2',session_id:'session',subject_id:'air-law',question_id:'AIR-LAW-002',is_correct:false,answered_at:'2026-10-08T10:00:00Z'}];
 render(<App user={{id:'A',email:'a@example.test'}} onSignOut={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'My Progress'}));
 expect(screen.getByRole('heading',{name:'Statistics'})).toBeTruthy();
 expect(screen.getByText('Overall accuracy').closest('.stat').querySelector('strong').textContent).toBe('50%');
 expect(screen.getByText('Answers submitted').closest('.stat').querySelector('strong').textContent).toBe('2');
 expect(screen.getByText('1 quizzes · 2 attempts · 1 correct · 50% · 1 to revise')).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Recent quizzes'})).toBeTruthy();
});
it('My Progress renders an empty state without fabricated accuracy',()=>{
 render(<App user={{id:'A',email:'a@example.test'}} onSignOut={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'My Progress'}));
 expect(screen.getByText('Overall accuracy').closest('.stat').querySelector('strong').textContent).toBe('—');
 expect(screen.getByText(/No saved quizzes yet/)).toBeTruthy();
});
