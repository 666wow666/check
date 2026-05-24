import { create } from 'zustand';
import { User } from '../types';
import { supabase } from '../config/supabase';

const generateDeviceId = () => {
  const stored = localStorage.getItem('deviceId');
  if (stored && stored.startsWith('device_')) {
    return stored;
  }
  
  const newId = 'device_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).substring(2, 15));
  localStorage.setItem('deviceId', newId);
  return newId;
};

const generatePairCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

interface Pair {
  id: string;
  pairCode: string;
  user1Id: string;
  user2Id: string | null;
  status: 'pending' | 'active';
}

interface AuthState {
  user: User | null;
  partner: User | null;
  partnerRecord: any | null;
  isLoading: boolean;
  currentPair: Pair | null;
  initialize: () => Promise<void>;
  register: (name: string) => Promise<User>;
  updateNickname: (nickname: string) => Promise<void>;
  updateDeadlines: (morning: string, afternoon: string) => Promise<void>;
  loadAllUsers: () => Promise<User[]>;
  createPairCode: () => Promise<string>;
  joinPair: (pairCode: string) => Promise<void>;
  loadCurrentPair: () => Promise<void>;
  loadPartnerInfo: () => Promise<void>;
  loadPartnerRecord: (date?: string) => Promise<void>;
  initializePair: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  partner: null,
  partnerRecord: null,
  isLoading: true,
  currentPair: null,

