-- ============================================
-- 考勤应用数据库初始化脚本
-- ============================================

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  morning_deadline VARCHAR(10) DEFAULT '06:30',
  afternoon_deadline VARCHAR(10) DEFAULT '16:55',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建考勤记录表
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date VARCHAR(10) NOT NULL,
  check_in VARCHAR(10),
  check_out VARCHAR(10),
  check_in_photo TEXT,
  check_out_photo TEXT,
  status VARCHAR(20) DEFAULT 'unchecked' CHECK (status IN ('unchecked', 'checked', 'late', 'leave', 'vacation')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 3. 创建账单表
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date VARCHAR(10) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  type VARCHAR(10) CHECK (type IN ('income', 'expense')),
  settled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建请假表
CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'leave' CHECK (status IN ('leave', 'vacation')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 5. 创建配对表
CREATE TABLE IF NOT EXISTS pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_code VARCHAR(6) UNIQUE NOT NULL,
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_bills_user_date ON bills(user_id, date);
CREATE INDEX IF NOT EXISTS idx_leaves_user_date ON leaves(user_id, date);
CREATE INDEX IF NOT EXISTS idx_pairs_code ON pairs(pair_code);
CREATE INDEX IF NOT EXISTS idx_pairs_user1 ON pairs(user1_id);
CREATE INDEX IF NOT EXISTS idx_pairs_user2 ON pairs(user2_id);

-- 7. 启用实时功能（允许前端订阅数据变化）
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE bills;
ALTER PUBLICATION supabase_realtime ADD TABLE leaves;
ALTER PUBLICATION supabase_realtime ADD TABLE pairs;

-- 8. 启用行级安全策略（RLS）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;

-- 9. 创建公开访问策略（两人应用无需认证）
CREATE POLICY "Allow public read and write on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on attendance_records" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on bills" ON bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read and write on pairs" ON pairs FOR ALL USING (true) WITH CHECK (true);
