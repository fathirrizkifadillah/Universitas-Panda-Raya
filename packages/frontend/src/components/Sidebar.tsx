import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  GraduationCap,
  FileText,
  Users,
  Activity,
  Calendar,
  Lock,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <aside className="w-64 bg-white border-r border-canvas-border flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Menu Utama
          </div>
          <nav className="space-y-1">
            {user.role === 'mahasiswa' && (
              <>
                <button
                  onClick={() => onSelectTab('nilai')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    currentTab === 'nilai'
                      ? 'bg-accent-50 text-accent-800 font-semibold'
                      : 'text-ink-secondary hover:bg-slate-50 hover:text-ink'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-accent-600" />
                  <span>Nilai Perkuliahan</span>
                </button>
                <button
                  onClick={() => onSelectTab('transkrip')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    currentTab === 'transkrip'
                      ? 'bg-accent-50 text-accent-800 font-semibold'
                      : 'text-ink-secondary hover:bg-slate-50 hover:text-ink'
                  }`}
                >
                  <FileText className="w-4 h-4 text-accent-600" />
                  <span>Transkrip Akademik</span>
                </button>
              </>
            )}

            {user.role === 'dosen' && (
              <button
                onClick={() => onSelectTab('kelas')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  currentTab === 'kelas'
                    ? 'bg-accent-50 text-accent-800 font-semibold'
                    : 'text-ink-secondary hover:bg-slate-50 hover:text-ink'
                }`}
              >
                <Users className="w-4 h-4 text-accent-600" />
                <span>Kelas & Gradebook</span>
              </button>
            )}

            {user.role === 'admin' && (
              <>
                <button
                  onClick={() => onSelectTab('transkrip')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    currentTab === 'transkrip'
                      ? 'bg-accent-50 text-accent-800 font-semibold'
                      : 'text-ink-secondary hover:bg-slate-50 hover:text-ink'
                  }`}
                >
                  <FileText className="w-4 h-4 text-accent-600" />
                  <span>Transkrip Mahasiswa</span>
                </button>
                <button
                  onClick={() => onSelectTab('audit')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    currentTab === 'audit'
                      ? 'bg-accent-50 text-accent-800 font-semibold'
                      : 'text-ink-secondary hover:bg-slate-50 hover:text-ink'
                  }`}
                >
                  <Activity className="w-4 h-4 text-accent-600" />
                  <span>Audit Trail Log PEP</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Access window policy card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            <Calendar className="w-3.5 h-3.5 text-accent-600" />
            <span>Window Akses Nilai</span>
          </div>
          <p className="text-ink-muted leading-relaxed text-[11px]">
            Penginputan & finalisasi nilai aktif pukul <strong className="text-ink">07:00 – 21:00 WIB</strong> sesuai kebijakan Zero Trust.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-canvas-border text-[11px] text-ink-muted flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-slate-400" />
        <span>NIST SP 800-207 Enforced</span>
      </div>
    </aside>
  );
};
