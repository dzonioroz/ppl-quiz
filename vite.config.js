import {defineConfig} from 'vite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const pdfjsRoot=dirname(require.resolve('pdfjs-dist/package.json'));
const {version}=JSON.parse(readFileSync(join(pdfjsRoot,'package.json'),'utf8'));
const pdfjsPath=`pdfjs/${version}/`;
// PDF.js resolves decoders/fonts by filename, so retain those names under a
// versioned directory in both development and the production Pages artifact.
function pdfjsResources(){
 const resources=new Map();
 for(const directory of ['wasm','standard_fonts','cmaps']){
  for(const name of readdirSync(join(pdfjsRoot,directory))){
   resources.set(`${pdfjsPath}${directory}/${name}`,join(pdfjsRoot,directory,name));
  }
 }
 return {name:'pdfjs-resources',
  configureServer(server){
   server.middlewares.use((req,res,next)=>{
    const pathname=decodeURI((req.url||'').split('?')[0]);
    const key=pathname.replace(server.config.base,'').replace(/^\//,'');
    const file=resources.get(key);if(!file)return next();
    res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'application/octet-stream');
    res.end(readFileSync(file));
   });
  },
  generateBundle(){for(const [fileName,path] of resources)this.emitFile({type:'asset',fileName,source:readFileSync(path)});}
 };
}
export default defineConfig({
 base:'/ppl-quiz/',
 define:{__PDFJS_RESOURCE_PATH__:JSON.stringify(pdfjsPath)},
 plugins:[pdfjsResources()],
});
