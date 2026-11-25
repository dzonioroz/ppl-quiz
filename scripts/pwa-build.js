import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

export function pwaBuild(){
 let config;
 return {
  name:'ppl-offline',
  configResolved(value){config=value;},
  writeBundle(options,bundle){
   const dir=resolve(config.root,options.dir);
   const shell=['index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable.png','apple-touch-icon.png'];
   const figures=[];
   for(const name of Object.keys(bundle)){
    if(!name.startsWith('assets/'))continue;
    if(/\.(m?js|css)$/.test(name))shell.push(name);
    else if(/^assets\/ppl-.*\.png$/.test(name))figures.push(name);
   }
   const hash=createHash('sha256');
   let bytes=0;
   for(const path of [...shell,...figures].sort()){
    const data=readFileSync(resolve(dir,path));
    hash.update(path).update(data);
    bytes+=data.length;
   }
   const worker=readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
   hash.update(worker);
   const content={version:hash.digest('hex').slice(0,20),shell,figures,bytes};
   writeFileSync(resolve(dir,'sw.js'),`const content = ${JSON.stringify(content)};\n${worker}`);
  },
 };
}
