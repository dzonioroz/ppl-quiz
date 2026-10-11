import {createClient} from '@supabase/supabase-js';
import bank from '../_shared/question-bank.json' with {type:'json'};
import {createHandler,generateStructured,PROMPT_VERSION} from './core.js';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const model=Deno.env.get('OPENAI_EXPLANATION_MODEL') || 'gpt-4o-mini';
Deno.serve(createHandler({
 bank,model,version:Deno.env.get('PPL_EXPLANATION_PROMPT_VERSION') || PROMPT_VERSION,
 allowedOrigins:(Deno.env.get('AI_ALLOWED_ORIGINS') || '').split(',').map(s=>s.trim()).filter(Boolean),
 verifyUser:async(token:string)=>{const {data,error}=await admin.auth.getUser(token);if(error)throw error;return data.user;},
 rpc:async(name:string,args:Record<string,unknown>)=>{const {data,error}=await admin.rpc(name,args);if(error)throw error;return data;},
 generate:(args:{instructions:string;input:unknown;schema:object;name:string})=>generateStructured({...args,model,apiKey:Deno.env.get('OPENAI_API_KEY')}),
}));
