import { X } from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  onNicknameChange: (name: string) => void;
  morningDeadline: string;
  onMorningChange: (time: string) => void;
  afternoonDeadline: string;
  onAfternoonChange: (time: string) => void;
  onSave: () => void;
}

export const SettingsModal = ({
  isOpen,
  onClose,
  nickname,
  onNicknameChange,
  morningDeadline,
  onMorningChange,
  afternoonDeadline,
  onAfternoonChange,
  onSave
}: SettingsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">设置</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">称呼</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder="输入你的称呼"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none"
            />
          </div>
          
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">设置打卡截止时间</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">上午截止</label>
                <input
                  type="time"
                  value={morningDeadline}
                  onChange={(e) => onMorningChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">下午截止</label>
                <input
                  type="time"
                  value={afternoonDeadline}
                  onChange={(e) => onAfternoonChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button className="flex-1" onClick={onSave}>
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
};
