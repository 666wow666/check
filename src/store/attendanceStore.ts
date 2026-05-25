import { create } from 'zustand';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AttendanceRecord } from '../types';
import { supabase } from '../config/supabase';

const getLocalRecordsKey = (userId: string) => `attendance_${userId}`;

const saveLocalRecords = (userId: string, records: AttendanceRecord[]) => {
  localStorage.setItem(getLocalRecordsKey(userId), JSON.stringify(records));
};

const loadLocalRecords = (userId: string): AttendanceRecord[] => {
  const data = localStorage.getItem(getLocalRecordsKey(userId));
  if (!data) return [];
  
  // 转换旧格式的数据（下划线命名到驼峰命名）
  const parsedData = JSON.parse(data);
  return parsedData.map((record: any) => {
    return {
      id: record.id,
      userId: record.userId || record.user_id,
      date: record.date,
      checkIn: record.checkIn || record.check_in,
      checkOut: record.checkOut || record.check_out,
      checkInPhoto: record.checkInPhoto || record.check_in_photo,
      checkOutPhoto: record.checkOutPhoto || record.check_out_photo,
      status: record.status,
      leavePeriod: record.leavePeriod || 'none',
    };
  });
};

interface AttendanceState {
  records: AttendanceRecord[];
  todayRecord: AttendanceRecord | null;
  partnerRecord: AttendanceRecord | null;
  channel: RealtimeChannel | null;
  loadRecords: (userId: string) => Promise<void>;
  loadPartnerRecord: (partnerId: string) => Promise<void>;
  punch: (userId: string, photoData: string, morningDeadline: string, afternoonDeadline: string) => Promise<void>;
  applyLeave: (userId: string, period: 'morning' | 'afternoon') => Promise<void>;
  getTodayRecord: (userId: string) => AttendanceRecord | null;
  getMonthlyRecords: (userId: string, month: string) => AttendanceRecord[];
  calculateMonthlyStats: (userId: string, month: string) => {
    attendDays: number;
    lateCount: number;
    leaveDays: number;
    vacationDays: number;
  };
  setTodayRecord: (record: AttendanceRecord | null) => void;
  subscribeToAttendance: (userId: string, partnerId: string, onPartnerUpdate: (record: AttendanceRecord | null) => void) => void;
  unsubscribe: () => void;
}

const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const getCurrentTime = () => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

const isBeforeNoon = (time: string) => {
  const [hours] = time.split(':').map(Number);
  return hours < 12;
};

const isLate = (time: string, deadline: string) => {
  return time > deadline;
};

