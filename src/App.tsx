import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import { BottomNav } from './components/layout/BottomNav';
import { Home } from './pages/Home';
import Records from './pages/Records';
import { Billing } from './pages/Billing';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/records" element={<Records />} />
            <Route path="/billing" element={<Billing />} />
          </Routes>
          <BottomNav />
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}

export default App;
