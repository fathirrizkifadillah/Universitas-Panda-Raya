import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, Laptop, LogOut, User as UserIcon } from 'lucide-react';
import { Badge } from './Badge.tsx';

export const Navbar: React.FC = () => {
  const { user, deviceId, logout } = useAuth();

  if (!user) return null;

  const roleBadgeVariant: Record<string, 'info' | 'warning' | 'success'> = {
    mahasiswa: 'info',
    dosen: 'success',
    admin: 'warning',
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-canvas-border">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            N
          </div>
          <div>
            <span className="font-bold text-ink tracking-tight text-base">NILAI</span>
            <span className="ml-1.5 text-xs text-ink-muted font-medium hidden sm:inline">Academic Records</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 text-xs text-ink-muted">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Zero Trust PEP Verified</span>
          <span className="text-slate-300">•</span>
          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">RS256</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Device Context Info */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-ink-secondary bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          <Laptop className="w-3.5 h-3.5 text-ink-muted" />
          <span className="text-ink-muted">Device:</span>
          <span className="font-mono text-[11px] font-semibold text-ink">{deviceId}</span>
        </div>

        {/* User Identity */}
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-ink-secondary">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-ink leading-tight">{user.fullName}</div>
            <div className="text-[11px] text-ink-muted font-mono">{user.nimNip || user.username}</div>
          </div>
          <Badge variant={roleBadgeVariant[user.role] || 'neutral'}>
            {user.role.toUpperCase()}
          </Badge>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Keluar dari sistem"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};
