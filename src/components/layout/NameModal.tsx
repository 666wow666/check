import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

interface NameModalProps {
  isOpen: boolean;
  onSubmit: (name: string) => void;
}

export const NameModal = ({ isOpen, onSubmit }: NameModalProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('请输入您的名字');
      return;
    }

    onSubmit(name.trim());
    setName('');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-5">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">考勤管理系统</h1>
          <p className="text-slate-500 mt-2">请输入您的名字开始使用</p>
        </div>

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
          >
            开始使用
          </Button>
        </form>
      </Card>
    </div>
  );
};
