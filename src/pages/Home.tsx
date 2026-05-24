import { useEffect, useState } from 'react';
import { Settings, Users, Link2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { BottomNav } from '../components/layout/BottomNav';
import { SettingsModal } from '../components/layout/SettingsModal';
import { CameraModal } from '../components/layout/CameraModal';
import { NameModal } from '../components/layout/NameModal';
import { PairModal } from '../components/layout/PairModal';
import { AttendanceRecord } from '../types';
import { supabase } from '../config/supabase';

export const Home = () => {
  const { 
    user, 
    register, 
    updateNickname, 
    updateDeadlines, 
    currentPair,
    partner,
    partnerRecord
  } = useAuthStore();
  const { 
    records, 
    loadRecords, 
    punch, 
    loadPartnerRecord, 
    subscribeToAttendance, 
    unsubscribe,
    setTodayRecord 
  } = useAttendanceStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [morningDeadline, setMorningDeadline] = useState(user?.morningDeadline || '06:30');
  const [afternoonDeadline, setAfternoonDeadline] = useState(user?.afternoonDeadline || '16:55');
  // 添加一个标志，避免反复触发
  const [hasShownNameModal, setHasShownNameModal] = useState(false);

  // 只在第一次检测到 user 为 null 且还没显示过 nameModal 时才显示
  useEffect(() => {
    if (!user && !hasShownNameModal) {
      setShowNameModal(true);
      setHasShownNameModal(true);
    }
  }, [user, hasShownNameModal]);

  useEffect(() => {
    if (user) {
      loadRecords(user.id);
      setNickname(user.nickname);
      setMorningDeadline(user.morningDeadline);
      setAfternoonDeadline(user.afternoonDeadline);
    }
  }, [user, loadRecords]);

  useEffect(() => {
    if (user && currentPair?.status === 'active') {
      loadPartnerRecord(partner?.id);
      subscribeToAttendance(user.id, partner?.id, handlePartnerUpdate);
    }

    return () => {
      unsubscribe();
    };
  }, [user, currentPair, partner]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePartnerUpdate = (record: AttendanceRecord | null) => {
    console.log('Partner attendance updated:', record);
    if (record) {
      loadPartnerRecord(partner?.id);
    }
  };

  const handleNameSubmit = async (name: string) => {
    try {
      // 先立即关闭模态框，避免状态更新导致重新打开
      setShowNameModal(false);
      // 然后执行注册
      await register(name);
    } catch (error) {
      console.error('注册失败:', error);
      // 如果注册失败，重新显示模态框
      setShowNameModal(true);
    }
  };

  const handlePairClose = () => {
    setShowPairModal(false);
  };

  if (showNameModal) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NameModal isOpen={showNameModal} onSubmit={handleNameSubmit} />
      </div>
    );
  }

  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayRecord = records.find(r => r.date === today);
  const todayStatus = todayRecord?.status || 'unchecked';
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleSettingsSave = () => {
    updateNickname(nickname);
    updateDeadlines(morningDeadline, afternoonDeadline);
    setShowSettings(false);
  };

  const handleCapture = (photoData: string) => {
    punch(user.id, photoData, user.morningDeadline, user.afternoonDeadline);
  };

  const handleLeave = async () => {
    if (!user || todayRecord?.status === 'leave' || todayRecord?.status === 'vacation') return;

    try {
      const existingRecord = records.find(r => r.date === today);
      const isLocalUser = user.id.startsWith('local_');

      if (existingRecord) {
        let updatedRecords;
        if (isLocalUser) {
          updatedRecords = records.map(r => {
            if (r.id === existingRecord.id) {
              return { ...r, status: 'leave' as const };
            }
            return r;
          });
        } else {
          await supabase
            .from('attendance_records')
            .update({ 
              status: 'leave',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingRecord.id);

          updatedRecords = records.map(r => {
            if (r.id === existingRecord.id) {
              return { ...r, status: 'leave' as const };
            }
            return r;
          });
        }

        const updatedRecord = { ...existingRecord, status: 'leave' as const };
        loadRecords(user.id);
        setTodayRecord(updatedRecord);
      } else {
        const newId = isLocalUser ? 'local_' + Date.now() : null;
        const newRecord: any = {
          id: newId,
          user_id: user.id,
          userId: user.id,
          date: today,
          status: 'leave',
        };

        if (isLocalUser) {
          const updatedRecords = [...records, newRecord];
          localStorage.setItem(`attendance_${user.id}`, JSON.stringify(updatedRecords));
          loadRecords(user.id);
        } else {
          const { data: insertedRecord } = await supabase
            .from('attendance_records')
            .insert({
              user_id: user.id,
              date: today,
              status: 'leave',
            })
            .select()
            .single();

          if (insertedRecord) {
            loadRecords(user.id);
          }
        }
      }

      alert('请假已记录！');
    } catch (error) {
      console.error('Leave error:', error);
      alert('请假记录失败');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked':
        return 'bg-emerald-500';
      case 'late':
        return 'bg-amber-500';
      case 'leave':
        return 'bg-blue-500';
      case 'vacation':
        return 'bg-purple-500';
      default:
        return 'bg-emerald-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'checked':
        return '已打卡';
      case 'late':
        return '迟到';
      case 'leave':
        return '请假中';
      case 'vacation':
        return '休假中';
      default:
        return '未打卡';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto">
        <div className="p-6 pb-32">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{user.nickname}</h1>
              <p className="text-slate-500">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2">
              {!partner && !user.id.startsWith('local_') && (
                <button
                  onClick={() => setShowPairModal(true)}
                  className="p-3 hover:bg-slate-100 rounded-full transition-colors"
                  title="建立连接"
                >
                  <Link2 size={24} className="text-slate-600" />
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="p-3 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Settings size={24} className="text-slate-600" />
              </button>
            </div>
          </div>

          {partner ? (
            <div className="mb-6 p-4 bg-white rounded-xl shadow-sm">
              <p className="text-sm text-slate-500 mb-2">{partner.nickname || partner.name} 的打卡状态</p>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(partnerRecord?.status || 'unchecked')}`}></div>
                <span className="text-lg font-medium text-slate-900">
                  {getStatusText(partnerRecord?.status || 'unchecked')}
                </span>
                {partnerRecord && (partnerRecord.checkIn || partnerRecord.checkOut) && (
                  <span className="text-sm text-slate-500">
                    {partnerRecord.checkIn || '--:--'} · {partnerRecord.checkOut || '--:--'}
                  </span>
                )}
              </div>
            </div>
          ) : !user.id.startsWith('local_') ? (
            <div className="mb-6 p-4 bg-slate-100 rounded-xl text-center">
              <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500 mb-3">还未建立连接</p>
              <button
                onClick={() => setShowPairModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                立即连接
              </button>
            </div>
          ) : null}

          <div className="flex justify-center py-8">
            <div className="flex flex-col items-center">
              <div className="text-4xl font-bold text-slate-900 mb-12 font-mono">
                {formatTime(currentTime)}
              </div>
              
              <button
                onClick={() => setShowCamera(true)}
                className={`w-48 h-48 rounded-full ${getStatusColor(todayStatus)} flex items-center justify-center shadow-lg hover:scale-105 transition-transform ${todayStatus !== 'unchecked' ? 'opacity-50' : ''}`}
                disabled={todayStatus !== 'unchecked'}
              >
                <div className="text-white text-center">
                  <div className="text-2xl font-bold mb-2">{getStatusText(todayStatus)}</div>
                  <div className="text-sm opacity-80">点击打卡</div>
                </div>
              </button>
              
              <button
                onClick={handleLeave}
                disabled={todayStatus === 'leave' || todayStatus === 'vacation' || todayStatus !== 'unchecked'}
                className={`mt-12 px-8 py-3 font-medium rounded-full shadow-lg transition-colors ${
                  todayStatus === 'unchecked'
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {todayStatus === 'unchecked' ? '请假' : '已请假'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        nickname={nickname}
        onNicknameChange={setNickname}
        morningDeadline={morningDeadline}
        onMorningChange={setMorningDeadline}
        afternoonDeadline={afternoonDeadline}
        onAfternoonChange={setAfternoonDeadline}
        onSave={handleSettingsSave}
      />

      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCapture}
      />

      <PairModal
        isOpen={showPairModal}
        onClose={handlePairClose}
      />
    </div>
  );
};
