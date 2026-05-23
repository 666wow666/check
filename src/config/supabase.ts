import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufgytuooufxutcfofpgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZ3l0dW9vdWZ4dXRjZm9mcGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTcyMjMsImV4cCI6MjA5NTA5MzIyM30.4w0Kg4rwLlAySC6RESU6-O48jC04nU4cvzkkjeMnrxQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