const mapDbToRecord = (data: any): AttendanceRecord => ({
  id: data.id,
  userId: data.user_id,
  date: data.date,
  checkIn: data.check_in,
  checkOut: data.check_out,
  checkInPhoto: data.check_in_photo,
  checkOutPhoto: data.check_out_photo,
  status: data.status,
  leavePeriod: data.leave_period || 'none',
});

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: [],
  todayRecord: null,
  partnerRecord: null,
  channel: null,

  loadRecords: async (userId: string) => {
    try {
      const { data: records } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      const mappedRecords = records?.map(mapDbToRecord) || [];
      set({ records: mappedRecords });
      saveLocalRecords(userId, mappedRecords);

      const today = getTodayDateString();
      const todayRecord = mappedRecords.find(r => r.date === today) || null;
      set({ todayRecord });
    } catch (error) {
      console.error('Load records error:', error);
      const localRecords = loadLocalRecords(userId);
      set({ records: localRecords });
      const today = getTodayDateString();
      const todayRecord = localRecords.find(r => r.date === today) || null;
      set({ todayRecord });
    }
  },

  loadPartnerRecord: async (partnerId: string) => {
    try {
      const today = getTodayDateString();
      const { data: record } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', partnerId)
        .eq('date', today)
        .single();

      set({ partnerRecord: record ? mapDbToRecord(record) : null });
    } catch (error) {
      console.error('Load partner record error:', error);
      set({ partnerRecord: null });
    }
  },

  punch: async (userId: string, photoData: string, morningDeadline: string, afternoonDeadline: string) => {
    const today = getTodayDateString();
    const time = getCurrentTime();
    const isBefore12 = isBeforeNoon(time);
    const deadline = isBefore12 ? morningDeadline : afternoonDeadline;
    const late = isLate(time, deadline);
    const { records } = get();

    const existingRecord = records.find(r => r.userId === userId && r.date === today);
    const isLocalUser = userId.startsWith('local_');

    try {
      if (existingRecord) {
        const alreadyPunchedBefore12 = existingRecord.checkIn !== null;
        const alreadyPunchedAfter12 = existingRecord.checkOut !== null;
        
        if (isBefore12 && alreadyPunchedBefore12) return;
        if (!isBefore12 && alreadyPunchedAfter12) return;

        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (isBefore12) {
          updateData.check_in = time;
          updateData.check_in_photo = photoData;
        } else {
          updateData.check_out = time;
          updateData.check_out_photo = photoData;
        }
        
        if (late) {
          updateData.status = 'late';
        } else if (existingRecord.status !== 'leave' && existingRecord.status !== 'vacation') {
          updateData.status = 'checked';
        }

        let updatedRecords;
        if (isLocalUser) {
          updatedRecords = records.map(r => {
            if (r.id === existingRecord.id) {
              const updatedRecord = { ...r };
              if (isBefore12) {
                updatedRecord.checkIn = time;
                updatedRecord.checkInPhoto = photoData;
              } else {
                updatedRecord.checkOut = time;
                updatedRecord.checkOutPhoto = photoData;
              }
              if (late) {
                updatedRecord.status = 'late';
              } else if (r.status !== 'leave' && r.status !== 'vacation') {
                updatedRecord.status = 'checked';
              }
              return updatedRecord;
            }
            return r;
          });
        } else {
          await supabase
            .from('attendance_records')
            .update(updateData)
            .eq('id', existingRecord.id);

          updatedRecords = records.map(r => {
            if (r.id === existingRecord.id) {
              const updatedRecord = { ...r };
              if (isBefore12) {
                updatedRecord.checkIn = time;
                updatedRecord.checkInPhoto = photoData;
              } else {
                updatedRecord.checkOut = time;
                updatedRecord.checkOutPhoto = photoData;
              }
              if (late) {
                updatedRecord.status = 'late';
              } else if (r.status !== 'leave' && r.status !== 'vacation') {
                updatedRecord.status = 'checked';
              }
              return updatedRecord;
            }
            return r;
          });
        }

        set({ records: updatedRecords });
        saveLocalRecords(userId, updatedRecords);
        const updatedTodayRecord = updatedRecords.find(r => r.id === existingRecord.id) || null;
        set({ todayRecord: updatedTodayRecord });
      } else {
        const newId = isLocalUser ? 'local_' + Date.now() : null;
        const newRecordData: any = isLocalUser ? {
          id: newId,
          user_id: userId,
          date: today,
          check_in: isBefore12 ? time : null,
          check_out: !isBefore12 ? time : null,
          check_in_photo: isBefore12 ? photoData : null,
          check_out_photo: !isBefore12 ? photoData : null,
          status: late ? 'late' : 'checked',
        } : {
          user_id: userId,
          date: today,
          check_in: isBefore12 ? time : null,
          check_out: !isBefore12 ? time : null,
          check_in_photo: isBefore12 ? photoData : null,
          check_out_photo: !isBefore12 ? photoData : null,
          status: late ? 'late' : 'checked',
        };

        let newRecordMapped: AttendanceRecord;
        if (isLocalUser) {
          newRecordMapped = {
            id: newId as string,
            userId: userId,
            date: today,
            checkIn: isBefore12 ? time : null,
            checkOut: !isBefore12 ? time : null,
            checkInPhoto: isBefore12 ? photoData : null,
            checkOutPhoto: !isBefore12 ? photoData : null,
            status: late ? 'late' : 'checked',
            leavePeriod: 'none',
          };
        } else {
          const { data: newRecord } = await supabase
            .from('attendance_records')
            .insert(newRecordData)
            .select()
            .single();
          
          newRecordMapped = mapDbToRecord(newRecord);
        }

        const updatedRecords = [...records, newRecordMapped];
        set({ records: updatedRecords, todayRecord: newRecordMapped });
        saveLocalRecords(userId, updatedRecords);
      }
    } catch (error) {
      console.error('Punch error:', error);
    }
  },

  applyLeave: async (userId: string, period: 'morning' | 'afternoon') => {
    const today = getTodayDateString();
    const { records } = get();

    const existingRecord = records.find(r => r.userId === userId && r.date === today);
    const isLocalUser = userId.startsWith('local_');

    try {
      let newStatus = 'leave';
      let newLeavePeriod: 'none' | 'morning' | 'afternoon' | 'full' = period;

      // 如果已经存在记录
      if (existingRecord) {
        // 如果已经请假半天，再请假另半天则转为全天
        if (existingRecord.leavePeriod === 'morning' && period === 'afternoon' ||
            existingRecord.leavePeriod === 'afternoon' && period === 'morning') {
          newLeavePeriod = 'full';
        } else if ((existingRecord.leavePeriod as any) === period) {
          // 如果请假相同时间段，取消请假
          newLeavePeriod = 'none';
          newStatus = existingRecord.checkIn || existingRecord.checkOut ? 
                     (existingRecord.status === 'late' ? 'late' : 'checked') : 'unchecked';
        }

        const updateData: any = {
          updated_at: new Date().toISOString(),
          leave_period: newLeavePeriod,
        };

        // 如果取消请假，根据已有打卡状态设置
        if (newLeavePeriod === 'none') {
          updateData.status = newStatus;
        } else {
          updateData.status = 'leave';
        }

        let updatedRecords;
        if (isLocalUser) {
          updatedRecords = records.map(r => {
            if (r.id === existingRecord.id) {
              const updatedRecord = { ...r };
              updatedRecord.leavePeriod = newLeavePeriod;
              updatedRecord.status = newStatus as any;
              return updatedRecord;
            }
            return r;
          });
        } else {
          await supabase
            .from('attendance_records')
            .update(updateData)
            .eq('id', existingRecord.id);

          updatedRecords = records.map(r => {
            if (r.id === existingRecord.id) {
              const updatedRecord = { ...r };
              updatedRecord.leavePeriod = newLeavePeriod;
              updatedRecord.status = newStatus as any;
              return updatedRecord;
            }
            return r;
          });
        }

        set({ records: updatedRecords });
        saveLocalRecords(userId, updatedRecords);
        const updatedTodayRecord = updatedRecords.find(r => r.id === existingRecord.id) || null;
        set({ todayRecord: updatedTodayRecord });
      } else {
        // 创建新记录
        const newId = isLocalUser ? 'local_' + Date.now() : null;
        const newRecordData: any = isLocalUser ? {
          id: newId,
          user_id: userId,
          date: today,
          check_in: null,
          check_out: null,
          check_in_photo: null,
          check_out_photo: null,
          status: 'leave',
          leave_period: period,
        } : {
          user_id: userId,
          date: today,
          check_in: null,
          check_out: null,
          check_in_photo: null,
          check_out_photo: null,
          status: 'leave',
          leave_period: period,
        };

        let newRecordMapped: AttendanceRecord;
        if (isLocalUser) {
          newRecordMapped = {
            id: newId as string,
            userId: userId,
            date: today,
            checkIn: null,
            checkOut: null,
            checkInPhoto: null,
            checkOutPhoto: null,
            status: 'leave',
            leavePeriod: period,
          };
        } else {
          const { data: newRecord } = await supabase
            .from('attendance_records')
            .insert(newRecordData)
            .select()
            .single();
          
          newRecordMapped = mapDbToRecord(newRecord);
        }

        const updatedRecords = [...records, newRecordMapped];
        set({ records: updatedRecords, todayRecord: newRecordMapped });
        saveLocalRecords(userId, updatedRecords);
      }
    } catch (error) {
      console.error('Apply leave error:', error);
    }
  },

  getTodayRecord: (userId: string) => {
    const today = getTodayDateString();
    const { records } = get();
    return records.find(r => r.userId === userId && r.date === today) || null;
  },

  getMonthlyRecords: (userId: string, month: string) => {
    const { records } = get();
    return records.filter(r => r.userId === userId && r.date.startsWith(month));
  },

  calculateMonthlyStats: (userId: string, month: string) => {
    const monthlyRecords = get().getMonthlyRecords(userId, month);
    return {
      attendDays: monthlyRecords.filter(r => r.status === 'checked').length,
      lateCount: monthlyRecords.filter(r => r.status === 'late').length,
      leaveDays: monthlyRecords.filter(r => r.status === 'leave').length,
      vacationDays: monthlyRecords.filter(r => r.status === 'vacation').length,
    };
  },

  setTodayRecord: (record: AttendanceRecord | null) => {
    set({ todayRecord: record });
  },

  subscribeToAttendance: (userId: string, partnerId: string, onPartnerUpdate: (record: AttendanceRecord | null) => void) => {
    const { channel } = get();

    if (partnerId.startsWith('local_')) {
      return;
    }

    if (channel) {
      channel.unsubscribe();
    }

    try {
      const newChannel = supabase
        .channel('attendance_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_records',
            filter: `user_id=eq.${partnerId}`,
          },
          (payload) => {
            const today = getTodayDateString();
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const record = payload.new as any;
              if (record.date === today) {
                const mappedRecord = mapDbToRecord(record);
                set({ partnerRecord: mappedRecord });
                onPartnerUpdate(mappedRecord);
              }
            } else if (payload.eventType === 'DELETE') {
              set({ partnerRecord: null });
              onPartnerUpdate(null);
            }
          }
        )
        .subscribe();

      set({ channel: newChannel });
    } catch (error) {
      console.error('Subscribe error:', error);
    }
  },

  unsubscribe: () => {
    const { channel } = get();
    if (channel) {
      channel.unsubscribe();
      set({ channel: null });
    }
  },
}));
