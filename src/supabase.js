import { createClient } from '@supabase/supabase-js';
import {validateConfiguration} from './configuration';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configurationError = validateConfiguration(url,key);
export const supabase=configurationError ? null : createClient(url,key);
export const authRedirect = () => new URL(import.meta.env.BASE_URL,window.location.origin).href;
