import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { Card } from '../components/common/Card';
import { supabase } from '../config/supabase';
import { AttendanceRecord } from '../types';

interface CalculatedBill {
  myExpense: number;
  myIncome: number;
  amNote: string;
  pmNote: string;
}

export const Billing = () => {
  const { user, loadAllUsers, currentPair } = useAuthStore();
  const { records, loadRecords, partnerRecord } = useAttendanceStore();
  const [partner, setPartner] = useState<any>(null);
  const [partnerRecords, setPartnerRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (user) {
      loadRecords(user.id);
      loadPartner();
    }
  }, [user, loadRecords, currentPair]);

  useEffect(() => {
    let channel: any = null;
    if (!user?.id.startsWith('local_')) {
      try {
        channel = supabase
          .channel('billing_records_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'attendance_records',
            },
            async () => {
              if (user) {
                await loadRecords(user.id);
                if (partner) {
                  loadPartnerRecords(partner.id);
                }
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Failed to subscribe:', error);
      }
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.error('Failed to unsubscribe:', error);
        }
      }
    };
  }, [user, loadRecords, partner]);

  const loadPartner = async () => {
    if (!currentPair || currentPair.status !== 'active') {
      setPartner(null);
      return;
    }

    // 确定另一个用户的 ID
    const partnerId = currentPair.user1Id === user?.id ? currentPair.user2Id : currentPair.user1Id;
    if (!partnerId) {
      setPartner(null);
      return;
    }

    // 加载配对用户信息
    const users = await loadAllUsers();
    const partnerUser = users.find(u => u.id === partnerId);
    setPartner(partnerUser || null);

    if (partnerUser) {
      loadPartnerRecords(partnerUser.id);
    }
  };

  const loadPartnerRecords = async (partnerId: string) => {
    try {
      if (partnerId.startsWith('local_')) {
        const localData = localStorage.getItem(`attendance_${partnerId}`);
        if (localData) {
          setPartnerRecords(JSON.parse(localData));
        }
      } else {
        const { data } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', partnerId);
        
        if (data) {
          const mapped = data.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            date: r.date,
            checkIn: r.check_in,
            checkOut: r.check_out,
            checkInPhoto: r.check_in_photo,
            checkOutPhoto: r.check_out_photo,
            status: r.status,
          }));
          setPartnerRecords(mapped);
        }
      }
    } catch (error) {
      console.error('Load partner records error:', error);
    }
  };

  const calculateBill = (): CalculatedBill => {
    const today = new Date().toISOString().split('T')[0];
    const myRecord = records.find(r => r.date === today);
    const partnerRecordToday = partnerRecord || partnerRecords.find(r => r.date === today);

    const myChecked = myRecord?.status === 'checked' || myRecord?.status === 'late' || myRecord?.status === 'leave' || myRecord?.status === 'vacation';
    const partnerChecked = partnerRecordToday?.status === 'checked' || partnerRecordToday?.status === 'late' || partnerRecordToday?.status === 'leave' || partnerRecordToday?.status === 'vacation';

    const myAmChecked = myRecord?.checkIn !== null || myRecord?.status === 'leave' || myRecord?.status === 'vacation';
    const partnerAmChecked = partnerRecordToday?.checkIn !== null || partnerRecordToday?.status === 'leave' || partnerRecordToday?.status === 'vacation';

    const myPmChecked = myRecord?.checkOut !== null || myRecord?.status === 'leave' || myRecord?.status === 'vacation';
    const partnerPmChecked = partnerRecordToday?.checkOut !== null || partnerRecordToday?.status === 'leave' || partnerRecordToday?.status === 'vacation';

    let myExpense = 0;
    let myIncome = 0;
    let amNote = '';
    let pmNote = '';

    if (myAmChecked && !partnerAmChecked) {
      myIncome += 10;
      amNote = '上午对方未打卡';
    } else if (!myAmChecked && partnerAmChecked) {
      myExpense += 10;
      amNote = '上午你未打卡';
    }

    if (myPmChecked && !partnerPmChecked) {
      myIncome += 10;
      pmNote = '下午对方未打卡';
    } else if (!myPmChecked && partnerPmChecked) {
      myExpense += 10;
      pmNote = '下午你未打卡';
    }

    return { myExpense, myIncome, amNote, pmNote };
  };

  const bill = calculateBill();
  const balance = bill.myIncome - bill.myExpense;

  const handleConfirm = async () => {
    if (balance === 0 || !user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const isLocalUser = user.id.startsWith('local_');
      
      if (isLocalUser) {
        alert('本地模式下已记录账单！');
        return;
      }
      
      if (bill.myExpense > 0) {
        await supabase.from('bills').insert({
          user_id: user.id,
          date: today,
          amount: bill.myExpense,
          description: bill.amNote + (bill.pmNote ? '；' : '') + bill.pmNote,
          type: 'expense',
          settled: false,
        });
      }
      
      if (bill.myIncome > 0 && partner) {
        await supabase.from('bills').insert({
          user_id: partner.id,
          date: today,
          amount: bill.myIncome,
          description: bill.amNote + (bill.pmNote ? '；' : '') + bill.pmNote,
          type: 'income',
          settled: false,
        });
      }
      
      alert('已确认账单！');
    } catch (error) {
      console.error('Confirm bill error:', error);
    }
  };

  const balanceColor = balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-900';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto p-6 pb-28 space-y-4">
        {partner ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center">
                <p className="text-sm text-slate-500 mb-1">我的待付</p>
                <p className="text-lg font-bold text-rose-600">¥{bill.myExpense.toFixed(2)}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-slate-500 mb-1">我的待收</p>
                <p className="text-lg font-bold text-emerald-600">¥{bill.myIncome.toFixed(2)}</p>
              </Card>
            </div>

            <Card className="p-6 text-center">
              <p className="text-sm text-slate-500 mb-2">合计</p>
              <p className={`text-2xl font-bold ${balanceColor}`}>¥{balance.toFixed(2)}</p>
              {balance !== 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  {bill.amNote}{bill.pmNote ? '；' : ''}{bill.pmNote}
                </p>
              )}
            </Card>

            <button
              disabled={balance === 0}
              onClick={handleConfirm}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                balance === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              {balance === 0 ? '无账单' : balance > 0 ? '确认已收款' : '确认已付款'}
            </button>
          </>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-slate-500">请先在首页建立配对</p>
          </Card>
        )}
      </div>
    </div>
  );
};
