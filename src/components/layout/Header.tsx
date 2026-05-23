import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/home': '首页',
  '/clock': '打卡',
  '/records': '考勤记录',
  '/statistics': '统计报表',
};

export const Header = () => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || '考勤系统';

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-4">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
    </header>
  );
};
