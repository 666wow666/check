import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Users, X, Calendar } from 'lucide-react';
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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

    const partnerId = currentPair.user1Id === user?.id ? currentPair.user2Id : currentPair.user1Id;
    if (!partnerId) {
      setPartner(null);
      return;
    }

    const users = await loadAllUsers();
    const partnerUser = users.find((u: any) => u.id === partnerId);
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
          const parsedData = JSON.parse(localData);
          // 转换旧格式的数据
          const mapped = parsedData.map((record: any) => {
            return {
              id: record.id,
              userId: record.userId || record.user_id,
              date: record.date,
              checkIn: record.checkIn || record.check_in,
              checkOut: record.checkOut || record.check_out,
              checkInPhoto: record.checkInPhoto || record.check_in_photo,
              checkOutPhoto: record.checkOutPhoto || record.check_out_photo,
              status: record.status,
            };
          });
          setPartnerRecords(mapped);
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
    return recordList.find((r) => r.userId === currentUserId && r.date === date);
  };

  const currentUserId = viewUserId || user.id;
  const monthRecords = records.filter((r) => 
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

  const getRecord = (dateStr: string) => {
    return getRecordForDate(dateStr, records);
  };

  const getPartnerRecord = (dateStr: string) => {
    return getRecordForDate(dateStr, partnerRecords);
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekDaysLocal = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekDaysLocal[date.getDay()]}`;
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'checked': return 'bg-emerald-100 text-emerald-800';
      case 'late': return 'bg-amber-100 text-amber-800';
      case 'leave': return 'bg-sky-100 text-sky-800';
      case 'vacation': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const ExpandedDateContent = ({ date }: { date: string }) => {
    const record = getRecord(date);
    const partnerRecord = getPartnerRecord(date);
    
    return (
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{formatDateDisplay(date)}</h3>
          <button onClick={() => setExpandedDate(null)} className="p-1 hover:bg-slate-100 rounded-full">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">我的打卡</p>
            {record ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-800">上午打卡</p>
                    <p className="text-xs text-slate-500">{record.checkIn || '未打卡'}</p>
                  </div>
                  {record.checkInPhoto && record.checkInPhoto.startsWith('data:image') ? (
                    <img
                      src={record.checkInPhoto}
                      alt="上午打卡照片"
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        console.error('图片加载失败:', e);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center">
                      <span className="text-xs text-slate-500">无照片</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-800">下午打卡</p>
                    <p className="text-xs text-slate-500">{record.checkOut || '未打卡'}</p>
                  </div>
                  {record.checkOutPhoto && record.checkOutPhoto.startsWith('data:image') ? (
                    <img
                      src={record.checkOutPhoto}
                      alt="下午打卡照片"
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        console.error('图片加载失败:', e);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center">
                      <span className="text-xs text-slate-500">无照片</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColorClass(record.status)}`}>
                    {getStatusText(record.status)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">今日未打卡</p>
            )}
          </div>
          
          {partner && partnerRecord && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-3">{partner.nickname || partner.name}的打卡</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-800">上午打卡</p>
                    <p className="text-xs text-slate-500">{partnerRecord.checkIn || '未打卡'}</p>
                  </div>
                  {partnerRecord.checkInPhoto && partnerRecord.checkInPhoto.startsWith('data:image') ? (
                    <img
                      src={partnerRecord.checkInPhoto}
                      alt="上午打卡照片"
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        console.error('图片加载失败:', e);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center">
                      <span className="text-xs text-slate-500">无照片</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-800">下午打卡</p>
                    <p className="text-xs text-slate-500">{partnerRecord.checkOut || '未打卡'}</p>
                  </div>
                  {partnerRecord.checkOutPhoto && partnerRecord.checkOutPhoto.startsWith('data:image') ? (
                    <img
                      src={partnerRecord.checkOutPhoto}
                      alt="下午打卡照片"
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        console.error('图片加载失败:', e);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center">
                      <span className="text-xs text-slate-500">无照片</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColorClass(partnerRecord.status)}`}>
                    {getStatusText(partnerRecord.status)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
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
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const dateStr = day ? formatDate(day) : '';
              const record = day ? getRecord(dateStr) : null;
              const partnerRecord = day ? getPartnerRecord(dateStr) : null;
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const isExpanded = expandedDate === dateStr;

              const amStatus = record ? getAmPmStatus(record.checkIn, record.checkOut, record.status, true, partnerRecord) : null;
              const pmStatus = record ? getAmPmStatus(record.checkIn, record.checkOut, record.status, false, partnerRecord) : null;

              const handleDateClick = () => {
                if (day) {
                  setExpandedDate(isExpanded ? null : dateStr);
                }
              };

              return (
                <div
                  key={index}
                  onClick={handleDateClick}
                  className={`aspect-square rounded-lg flex flex-col cursor-pointer transition-all
                    ${isToday ? 'bg-slate-100 ring-2 ring-slate-300' : 'bg-white'}
                    ${isExpanded ? 'ring-2 ring-blue-300' : ''}
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
        
        {expandedDate && <ExpandedDateContent date={expandedDate} />}
        
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Calendar size={18} className="text-slate-500" />
              本月考勤
            </h3>
            <span className="text-xs text-slate-500">共 {monthRecords.length} 条记录</span>
          </div>
          
          {monthRecords.length > 0 ? (
            <div className="space-y-3">
              {monthRecords.map((record) => {
                const getStatusIcon = (status: string) => {
                  switch (status) {
                    case 'checked': return '✓';
                    case 'late': return '!';
                    case 'leave': return '休';
                    case 'vacation': return '假';
                    default: return '-';
                  }
                };
                
                const getStatusBg = (status: string) => {
                  switch (status) {
                    case 'checked': return 'bg-emerald-50 border-emerald-200';
                    case 'late': return 'bg-amber-50 border-amber-200';
                    case 'leave': return 'bg-sky-50 border-sky-200';
                    case 'vacation': return 'bg-purple-50 border-purple-200';
                    default: return 'bg-slate-50 border-slate-200';
                  }
                };
                
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'checked': return 'text-emerald-700';
                    case 'late': return 'text-amber-700';
                    case 'leave': return 'text-sky-700';
                    case 'vacation': return 'text-purple-700';
                    default: return 'text-slate-500';
                  }
                };
                
                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:shadow-sm ${getStatusBg(record.status)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        record.status === 'checked' ? 'bg-emerald-100 text-emerald-700' :
                        record.status === 'late' ? 'bg-amber-100 text-amber-700' :
                        record.status === 'leave' ? 'bg-sky-100 text-sky-700' :
                        record.status === 'vacation' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {getStatusIcon(record.status)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{record.date}</p>
                        <p className="text-sm text-slate-500">
                          {record.checkIn || '--:--'} · {record.checkOut || '--:--'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)} ${
                      record.status === 'checked' ? 'bg-emerald-100' :
                      record.status === 'late' ? 'bg-amber-100' :
                      record.status === 'leave' ? 'bg-sky-100' :
                      record.status === 'vacation' ? 'bg-purple-100' :
                      'bg-slate-100'
                    }`}>
                      {getStatusText(record.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-400">暂无打卡记录</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
