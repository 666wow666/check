import { useEffect, useState } from 'react';
import { Settings, Users, Link2, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { BottomNav } from '../components/layout/BottomNav';
import { SettingsModal } from '../components/layout/SettingsModal';
import { CameraModal } from '../components/layout/CameraModal';
import { NameModal } from '../components/layout/NameModal';
import { PairModal } from '../components/layout/PairModal';
import { AttendanceRecord } from '../types';
import { checkSupabaseConnection, isSupabaseConnected, getConnectionStatus } from '../config/supabase';

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
    applyLeave,
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
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [morningDeadline, setMorningDeadline] = useState(user?.morningDeadline || '06:30');
  const [afternoonDeadline, setAfternoonDeadline] = useState(user?.afternoonDeadline || '16:55');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  // 添加一个标志，避免反复触发
  const [hasShownNameModal, setHasShownNameModal] = useState(false);

  // 检查 Supabase 连接
  useEffect(() => {
    const checkConnection = async () => {
      const isConnected = await checkSupabaseConnection();
      setConnectionStatus(getConnectionStatus());
    };

    checkConnection();

    // 每隔 30 秒检查一次连接
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

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
  const todayLeavePeriod = todayRecord?.leavePeriod || 'none';
  
  // 判断某个时间段是否可以打卡
  const canPunchMorning = todayLeavePeriod !== 'morning' && todayLeavePeriod !== 'full' && !todayRecord?.checkIn;
  const canPunchAfternoon = todayLeavePeriod !== 'afternoon' && todayLeavePeriod !== 'full' && !todayRecord?.checkOut;
  const isBeforeNoon = new Date().getHours() < 12;
  
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

  const handleApplyLeave = async (period: 'morning' | 'afternoon') => {
    if (!user) return;
    
    try {
      await applyLeave(user.id, period);
      setShowLeaveModal(false);
    } catch (error) {
      console.error('Leave error:', error);
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

  const getStatusText = (status: string, leavePeriod?: string) => {
    if (status === 'leave') {
      switch (leavePeriod) {
        case 'morning':
          return '上午请假';
        case 'afternoon':
          return '下午请假';
        case 'full':
          return '全天请假';
        default:
          return '请假中';
      }
    }
    switch (status) {
      case 'checked':
        return '已打卡';
      case 'late':
        return '迟到';
      case 'vacation':
        return '休假中';
      default:
        return '未打卡';
    }
  };

  const getConnectionIcon = () => {
    if (user?.id.startsWith('local_')) {
      return <WifiOff size={18} className="text-slate-400" />;
    }
    if (connectionStatus === 'connected') {
      return <Wifi size={18} className="text-emerald-500" />;
    }
    return <WifiOff size={18} className="text-amber-500" />;
  };

  const getConnectionTitle = () => {
    if (user?.id.startsWith('local_')) {
      return '本地模式';
    }
    if (connectionStatus === 'connected') {
      return '云端已连接';
    }
    return '云端连接失败';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto">
        <div className="p-6 pb-32">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{user.nickname}</h1>
              <div className="flex items-center gap-2">
                <p className="text-slate-500">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</p>
                <span className="text-xs text-slate-400" title={getConnectionTitle()}>
                  {getConnectionIcon()}
                </span>
              </div>
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
                className={`w-48 h-48 rounded-full ${getStatusColor(todayStatus)} flex items-center justify-center shadow-lg hover:scale-105 transition-transform ${(todayStatus !== 'unchecked' && todayStatus !== 'leave') ? 'opacity-50' : ''}`}
                disabled={todayStatus !== 'unchecked' && todayStatus !== 'leave'}
              >
                <div className="text-white text-center">
                  <div className="text-2xl font-bold mb-2">{getStatusText(todayStatus, todayLeavePeriod)}</div>
                  <div className="text-sm opacity-80">点击打卡</div>
                </div>
              </button>
              
              <div className="mt-12 flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => {
                    // 根据当前时间判断上午还是下午
                    const hour = new Date().getHours();
                    const period = hour < 12 ? 'morning' : 'afternoon';
                    const confirmText = period === 'morning' ? '上午' : '下午';
                    
                    if (confirm(`确定要请${confirmText}假吗？`)) {
                      applyLeave(user.id, period);
                    }
                  }}
                  className={`flex-1 px-6 py-3 font-medium rounded-full shadow-lg transition-colors ${
                    todayStatus === 'vacation'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                  disabled={todayStatus === 'vacation'}
                >
                  请假
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 请假模态框 */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">选择请假时间</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handleApplyLeave('morning')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  todayLeavePeriod === 'morning' || todayLeavePeriod === 'full'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-2xl mb-2">🌅</div>
                <div className="font-medium text-slate-900">上午</div>
                <div className="text-sm text-slate-500">
                  {todayLeavePeriod === 'morning' || todayLeavePeriod === 'full' ? '已请假' : ''}
                </div>
              </button>
              <button
                onClick={() => handleApplyLeave('afternoon')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  todayLeavePeriod === 'afternoon' || todayLeavePeriod === 'full'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-2xl mb-2">🌅</div>
                <div className="font-medium text-slate-900">下午</div>
                <div className="text-sm text-slate-500">
                  {todayLeavePeriod === 'afternoon' || todayLeavePeriod === 'full' ? '已请假' : ''}
                </div>
              </button>
            </div>
            {todayLeavePeriod !== 'none' && (
              <p className="text-center text-sm text-slate-500 mb-4">
                再次点击可取消该时段请假
              </p>
            )}
            <button
              onClick={() => setShowLeaveModal(false)}
              className="w-full py-3 bg-slate-100 text-slate-700 font-medium rounded-full hover:bg-slate-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

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
