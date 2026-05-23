import { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Share2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { supabase } from '../../config/supabase';

interface PairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PairModal = ({ isOpen, onClose }: PairModalProps) => {
  const { user, currentPair, createPairCode, joinPair, loadCurrentPair } = useAuthStore();
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [pairCode, setPairCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      if (currentPair) {
        if (currentPair.status === 'active') {
          onClose();
        } else {
          setMode('create');
          setPairCode(currentPair.pairCode);
        }
      } else {
        setMode('select');
      }
    }
  }, [isOpen, user, currentPair]);

  useEffect(() => {
    let channel: any = null;
    if (isOpen && mode === 'create' && currentPair?.id) {
      try {
        channel = supabase
          .channel('pair-waiting')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'pairs',
              filter: `id=eq.${currentPair.id}`
            },
            async (payload: any) => {
              if (payload.new.status === 'active') {
                await loadCurrentPair();
                onClose();
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
  }, [isOpen, mode, currentPair?.id, loadCurrentPair, onClose]);

  const handleCreatePair = async () => {
    if (!user || user.id.startsWith('local_')) {
      setError('需要云端模式才能使用配对功能');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const code = await createPairCode();
      setPairCode(code);
      setMode('create');
    } catch (err: any) {
      setError(err.message || '创建配对失败');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPair = async () => {
    if (!pairCode.trim()) {
      setError('请输入配对码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await joinPair(pairCode);
      await loadCurrentPair();
      onClose();
    } catch (err: any) {
      setError(err.message || '加入配对失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === 'select' && '建立连接'}
            {mode === 'create' && '分享配对码'}
            {mode === 'join' && '加入配对'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
            <span>{error}</span>
          </div>
        )}

        {mode === 'select' && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">选择一种方式建立连接：</p>
            <Button 
              onClick={handleCreatePair} 
              loading={loading}
              className="w-full flex items-center justify-center gap-2"
            >
              <Share2 size={18} />
              创建配对码
            </Button>
            <Button 
              onClick={() => setMode('join')} 
              variant="secondary" 
              className="w-full flex items-center justify-center gap-2"
            >
              <Users size={18} />
              输入配对码加入
            </Button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm mb-4">让对方输入以下配对码：</p>
            <div className="bg-slate-100 rounded-xl p-6 text-center">
              <div className="text-4xl font-mono font-bold tracking-widest text-slate-800">
                {pairCode || '生成中...'}
              </div>
            </div>
            <Button 
              onClick={handleCopyCode} 
              variant="secondary" 
              className="w-full flex items-center justify-center gap-2"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? '已复制' : '复制配对码'}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              等待对方加入...
            </p>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                配对码
              </label>
              <input
                type="text"
                value={pairCode}
                onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                placeholder="输入6位配对码"
                maxLength={6}
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-center text-2xl font-mono tracking-widest"
              />
            </div>
            <Button 
              onClick={handleJoinPair} 
              loading={loading}
              className="w-full"
            >
              加入配对
            </Button>
            <button 
              onClick={() => setMode('select')}
              className="w-full text-sm text-slate-500 hover:text-slate-700 py-2"
            >
              返回
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};
