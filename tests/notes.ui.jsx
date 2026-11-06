import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import Notes from '../src/Notes';
import {questionPapers} from '../src/documentLibrary';
vi.mock('../src/PdfViewer',()=>({default:({document,initialPage})=><div role="region" aria-label="PDF preview">{document.title} · page {initialPage}</div>}));
afterEach(cleanup);
it('opens normal procedures and the matching original source page',async()=>{
 render(<Notes/>);
 fireEvent.click(screen.getAllByRole('button',{name:/Read checklist/})[0]);
 expect(screen.getByRole('heading',{name:'Normal procedures checklist'})).toBeTruthy();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'descent'}});
 expect(screen.getAllByRole('article')).toHaveLength(1);
 expect(screen.getByText('10°')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Source PDF · page 2'}));
 expect((await screen.findByRole('region',{name:'PDF preview'})).textContent).toContain('page 2');
 fireEvent.click(screen.getByRole('button',{name:/Back to checklist/}));
 expect(screen.getByRole('heading',{name:'Normal procedures checklist'})).toBeTruthy();
});
it('keeps emergency conditional branches and their source photos',()=>{
 render(<Notes/>);
 fireEvent.click(screen.getAllByRole('button',{name:/Read checklist/})[1]);
 expect(screen.getAllByRole('article')).toHaveLength(8);
 expect(screen.getByText('IF ENGINE STARTS:')).toBeTruthy();
 expect(screen.getByText('IF ENGINE FAILS TO START:')).toBeTruthy();
 expect(screen.queryByRole('img')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Show source photos'}));
 expect(screen.getAllByRole('img')).toHaveLength(2);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'no match'}});
 expect(screen.getByRole('status').textContent).toContain('No procedures match');
});
it('shows each airfield chart edition and an honest lesson notes empty state',async()=>{
 render(<Notes/>);
 fireEvent.click(screen.getByRole('button',{name:'Airfields'}));
 expect(screen.getAllByRole('article')).toHaveLength(4);
 const latest=screen.getAllByRole('article')[0];
 expect(latest.textContent).toContain('3 September 2026');
 expect(latest.textContent).toContain('AIRAC AMDT 8/26');
 fireEvent.click(within(latest).getByRole('button',{name:/Read document/}));
 expect((await screen.findByRole('region',{name:'PDF preview'})).textContent).toContain('Aerodrome chart');
 fireEvent.click(screen.getByRole('button',{name:'Lesson Notes'}));
 expect(screen.getByText('No lesson notes yet.')).toBeTruthy();
 expect(screen.queryByRole('region',{name:'PDF preview'})).toBeNull();
});

it('opens every original question paper and returns to the subject list',async()=>{
 render(<Notes/>);
 fireEvent.click(screen.getByRole('button',{name:'Question Papers'}));
 expect(screen.getAllByRole('article')).toHaveLength(9);
 for(const paper of questionPapers){
  const card=screen.getAllByRole('article').find(card=>within(card).queryByRole('heading',{name:paper.title}));
  expect(card.textContent).toContain(`${paper.pages} pages`);
  fireEvent.click(within(card).getByRole('button',{name:/Read document/}));
  expect((await screen.findByRole('region',{name:'PDF preview'})).textContent).toBe(`${paper.title} · page 1`);
  fireEvent.click(screen.getByRole('button',{name:'← Back to question papers'}));
 }
 fireEvent.click(screen.getByRole('button',{name:'Documents'}));
 expect(screen.getByRole('heading',{name:'Pilot’s Operating Handbook'})).toBeTruthy();
});
