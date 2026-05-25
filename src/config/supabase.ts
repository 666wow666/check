import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufgytuooufxutcfofpgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZ3l0dW9vdWZ4dXRjZm9mcGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTcyMjMsImV4cCI6MjA5NTA5MzIyM30.4w0Kg4rwLlAySC6RESU6-O48jC04nU4cvzkkjeMnrxQ';

let supabaseInstance: SupabaseClient | null = null;
let connectionStatus: 'unknown' | 'connected' | 'disconnected' = 'unknown';
let lastCheckTime: number = 0;

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
  const now = Date.now();
  // 避免过于频繁的检查（至少间隔 10 秒）
  if (now - lastCheckTime < 10000 && connectionStatus === 'connected') {
    return true;
  }

  try {
    console.log('Checking Supabase connection...');
    
    // 做一个简单的查询来测试连接
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Supabase connection check failed:', error.message);
      connectionStatus = 'disconnected';
    } else {
      console.log('✅ Supabase connection successful');
      connectionStatus = 'connected';
    }

    lastCheckTime = now;
    return connectionStatus === 'connected';
  } catch (err) {
    console.error('Supabase connection error:', err);
    connectionStatus = 'disconnected';
    lastCheckTime = now;
    return false;
  }
};

export const isSupabaseConnected = (): boolean => {
  return connectionStatus === 'connected';
};

export const getConnectionStatus = (): 'unknown' | 'connected' | 'disconnected' => {
  return connectionStatus;
};
