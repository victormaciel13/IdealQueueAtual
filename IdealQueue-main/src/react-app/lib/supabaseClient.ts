import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fsnssbqutswfrrexkvsg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbnNzYnF1dHN3ZnJyZXhrdnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTY1MTgsImV4cCI6MjA5MTkzMjUxOH0.vpjvm8tJlZvLIl5c1SJLmAcsQh0UDEECU7WXQfasAi4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);