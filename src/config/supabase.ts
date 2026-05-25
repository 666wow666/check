import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufgytuooufxutcfofpgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZ3l0dW9vdWZ4dXRjZm9mcGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTcyMjMsImV4cCI6MjA5NTA5MzIyM30.4w0Kg4rwLlAySC6RESU6-O48jC04nU4cvzkkjeMnrxQ';

let supabaseInstance: SupabaseClient | null = null;

const createSupabaseClient = (): SupabaseClient => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'attendance-app'
      }
    }
  });

  supabaseInstance = client;
  return client;
};

export const supabase = createSupabaseClient();

export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .maybeSingle();

    return !error;
  } catch (err) {
    return false;
  }
};

export const isSupabaseConnected = async (): Promise<boolean> => {
  return await checkSupabaseConnection();
};

export const getConnectionStatus = async (): Promise<'unknown' | 'connected' | 'disconnected'> => {
  const connected = await checkSupabaseConnection();
  return connected ? 'connected' : 'disconnected';
};
