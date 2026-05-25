import { useState } from 'react';
import { Clock, RefreshCw, UserPlus } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useAuthStore } from '../../store/authStore';

interface NameModalProps {
  isOpen: boolean;
  onSubmit: (name: string) => void;
}

export const NameModal = ({ isOpen, onSubmit }: NameModalProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreOption, setShowRestoreOption] = useState(false);
  const { checkNameExists, restoreUserByName } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || isRestoring) return;
    
    setError('');

    if (!name.trim()) {
      setError('请输入您的名字');
      return;
    }

    // 先检查名字是否存在
    try {
      setIsSubmitting(true);
      const exists = await checkNameExists(name.trim());
      
      if (exists && !showRestoreOption) {
        setShowRestoreOption(true);
        setIsSubmitting(false);
        return;
      }

      if (exists && showRestoreOption) {
        // 尝试恢复账号
        setIsRestoring(true);
        const restoredUser = await restoreUserByName(name.trim());
        if (restoredUser) {
          return; // 成功恢复，组件会关闭
        } else {
          setError('恢复失败，请重试');
        }
        setIsRestoring(false);
      } else {
        // 新用户注册
        await onSubmit(name.trim());
      }
    } catch (error) {
      console.error('提交名字失败:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('提交失败，请重试');
      }
      setIsSubmitting(false);
      setIsRestoring(false);
    }
  };

  const handleNewAccount = () => {
    setShowRestoreOption(false);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-5">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">考勤管理系统</h1>
          <p className="text-slate-500 mt-2">
            {showRestoreOption ? '检测到该称呼已存在' : '请输入您的名字开始使用'}
          </p>
        </div>

        {showRestoreOption ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg text-center">
              <p className="text-amber-800 text-sm mb-2">
                检测到"
                <span className="font-semibold">{name.trim()}</span>
                "已存在账号
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    setIsRestoring(true);
                    try {
                      const restoredUser = await restoreUserByName(name.trim());
                      if (!restoredUser) {
                        setError('恢复失败，请重试');
                      }
                    } catch (e) {
                      setError('恢复失败，请重试');
                    }
                    setIsRestoring(false);
                  }}
                  className="flex-1 gap-2"
                  disabled={isRestoring}
                >
                  <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                  {isRestoring ? '恢复中...' : '恢复账号'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleNewAccount}
                  className="flex-1 gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  换个名字
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                名字
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入您的名字"
                autoComplete="off"
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none transition-colors text-slate-900"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? '加载中...' : '开始使用'}
            </Button>

            <p className="text-xs text-slate-400 text-center mt-4">
              💡 牢记您的称呼，卸载重装后可通过称呼恢复数据
            </p>
          </form>
        )}
      </Card>
    </div>
  );
};
