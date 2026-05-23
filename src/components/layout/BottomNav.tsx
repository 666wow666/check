import { Home, Calendar, CreditCard } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 pb-6 pt-3">
      <div className="flex items-end justify-around max-w-md mx-auto">
        <button
          onClick={() => navigate('/records')}
          className={`flex flex-col items-center gap-1 ${
            isActive('/records') ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <span className="text-xs font-medium">统计</span>
        </button>

        <button
          onClick={() => navigate('/home')}
          className="flex flex-col items-center -mt-4"
        >
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center shadow-lg">
            <Home size={28} className="text-white" />
          </div>
        </button>

        <button
          onClick={() => navigate('/billing')}
          className={`flex flex-col items-center gap-1 ${
            isActive('/billing') ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          <div className="w-10 h-10 flex items-center justify-center">
            <CreditCard size={24} />
          </div>
          <span className="text-xs font-medium">账单</span>
        </button>
      </div>
    </nav>
  );
};
