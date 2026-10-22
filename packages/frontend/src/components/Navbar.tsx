import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, Laptop, LogOut, User as UserIcon } from 'lucide-react';
import { Badge } from './Badge.tsx';

export const Navbar: React.FC = () => {
  const { user, deviceId, logout } = useAuth();

  if (!user) return null;

  const roleBadgeVariant: Record<string, 'olive' | 'success' | 'warning'> = {
    mahasiswa: 'olive',
    dosen: 'success',
    admin: 'warning',
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 sm:px-6 bg-white border-b border-brand-border shadow-[0_1px_3px_rgba(32,37,29,0.04)]">
      <div className="flex items-center gap-2 sm:gap-4 shrink min-w-0">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <img
            src="/logo_unpanda.png"
            alt="Logo Universitas Panda Raya"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-sm shrink-0"
          />
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-brand-deep tracking-tight text-sm sm:text-base">PANDAKAD</span>
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider font-semibold bg-brand-bamboo/20 text-[#7A551E] px-1.5 py-0.2 rounded">UNPANDA</span>
            </div>
            <div className="text-[11px] text-ink-muted font-medium hidden sm:block leading-none">
              Universitas Panda Raya
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-brand-border text-xs text-ink-muted shrink-0">
          <ShieldCheck className="w-4 h-4 text-brand-olive" />
          <span className="font-medium text-brand-deep">Zero Trust PEP Active</span>
          <span className="text-brand-border">•</span>
          <span className="font-mono text-[11px] bg-brand-canvas px-1.5 py-0.5 rounded text-brand-charcoal border border-brand-border">
            RS256 Verified
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0 z-10">
        {/* Device Context Info */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-ink-secondary bg-brand-canvas border border-brand-border px-2.5 py-1 rounded-md">
          <Laptop className="w-3.5 h-3.5 text-brand-olive" />
          <span className="text-ink-muted font-medium">Device:</span>
          <span className="font-mono text-[11px] font-semibold text-brand-charcoal">{deviceId}</span>
        </div>

        {/* User Identity */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-canvas border border-brand-border flex items-center justify-center text-brand-deep shrink-0">
            <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-brand-charcoal leading-tight">{user.fullName}</div>
            <div className="text-[11px] text-ink-muted font-mono">{user.nimNip || user.username}</div>
          </div>
          <Badge variant={roleBadgeVariant[user.role] || 'neutral'}>
            {user.role.toUpperCase()}
          </Badge>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Keluar dari sistem PANDAKAD"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0 z-20"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};
