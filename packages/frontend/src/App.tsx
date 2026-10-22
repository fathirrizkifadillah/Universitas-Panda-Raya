import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { MahasiswaDashboard } from './pages/MahasiswaDashboard.tsx';
import { DosenDashboard } from './pages/DosenDashboard.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('nilai');

  // Adjust default tab per role when user logs in
  React.useEffect(() => {
    if (user?.role === 'dosen') {
      setCurrentTab('kelas');
    } else if (user?.role === 'admin') {
      setCurrentTab('transkrip');
    } else if (user?.role === 'mahasiswa') {
      setCurrentTab('nilai');
    }
  }, [user?.role]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-accent-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-ink-muted font-medium">Memeriksa Sesi Zero Trust...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {user.role === 'mahasiswa' && <MahasiswaDashboard currentTab={currentTab} />}
          {user.role === 'dosen' && <DosenDashboard />}
          {user.role === 'admin' && <AdminDashboard currentTab={currentTab} />}
        </main>
      </div>
    </div>
  );
};
