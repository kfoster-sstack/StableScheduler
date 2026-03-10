/* ===================================================================
   StableScheduler — Supabase Configuration
   Replace the placeholder values with your actual Supabase project credentials.
   Find them at: Supabase Dashboard > Settings > API
   =================================================================== */

const SUPABASE_URL = 'https://otxozfrudrcnvylxlmaf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90eG96ZnJ1ZHJjbnZ5bHhsbWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjIwMDMsImV4cCI6MjA4ODczODAwM30.rjbIS6Xt1NeVYNn2TFmJ9jlHcqbEQfgHIIHGomR7Mao';

// Initialize Supabase client (loaded from CDN in HTML)
// Note: window.supabase is set by the CDN; we replace it with the initialized client
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
