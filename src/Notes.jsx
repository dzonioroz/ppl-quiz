import React,{lazy,Suspense,useState} from 'react';
import {handbook,normalChecklist,emergencySources,airfields} from './documentLibrary';
import checklists from './reference/checklists.json';
import './notes.css';
const PdfViewer=lazy(()=>import('./PdfViewer'));

function DocumentCard({document,onOpen}) {
 return <article className="panel reference-card"><span className="eyebrow">PDF · {document.pages} {document.pages===1?'page':'pages'} · {document.size}</span><h3>{document.title}</h3>{document.aircraft&&<p>{document.aircraft}</p>}{document.date&&<p>{document.date}<br/><small>{document.amendment}</small></p>}{document.description&&<p className="hint">{document.description}</p>}<button className="primary" onClick={()=>onOpen(document)}>Read document <span aria-hidden="true">→</span></button></article>;
}
function Checklist({kind,onOpen}) {
 const [query,setQuery]=useState('');
 const [sources,setSources]=useState(false);
 const emergency=kind==='emergency';
 const sections=checklists[kind].filter(section=>`${section.title} ${section.steps.map(s=>s.note||`${s.item} ${s.action}`).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <section className={'checklist-reader '+(emergency?'emergency-reader':'')}>
  <div className="reference-heading"><div><span className="eyebrow">{emergency?'C172 · YU-DOY':'C172M · YU-DOY'}</span><h2>{emergency?'Emergency checklist':'Normal procedures checklist'}</h2></div>{!emergency&&<button className="secondary" onClick={()=>onOpen(normalChecklist)}>View original PDF</button>}</div>
  <p className="reference-notice">Transcribed study reference. Wording and conditional steps follow the supplied source; confirm procedures against the approved checklist for your aircraft.</p>
  <label className="reference-search">Find a procedure<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={emergency?'Try engine failure or fire':'Try taxi or landing'}/></label>
  {emergency&&<><button className="secondary" aria-expanded={sources} onClick={()=>setSources(!sources)}>{sources?'Hide':'Show'} source photos</button>{sources&&<div className="source-photos">{emergencySources.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Original YU-DOY emergency checklist, photo ${i+1}`} loading="lazy"/>Open photo {i+1} at full size</a>)}</div>}</>}
  <div className="procedure-jumps" aria-label="Procedure shortcuts">{sections.map(s=><a key={s.id} href={`#${kind}-${s.id}`}>{s.title}</a>)}</div>
  {!sections.length&&<p role="status">No procedures match “{query}”.</p>}
  <div className="procedure-grid">{sections.map(section=><article className="panel procedure" id={`${kind}-${section.id}`} key={section.id}><h3>{section.title}</h3><ol>{section.steps.map((step,i)=><li className={step.note?'procedure-condition':''} key={i}>{step.note?<p>{step.note}</p>:<div><span>{step.item}</span><strong>{step.action}</strong></div>}</li>)}</ol><div className="procedure-source">{emergency?<a href={emergencySources[section.sourcePage-1]} target="_blank" rel="noreferrer">Source photo {section.sourcePage} ↗</a>:<button className="quiet" onClick={()=>onOpen(normalChecklist,section.sourcePage)}>Source PDF · page {section.sourcePage}</button>}</div></article>)}</div>
 </section>;
}
export default function Notes() {
 const [tab,setTab]=useState('documents');
 const [checklist,setChecklist]=useState(null);
 const [opened,setOpened]=useState(null);
 function open(document,page=1){setOpened({document,page});}
 return <div className="notes-area"><div className="heading"><span className="eyebrow">YOUR FLIGHT LIBRARY</span><h1>Notes</h1><p>Aircraft references, airfield charts, and a home for your lesson notes.</p></div>
 <div className="reference-tabs" aria-label="Notes sections">{[['documents','Documents'],['airfields','Airfields'],['lessons','Lesson Notes']].map(([id,label])=><button key={id} className={tab===id?'active':''} aria-pressed={tab===id} onClick={()=>{setTab(id);setOpened(null);setChecklist(null);}}>{label}</button>)}</div>
 {opened?<><button className="quiet" onClick={()=>setOpened(null)}>← Back to {tab==='airfields'?'airfields':checklist?'checklist':'documents'}</button><Suspense fallback={<p role="status">Loading PDF viewer…</p>}><PdfViewer key={opened.document.id} document={opened.document} initialPage={opened.page}/></Suspense></>:
 tab==='documents'?<>{checklist?<><button className="quiet" onClick={()=>setChecklist(null)}>← All documents</button><Checklist key={checklist} kind={checklist} onOpen={open}/></>:<><p className="reference-notice">The handbook covers a 1978 C172N. The normal checklist covers C172M / YU-DOY; the emergency sheet is labelled C172 / YU-DOY.</p><div className="reference-grid"><DocumentCard document={handbook} onOpen={open}/>{[['normal','Normal checklist','C172M · YU-DOY','Procedures organized by flight phase, with the original two-page PDF.'],['emergency','Emergency checklist','C172 · YU-DOY','Eight procedures transcribed from your photos, with original images alongside.']].map(([id,title,aircraft,description])=><article className="panel reference-card" key={id}><span className="eyebrow">Readable checklist</span><h3>{title}</h3><p>{aircraft}</p><p className="hint">{description}</p><button className="primary" onClick={()=>setChecklist(id)}>Read checklist <span aria-hidden="true">→</span></button></article>)}</div><p className="fine">PDFs load when opened and are cached on this device when browser storage is available. Source photos load only when requested.</p></>}</>:
 tab==='airfields'?<><p className="reference-notice">Supplied chart editions are shown below. Current AIP amendments and NOTAMs are not synchronized with this library.</p>{airfields.map(airfield=><section key={airfield.id}><h2>{airfield.id} <span className="airfield-name">{airfield.name}</span></h2><div className="reference-grid">{airfield.documents.map(document=><DocumentCard key={document.id} document={document} onOpen={open}/>)}</div></section>)}</>:
 <section className="panel lesson-empty"><span className="lesson-icon" aria-hidden="true">✎</span><h2>Your lessons, in one place</h2><p>No lesson notes yet.</p><p>When you provide your first scans, they can be organized by lesson or topic, with a readable transcription and the original pages side by side.</p><p className="fine">Personal lesson notes and scan uploads are not enabled yet.</p></section>}
 </div>;
}
