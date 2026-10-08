export function validateConfiguration(url,key) {
 if(!url||!key)return 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart or rebuild the app.';
 try {const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error();}catch{return 'Set a valid Supabase project URL.';}
 let secret=key.startsWith('sb_secret_');
 if(key.split('.').length===3){try {const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));secret ||= payload.role==='service_role';}catch{return 'Set a Supabase publishable or legacy anon key.';}}
 return secret?'Use a public publishable or legacy anon key, never a service-role or secret key.':null;
}
