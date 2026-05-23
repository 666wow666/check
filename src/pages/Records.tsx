import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { Card } from '../components/common/Card';
import { supabase } from '../config/supabase';
import { AttendanceRecord } from '../types';

export const Records = () => {
  const { user, loadAllUsers, currentPair } = useAuthStore();
  const { records, loadRecords } = useAttendanceStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [viewUserName, setViewUserName] = useState<string>('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [partnerRecords, setPartnerRecords] = useState<AttendanceRecord[]>([]);
  const [partner, setPartner] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadRecords(user.id);
      loadPartner();
    }
  }, [user, loadRecords, currentPair]);

  useEffect(() => {
    if (viewUserId) {
      loadRecords(viewUserId);
    } else if (user) {
      loadRecords(user.id);
    }
  }, [viewUserId, user, loadRecords]);

  useEffect(() => {
    let channel: any = null;
    if (!user?.id.startsWith('local_')) {
      try {
        channel = supabase
          .channel('records_changes')
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
    setAllUsers(users);

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

  if (!user) return null;

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const formatDate = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  const getRecordForDate = (date: string, recordList: AttendanceRecord[]) => {
    const currentUserId = viewUserId || user.id;
    return recordList.find(r => r.userId === currentUserId && r.date === date);
  };

  const currentUserId = viewUserId || user.id;
  const monthRecords = records.filter(r => 
    r.userId === currentUserId && 
    r.date.startsWith(`${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`)
  );

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const getAmPmStatus = (
    checkIn: string | null,
    checkOut: string | null,
    status: string,
    isAm: boolean,
    partnerRecord?: AttendanceRecord | null
  ) => {
    const myChecked = status === 'checked' || status === 'late' || status === 'leave' || status === 'vacation';
    const partnerChecked = partnerRecord && (
      partnerRecord.status === 'checked' || 
      partnerRecord.status === 'late' || 
      partnerRecord.status === 'leave' || 
      partnerRecord.status === 'vacation'
    );

    const myAmChecked = checkIn !== null || status === 'leave' || status === 'vacation';
    const partnerAmChecked = partnerRecord?.checkIn !== null || partnerRecord?.status === 'leave' || partnerRecord?.status === 'vacation';

    const myPmChecked = checkOut !== null || status === 'leave' || status === 'vacation';
    const partnerPmChecked = partnerRecord?.checkOut !== null || partnerRecord?.status === 'leave' || partnerRecord?.status === 'vacation';

    if (isAm) {
      if (status === 'leave' || status === 'vacation') {
        return { color: 'bg-sky-100', text: '假' };
      }
      
      if (!myAmChecked && (!partnerAmChecked || !partnerRecord)) {
        return { color: 'bg-slate-50', text: '' };
      }
      
      if (myAmChecked) {
        return { color: 'bg-emerald-100', text: '✓' };
      } else if (!myAmChecked && partnerAmChecked) {
        return { color: 'bg-rose-100', text: '✗' };
      }
    } else {
      if (status === 'leave' || status === 'vacation') {
        return { color: 'bg-sky-100', text: '假' };
      }
      
      if (!myPmChecked && (!partnerPmChecked || !partnerRecord)) {
        return { color: 'bg-slate-50', text: '' };
      }
      
      if (myPmChecked) {
        return { color: 'bg-emerald-100', text: '✓' };
      } else if (!myPmChecked && partnerPmChecked) {
        return { color: 'bg-rose-100', text: '✗' };
      }
    }

    return { color: 'bg-slate-50', text: '' };
  };

  const toggleViewUser = () => {
    if (!partner) return;
    
    if (viewUserId) {
      setViewUserId(null);
      setViewUserName('');
    } else {
      setViewUserId(partner.id);
      setViewUserName(partner.nickname || partner.name);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'checked':
        return '已打卡';
      case 'late':
        return '迟到';
      case 'leave':
        return '请假';
      case 'vacation':
        return '休假';
      default:
        return '未打卡';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto p-6 pb-28">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            {partner && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200">
                <Users size={14} className="text-slate-500" />
                <button
                  onClick={toggleViewUser}
                  className="text-sm font-medium text-slate-700"
                >
                  {viewUserId ? viewUserName : user.nickname}
                </button>
              </div>
            )}
            <h2 className="text-lg font-semibold text-slate-900">
              {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
            </h2>
          </div>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <Card className="p-4 mb-6">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const dateStr = day ? formatDate(day) : '';
              const record = day ? getRecordForDate(dateStr, records) : null;
              const partnerRecord = day ? getRecordForDate(dateStr, partnerRecords) : null;
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              const amStatus = record ? getAmPmStatus(record.checkIn, record.checkOut, record.status, true, partnerRecord) : null;
              const pmStatus = record ? getAmPmStatus(record.checkIn, record.checkOut, record.status, false, partnerRecord) : null;

              return (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex flex-col
                    ${isToday ? 'bg-slate-100 ring-2 ring-slate-300' : 'bg-white'}
                  `}
                >
                  {day && (
                    <>
                      <div className={`flex-1 flex flex-col justify-center items-center ${amStatus?.color || 'bg-slate-50'} rounded-t-lg`}>
                        <span className="text-xs font-medium text-slate-600">{day}</span>
                        {amStatus?.text && (
                          <span className={`text-[10px] font-medium ${
                            amStatus.text === '✓' ? 'text-emerald-600' :
                            amStatus.text === '✗' ? 'text-rose-600' :
                            amStatus.text === '假' ? 'text-sky-600' :
                            'text-slate-400'
                          }`}>
                            {amStatus.text}
                          </span>
                        )}
                      </div>
                      <div className={`flex-1 flex flex-col justify-center items-center ${pmStatus?.color || 'bg-slate-50'} rounded-b-lg`}>
                        {pmStatus?.text && (
                          <span className={`text-[10px] font-medium ${
                            pmStatus.text === '✓' ? 'text-emerald-600' :
                            pmStatus.text === '✗' ? 'text-rose-600' :
                            pmStatus.text === '假' ? 'text-sky-600' :
                            'text-slate-400'
                          }`}>
                            {pmStatus.text}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-100"></div>
              <span className="text-xs text-slate-500">已打卡</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-rose-100"></div>
              <span className="text-xs text-slate-500">未打卡</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-sky-100"></div>
              <span className="text-xs text-slate-500">请假</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">本月考勤</h3>
          <div className="space-y-2">
            {monthRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 rounded-xl"
              >
                <div>
                  <p className="font-medium text-slate-900 text-sm">{record.date}</p>
                  <p className="text-xs text-slate-500">
                    {record.checkIn || '--:--'} · {record.checkOut || '--:--'}
                  </p>
                </div>
                <span className={`text-sm font-medium ${
                  record.status === 'checked' ? 'text-emerald-600' :
                  record.status === 'late' ? 'text-amber-600' :
                  record.status === 'leave' ? 'text-blue-600' :
                  record.status === 'vacation' ? 'text-purple-600' :
                  'text-slate-400'
                }`}>
                  {getStatusText(record.status)}
                </span>
              </div>
            ))}
            {monthRecords.length === 0 && (
              <p className="text-center text-slate-400 py-6">暂无打卡记录</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
