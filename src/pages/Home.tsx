import { useEffect, useState } from 'react';
import { Settings, Users, Link2, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { BottomNav } from '../components/layout/BottomNav';
import { SettingsModal } from '../components/layout/SettingsModal';
import { CameraModal } from '../components/layout/CameraModal';
import { NameModal } from '../components/layout/NameModal';
import { PairModal } from '../components/layout/PairModal';
import { Button } from '../components/common/Button';
import { AttendanceRecord } from '../types';
import { getConnectionStatus } from '../config/supabase';

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
  const [settingsError, setSettingsError] = useState('');
  const [hasShownNameModal, setHasShownNameModal] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      const status = await getConnectionStatus();
      setConnectionStatus(status);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user && !hasShownNameModal) {
      setShowNameModal(true);
      setHasShownNameModal(true);
    }
  }, [user, hasShownNameModal]);

  useEffect(() => {
    if (user) {
      setShowNameModal(false);
    }
  }, [user]);

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
      await register(name);
      setShowNameModal(false);
    } catch (error) {
      console.error('注册失败:', error);
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

  const isBeforeNoon = new Date().getHours() < 12;

  const canPunchMorning = todayLeavePeriod !== 'morning' && todayLeavePeriod !== 'full' && !todayRecord?.checkIn;
  const canPunchAfternoon = todayLeavePeriod !== 'afternoon' && todayLeavePeriod !== 'full' && !todayRecord?.checkOut;

  const canLeaveMorning = !todayRecord?.checkIn && todayLeavePeriod !== 'morning' && todayLeavePeriod !== 'full';
  const canLeaveAfternoon = !todayRecord?.checkOut && todayLeavePeriod !== 'afternoon' && todayLeavePeriod !== 'full';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleSettingsSave = async () => {
    try {
      setSettingsError('');
      await updateNickname(nickname);
      await updateDeadlines(morningDeadline, afternoonDeadline);
      setShowSettings(false);
    } catch (error) {
      console.error('Save settings error:', error);
      if (error instanceof Error) {
        setSettingsError(error.message);
      } else {
        setSettingsError('保存失败，请重试');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      unchecked: { bg: 'bg-slate-100', text: 'text-slate-600', label: '未打卡' },
      checked: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '已打卡' },
      late: { bg: 'bg-amber-100', text: 'text-amber-700', label: '迟到' },
      leave: { bg: 'bg-blue-100', text: 'text-blue-700', label: '请假' },
      vacation: { bg: 'bg-purple-100', text: 'text-purple-700', label: '休假' },
    };
    const badge = badges[status] || badges.unchecked;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getActionButtons = () => {
    const buttons = [];

    if (isBeforeNoon) {
      if (canPunchMorning) {
        buttons.push({
          label: '上午打卡',
          icon: '☀️',
          onClick: () => {
            setShowCamera(true);
          },
          variant: 'primary' as const,
          disabled: false,
        });
      } else {
        buttons.push({
          label: todayRecord?.checkIn ? '上午已打卡' : '上午已请假',
          icon: '✓',
          onClick: () => {},
          variant: 'disabled' as const,
          disabled: true,
        });
      }
    } else {
      if (canPunchAfternoon) {
        buttons.push({
          label: '下午打卡',
          icon: '🌙',
          onClick: () => {
            setShowCamera(true);
          },
          variant: 'primary' as const,
          disabled: false,
        });
      } else {
        buttons.push({
          label: todayRecord?.checkOut ? '下午已打卡' : '下午已请假',
          icon: '✓',
          onClick: () => {},
          variant: 'disabled' as const,
          disabled: true,
        });
      }
    }

    const canLeave = isBeforeNoon ? canLeaveMorning : canLeaveAfternoon;
    if (canLeave) {
      buttons.push({
        label: '请假',
        icon: '💤',
        onClick: () => {
          setShowLeaveModal(true);
        },
        variant: 'secondary' as const,
        disabled: false,
      });
    } else {
      const leaveLabel = todayLeavePeriod !== 'none'
        ? (todayLeavePeriod === 'morning' ? '上午已请假' : todayLeavePeriod === 'afternoon' ? '下午已请假' : '已请假')
        : '已打卡';
      buttons.push({
        label: leaveLabel,
        icon: '✓',
        onClick: () => {},
        variant: 'disabled' as const,
        disabled: true,
      });
    }

    return buttons;
  };

  const handleLeave = async (period: 'morning' | 'afternoon') => {
    if (user) {
      await applyLeave(user.id, period);
      setShowLeaveModal(false);
    }
  };

  const handleCameraCapture = async (photoData: string) => {
    setShowCamera(false);
    if (user) {
      await punch(user.id, photoData, user.morningDeadline, user.afternoonDeadline);
    }
  };

  const getCurrentPeriod = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  const currentPeriod = getCurrentPeriod();

  const getGreeting = () => {
    if (currentPeriod === 'morning') return '早上好';
    if (currentPeriod === 'afternoon') return '下午好';
    return '晚上好';
  };

  const getPartnerInfo = () => {
    if (!currentPair?.status || currentPair.status !== 'active' || !partner) {
      return null;
    }

    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg">
            {partner.nickname.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="font-medium text-slate-900">{partner.nickname}</div>
            <div className="text-sm text-slate-500">
              {partnerRecord?.status ? getStatusBadge(partnerRecord.status) : '暂无记录'}
            </div>
          </div>
          <button
            onClick={() => setShowPairModal(true)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <Users size={18} className="text-slate-600" />
          </button>
        </div>
      </div>
    );
  };

  const getConnectionStatusIcon = () => {
    if (connectionStatus === 'connected') {
      return <Wifi size={14} className="text-emerald-500" />;
    }
    if (connectionStatus === 'disconnected') {
      return <WifiOff size={14} className="text-red-500" />;
    }
    return null;
  };

  const actionButtons = getActionButtons();

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-medium">{getGreeting()}</h1>
            <p className="text-slate-400 text-sm">{user.nickname}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPairModal(true)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Users size={20} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-3xl font-bold">{formatTime(currentTime)}</div>
          <div className="flex items-center gap-1">
            {getConnectionStatusIcon()}
            <span className="text-sm text-slate-400">
              {connectionStatus === 'connected' ? '已连接' : connectionStatus === 'disconnected' ? '离线' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Partner Info */}
      <div className="px-4 -mt-4">
        {getPartnerInfo()}
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Today's Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">今日打卡</h2>
            {getStatusBadge(todayStatus)}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-sm text-slate-500 mb-1">上午</div>
              <div className="text-lg font-medium text-slate-900">
                {todayRecord?.checkIn || '--:--'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-sm text-slate-500 mb-1">下午</div>
              <div className="text-lg font-medium text-slate-900">
                {todayRecord?.checkOut || '--:--'}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {actionButtons.map((button, index) => (
              <button
                key={index}
                onClick={button.onClick}
                disabled={button.disabled}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                  button.variant === 'primary'
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : button.variant === 'secondary'
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{button.icon}</span>
                <span>{button.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pair Info */}
        {!currentPair?.status || currentPair.status !== 'active' ? (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Link2 size={24} className="text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">配对接力</h3>
              <p className="text-sm text-slate-500">与朋友配对后可查看彼此的打卡情况</p>
            </div>
            <Button className="w-full" onClick={() => setShowPairModal(true)}>
              开始配对
            </Button>
          </div>
        ) : null}
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          setSettingsError('');
        }}
        nickname={nickname}
        onNicknameChange={setNickname}
        morningDeadline={morningDeadline}
        onMorningChange={setMorningDeadline}
        afternoonDeadline={afternoonDeadline}
        onAfternoonChange={setAfternoonDeadline}
        onSave={handleSettingsSave}
        error={settingsError}
      />

      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />

      <PairModal
        isOpen={showPairModal}
        onClose={handlePairClose}
      />

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">请假申请</h3>
            <p className="text-sm text-slate-600 mb-4">
              请选择请假的时间段（当前时段：{isBeforeNoon ? '上午' : '下午'}）
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleLeave('morning')}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium text-slate-700 transition-colors"
              >
                请假上午
              </button>
              <button
                onClick={() => handleLeave('afternoon')}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium text-slate-700 transition-colors"
              >
                请假下午
              </button>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};
