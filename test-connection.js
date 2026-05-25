import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ufgytuooufxutcfofpgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZ3l0dW9vdWZ4dXRjZm9mcGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTcyMjMsImV4cCI6MjA5NTA5MzIyM30.4w0Kg4rwLlAySC6RESU6-O48jC04nU4cvzkkjeMnrxQ';

async function testConnection() {
  console.log('🚀 开始测试 Supabase 连接...\n');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('1️⃣ 客户端初始化成功');
    
    // 测试连接
    console.log('2️⃣ 测试数据库连接...');
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ 连接失败:', error.message);
      console.error('错误详情:', error);
    } else {
      console.log('✅ 连接成功!');
      console.log('用户数量:', data);
    }
    
  } catch (err) {
    console.error('❌ 发生异常:', err);
  }
}

testConnection();
