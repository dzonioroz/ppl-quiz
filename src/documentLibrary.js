import poh from './assets/documents/c172n-1978-poh.pdf?url';
import normal from './assets/documents/c172m-yu-doy-normal.pdf?url';
import lynsAd from './assets/documents/lyns-aerodrome-2026-09-03.pdf?url';
import lynsVisual from './assets/documents/lyns-visual-2025-10-30.pdf?url';
import lyzrAd from './assets/documents/lyzr-aerodrome-2025-10-30.pdf?url';
import lyzrVisual from './assets/documents/lyzr-visual-2025-10-30.pdf?url';
import emergency1 from './assets/documents/yu-doy-emergency-source-1.jpg?url';
import emergency2 from './assets/documents/yu-doy-emergency-source-2.jpg?url';

export const handbook={id:'poh',title:'Pilot’s Operating Handbook',aircraft:'Cessna 172N · 1978',url:poh,pages:73,size:'1.61 MB',description:'Original scanned handbook. Zoom in to read the paired pages; this scan has no searchable text. The supplied file ends at the section 8 contents; section 8 procedures and section 9 are not included.',bookmarks:[[1,'Cover'],[3,'Contents'],[4,'1 · General'],[9,'2 · Limitations'],[15,'3 · Emergency procedures'],[24,'4 · Normal procedures'],[36,'5 · Performance'],[47,'6 · Weight & balance'],[54,'7 · Airplane & systems'],[73,'8 · Handling & maintenance (contents only)']]};
export const normalChecklist={id:'normal',title:'Normal procedures',aircraft:'C172M · YU-DOY',url:normal,pages:2,size:'537 KB'};
export const emergencySources=[emergency1,emergency2];
export const airfields=[
 {id:'LYNS',name:'Novi Sad / Čenej',documents:[
  {id:'lyns-ad',title:'Aerodrome chart',url:lynsAd,pages:1,size:'25 KB',date:'3 September 2026',amendment:'AIRAC AMDT 8/26'},
  {id:'lyns-visual',title:'Visual operation chart',url:lynsVisual,pages:1,size:'412 KB',date:'30 October 2025',amendment:'AIRAC AMDT 5/25'}]},
 {id:'LYZR',name:'Zrenjanin / Ečka',documents:[
  {id:'lyzr-ad',title:'Aerodrome chart',url:lyzrAd,pages:1,size:'26 KB',date:'30 October 2025',amendment:'AIRAC AMDT 5/25'},
  {id:'lyzr-visual',title:'Visual operation chart',url:lyzrVisual,pages:1,size:'174 KB',date:'30 October 2025',amendment:'AIRAC AMDT 5/25'}]}
];
