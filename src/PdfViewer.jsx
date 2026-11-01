import React,{useEffect,useRef,useState} from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {loadDocumentBytes} from './documentCache';
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;

export default function PdfViewer({document:reference,initialPage=1}) {
 const container=useRef(null),pageHost=useRef(null),scrollHost=useRef(null);
 const [pdf,setPdf]=useState(null),[page,setPage]=useState(initialPage),[draft,setDraft]=useState(String(initialPage));
 const [zoom,setZoom]=useState(1),[rotation,setRotation]=useState(0),[width,setWidth]=useState(600);
 const [loading,setLoading]=useState(true),[rendering,setRendering]=useState(false),[error,setError]=useState(''),[cacheStatus,setCacheStatus]=useState(''),[fullscreenError,setFullscreenError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let task,disposed=false;
  setLoading(true);setError('');setPdf(null);
  (async()=>{
   const result=await loadDocumentBytes(reference.url,{signal:controller.signal});
   if(disposed)return;
   setCacheStatus(result.cached?'Opened from this device’s cache.':result.stored?'Saved in this device’s cache for repeat views.':'Opened successfully. Persistent caching is unavailable on this device.');
   task=pdfjs.getDocument({data:result.data,isEvalSupported:false,wasmUrl:`${import.meta.env.BASE_URL}${__PDFJS_RESOURCE_PATH__}wasm/`,standardFontDataUrl:`${import.meta.env.BASE_URL}${__PDFJS_RESOURCE_PATH__}standard_fonts/`,cMapUrl:`${import.meta.env.BASE_URL}${__PDFJS_RESOURCE_PATH__}cmaps/`,cMapPacked:true});
   const loaded=await task.promise;
   if(disposed)return;
   setPage(Math.min(Math.max(1,initialPage),loaded.numPages));setPdf(loaded);
  })().catch(()=>{if(!disposed)setError('Unable to open this PDF. Check your connection and retry, or open the original below.');}).finally(()=>{if(!disposed)setLoading(false);});
  return()=>{disposed=true;controller.abort();if(task)void task.destroy();};
 },[reference.url,initialPage,retry]);
 useEffect(()=>{setDraft(String(page));},[page]);
 useEffect(()=>{
  const host=scrollHost.current;if(!host)return;
  const update=()=>setWidth(Math.max(180,host.clientWidth-32));update();
  if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);}
  const observer=new ResizeObserver(update);observer.observe(host);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!pdf||!pageHost.current)return;
  let disposed=false,renderTask;
  const host=pageHost.current;
  // A fresh canvas for every render prevents overlapping PDF.js tasks during fast navigation.
  const canvas=window.document.createElement('canvas');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${reference.title}, page ${page} of ${pdf.numPages}`);
  host.replaceChildren(canvas);setRendering(true);setError('');
  (async()=>{
   const pdfPage=await pdf.getPage(page);if(disposed)return;
   const base=pdfPage.getViewport({scale:1,rotation:(pdfPage.rotate+rotation)%360});
   const viewport=pdfPage.getViewport({scale:width/base.width*zoom,rotation:(pdfPage.rotate+rotation)%360});
   const ratio=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
   canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
   renderTask=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
   await renderTask.promise;
  })().catch(e=>{if(!disposed&&e.name!=='RenderingCancelledException')setError('This page could not be displayed. Retry or open the original PDF.');}).finally(()=>{if(!disposed)setRendering(false);});
  return()=>{disposed=true;renderTask?.cancel();canvas.remove();};
 },[pdf,page,width,zoom,rotation,reference.title]);
 async function fullscreen(){
  setFullscreenError('');
  try {if(window.document.fullscreenElement===container.current)await window.document.exitFullscreen();else if(container.current.requestFullscreen)await container.current.requestFullscreen();else setFullscreenError('Fullscreen is unavailable here. Use Open original for your browser’s full-screen PDF view.');}
  catch {setFullscreenError('Fullscreen could not be opened. You can use Open original instead.');}
 }
 function goTo(e){e.preventDefault();const value=Number(draft);if(Number.isInteger(value)&&value>=1&&value<=pdf.numPages)setPage(value);else setDraft(String(page));}
 return <section className="panel pdf-reader" ref={container} aria-label={`${reference.title} PDF viewer`}>
  <div className="pdf-heading"><span className="eyebrow">{reference.aircraft||reference.date||'PDF document'}</span><h2>{reference.title}</h2>{reference.amendment&&<p>{reference.amendment}</p>}</div>
  <div className="pdf-toolbar" aria-label="PDF controls">
   <button className="secondary" disabled={!pdf||page<=1} onClick={()=>setPage(p=>p-1)} aria-label="Previous page">←</button>
   <form onSubmit={goTo}><label>Page <input aria-label="PDF page" type="number" min="1" max={pdf?.numPages||reference.pages} value={draft} disabled={!pdf} onChange={e=>setDraft(e.target.value)}/></label><span> / {pdf?.numPages||reference.pages}</span><button className="secondary" disabled={!pdf}>Go</button></form>
   <button className="secondary" disabled={!pdf||page>=pdf.numPages} onClick={()=>setPage(p=>p+1)} aria-label="Next page">→</button>
   <button className="secondary" disabled={!pdf||zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z-.25))} aria-label="Zoom out">−</button>
   <span className="pdf-zoom">{Math.round(zoom*100)}%</span>
   <button className="secondary" disabled={!pdf||zoom>=3} onClick={()=>setZoom(z=>Math.min(3,z+.25))} aria-label="Zoom in">+</button>
   <button className="secondary" disabled={!pdf} onClick={()=>setZoom(1)}>Fit width</button>
   <button className="secondary" disabled={!pdf} onClick={()=>setRotation(r=>(r+90)%360)}>Rotate</button>
   <button className="secondary" onClick={fullscreen}>Fullscreen</button>
  </div>
  {reference.bookmarks?.length>0&&<label className="pdf-chapters">Chapter shortcuts<select aria-label="Handbook chapter" value="" disabled={!pdf} onChange={e=>setPage(Number(e.target.value))}><option value="" disabled>Jump to a chapter…</option>{reference.bookmarks.map(([number,title])=><option value={number} key={number}>{title} · PDF page {number}</option>)}</select></label>}
  {(loading||rendering)&&<p className="pdf-status" role="status">{loading?'Loading document…':`Rendering page ${page}…`}</p>}
  {error&&<div className="pdf-status" role="alert"><p>{error}</p><button className="secondary" onClick={()=>setRetry(r=>r+1)}>Retry document</button></div>}
  {fullscreenError&&<p className="pdf-status" role="status">{fullscreenError}</p>}
  <div className="pdf-scroll" ref={scrollHost} aria-busy={loading||rendering} tabIndex={0} aria-label="PDF page; scroll to pan when zoomed"><div ref={pageHost}/></div>
  <div className="pdf-bottom"><a className="secondary" href={reference.url} target="_blank" rel="noreferrer">Open original ↗</a><a className="secondary" href={reference.url} download>Download PDF</a><p className="fine" role="status">{cacheStatus} Browser storage may be cleared; caching does not make the whole app available offline.</p>{reference.description&&<p className="fine">{reference.description}</p>}</div>
 </section>;
}