  initialize: async () => {
    set({ isLoading: true });
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        
        const isOldId = !userData.id || 
                       userData.id === '1' || 
                       userData.id === '2' || 
                       /^\d+$/.test(userData.id);
        
        if (isOldId) {
          localStorage.removeItem('user');
          localStorage.removeItem('deviceId');
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('attendance_')) {
              localStorage.removeItem(key);
            }
          }
        } else {
          if (!userData.id.startsWith('local_')) {
            try {
              const { data: remoteUser } = await supabase
                .from('users')
                .select('*')
                .eq('id', userData.id)
                .single();

              if (remoteUser) {
                const updatedUser: User = {
                  id: remoteUser.id,
                  name: remoteUser.name,
                  nickname: remoteUser.nickname,
                  deviceId: remoteUser.device_id,
                  morningDeadline: remoteUser.morning_deadline || '06:30',
                  afternoonDeadline: remoteUser.afternoon_deadline || '16:55',
                };
                set({ user: updatedUser, isLoading: false });
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                await get().initializePair();
                return;
              }
            } catch (error) {
              console.error('Sync user error:', error);
            }
          }
          
          set({ user: userData, isLoading: false });
          return;
        }
      } catch (error) {
        console.error('Initialize error:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('deviceId');
      }
    }
    
    set({ user: null, isLoading: false });
  },

  register: async (name: string) => {
    const deviceId = generateDeviceId();
    
    // 立即创建本地用户，确保 UI 不会卡住
    const localUser: User = {
      id: 'local_' + Date.now(),
      name: name.trim(),
      nickname: name.trim(),
      deviceId: deviceId,
      morningDeadline: '06:30',
      afternoonDeadline: '16:55',
    };
    
    // 先设置本地用户，让用户可以立即使用
    set({ user: localUser, isLoading: false });
    localStorage.setItem('user', JSON.stringify(localUser));
    
    // 尝试同步到云端（后台进行，不阻塞 UI）
    setTimeout(async () => {
      try {
        const userData = {
          device_id: deviceId,
          name: name.trim(),
          nickname: name.trim(),
          morning_deadline: '06:30',
          afternoon_deadline: '16:55',
        };

        // 检查是否已有该设备用户
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('device_id', deviceId)
          .single();

        clearTimeout(timeoutId);

        let cloudUser: User | undefined;

        if (existingUser) {
          // 更新现有用户
          const { data: updatedUser } = await supabase
            .from('users')
            .update({ 
              name: name.trim(), 
              nickname: name.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('device_id', deviceId)
            .select()
            .single();

          cloudUser = {
            id: updatedUser?.id || existingUser.id,
            name: updatedUser?.name || existingUser.name,
            nickname: updatedUser?.nickname || existingUser.nickname,
            deviceId: updatedUser?.device_id || existingUser.device_id,
            morningDeadline: updatedUser?.morning_deadline || existingUser.morning_deadline || '06:30',
            afternoonDeadline: updatedUser?.afternoon_deadline || existingUser.afternoon_deadline || '16:55',
          };
        } else {
          // 创建新用户
          const { data: newUser } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single();

          if (newUser) {
            cloudUser = {
              id: newUser.id,
              name: newUser.name,
              nickname: newUser.nickname,
              deviceId: newUser.device_id,
              morningDeadline: newUser.morning_deadline,
              afternoonDeadline: newUser.afternoon_deadline,
            };
          }
        }

        // 如果有云端用户，更新本地存储（避免循环更新）
        if (cloudUser) {
          localStorage.setItem('user', JSON.stringify(cloudUser));
          const { user: currentUser } = get();
          if (currentUser?.id !== cloudUser.id) {
            set({ user: cloudUser });
          }
          await get().initializePair();
        }

        // 如果云端创建成功但用户对象创建失败，使用本地用户继续
        console.log('Cloud sync completed');
      } catch (error) {
        console.error('Cloud sync error (continuing with local user):', error);
        // 继续使用本地用户，不阻塞用户操作
      }
    }, 0);

    return localUser;
  },

  updateNickname: async (nickname: string) => {
    const { user } = get();
    if (user && user.id.startsWith('local_')) {
      const updatedUser = { ...user, nickname };
      set({ user: updatedUser });
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return;
    }

    if (user) {
      try {
        await supabase
          .from('users')
          .update({ 
            nickname, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', user.id);

        const updatedUser = { ...user, nickname };
        set({ user: updatedUser });
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (error) {
        console.error('Update nickname error:', error);
      }
    }
  },

  updateDeadlines: async (morning: string, afternoon: string) => {
    const { user } = get();
    if (user && user.id.startsWith('local_')) {
      const updatedUser = { ...user, morningDeadline: morning, afternoonDeadline: afternoon };
      set({ user: updatedUser });
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return;
    }

    if (user) {
      try {
        await supabase
          .from('users')
          .update({ 
            morning_deadline: morning,
            afternoon_deadline: afternoon,
            updated_at: new Date().toISOString() 
          })
          .eq('id', user.id);

        const updatedUser = { ...user, morningDeadline: morning, afternoonDeadline: afternoon };
        set({ user: updatedUser });
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (error) {
        console.error('Update deadlines error:', error);
      }
    }
  },

  loadAllUsers: async () => {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      return users?.map(u => ({
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        deviceId: u.device_id,
        morningDeadline: u.morning_deadline || '06:30',
        afternoonDeadline: u.afternoon_deadline || '16:55',
      })) || [];
    } catch (error) {
      console.error('Load all users error:', error);
      return [];
    }
  },

  createPairCode: async () => {
    const { user } = get();
    if (!user || user.id.startsWith('local_')) {
      throw new Error('需要云端模式才能创建配对');
    }

    const existingPair = get().currentPair;
    if (existingPair) {
      if (existingPair.status === 'pending') {
        return existingPair.pairCode;
      }
      throw new Error('已有活跃配对');
    }

    let pairCode = generatePairCode();
    let attempts = 0;

    while (attempts < 10) {
      try {
        console.log('Attempting to create pair with code:', pairCode);
        const { data, error } = await supabase
          .from('pairs')
          .insert({
            pair_code: pairCode,
            user1_id: user.id,
            status: 'pending'
          })
          .select()
          .single();

        if (error) {
          console.error('Insert pair error:', error);
          pairCode = generatePairCode();
          attempts++;
          continue;
        }

        console.log('Pair created successfully:', data);

        const newPair: Pair = {
          id: data.id,
          pairCode: data.pair_code,
          user1Id: data.user1_id,
          user2Id: data.user2_id,
          status: data.status
        };

        set({ currentPair: newPair });
        return pairCode;
      } catch (error) {
        console.error('Create pair error:', error);
        pairCode = generatePairCode();
        attempts++;
      }
    }

    throw new Error('创建配对失败，请重试');
  },

  joinPair: async (pairCode: string) => {
    const { user } = get();
    if (!user || user.id.startsWith('local_')) {
      throw new Error('需要云端模式才能加入配对');
    }

    try {
      const { data: pair } = await supabase
        .from('pairs')
        .select('*')
        .eq('pair_code', pairCode.toUpperCase())
        .eq('status', 'pending')
        .single();

      if (!pair) {
        throw new Error('配对码无效或已使用');
      }

      if (pair.user1_id === user.id) {
        throw new Error('不能加入自己的配对');
      }

      const { data: updatedPair } = await supabase
        .from('pairs')
        .update({
          user2_id: user.id,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', pair.id)
        .select()
        .single();

      const newPair: Pair = {
        id: updatedPair.id,
        pairCode: updatedPair.pair_code,
        user1Id: updatedPair.user1_id,
        user2Id: updatedPair.user2_id,
        status: updatedPair.status
      };

      set({ currentPair: newPair });
      
      await get().loadPartnerInfo();
    } catch (error) {
      console.error('Join pair error:', error);
      throw error;
    }
  },

  loadCurrentPair: async () => {
    const { user } = get();
    if (!user || user.id.startsWith('local_')) {
      return;
    }

    try {
      const { data: pair } = await supabase
        .from('pairs')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pair) {
        const currentPair: Pair = {
          id: pair.id,
          pairCode: pair.pair_code,
          user1Id: pair.user1_id,
          user2Id: pair.user2_id,
          status: pair.status
        };
        set({ currentPair });
      }
    } catch (error) {
      console.error('Load current pair error:', error);
    }
  },

  initializePair: async () => {
    await get().loadCurrentPair();
    await get().loadPartnerInfo();
  },

  loadPartnerInfo: async () => {
    const { user, currentPair } = get();
    if (!user || !currentPair || currentPair.status !== 'active') {
      set({ partner: null });
      return;
    }

    const partnerId = currentPair.user1Id === user.id ? currentPair.user2Id : currentPair.user1Id;
    if (!partnerId) {
      set({ partner: null });
      return;
    }

    try {
      const { data: partnerUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (partnerUser) {
        const partner: User = {
          id: partnerUser.id,
          name: partnerUser.name,
          nickname: partnerUser.nickname,
          deviceId: partnerUser.device_id,
          morningDeadline: partnerUser.morning_deadline || '06:30',
          afternoonDeadline: partnerUser.afternoon_deadline || '16:55',
        };
        set({ partner });
        
        await get().loadPartnerRecord();
      }
    } catch (error) {
      console.error('Load partner info error:', error);
    }
  },

  loadPartnerRecord: async (date?: string) => {
    const { user, currentPair } = get();
    if (!user || !currentPair || currentPair.status !== 'active') {
      return;
    }

    const partnerId = currentPair.user1Id === user.id ? currentPair.user2Id : currentPair.user1Id;
    if (!partnerId) {
      return;
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const { data: records } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', partnerId)
        .eq('date', targetDate);

      if (records && records.length > 0) {
        const record = records[0];
        set({
          partnerRecord: {
            id: record.id,
            userId: record.user_id,
            date: record.date,
            checkIn: record.check_in,
            checkOut: record.check_out,
            status: record.status,
          }
        });
      } else {
        set({ partnerRecord: null });
      }
    } catch (error) {
      console.error('Load partner record error:', error);
    }
  }
}));
