import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Calendar,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <aside className="w-64 bg-white border-r border-brand-border flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6">
        <div>
          <div className="px-3 mb-2.5 text-[11px] font-bold uppercase tracking-wider text-brand-olive">
            Menu Akademik
          </div>
          <nav className="space-y-1">
            {user.role === 'mahasiswa' && (
              <>
                <button
                  onClick={() => onSelectTab('nilai')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                    currentTab === 'nilai'
                      ? 'bg-brand-deep text-white font-semibold shadow-xs'
                      : 'text-brand-charcoal hover:bg-brand-canvas hover:text-brand-deep'
                  }`}
                >
                  <img src="/icons-unpanda/icon_nilai.png" alt="" className="w-5 h-5 object-contain shrink-0" />
                  <span>Nilai Perkuliahan</span>
                </button>
                <button
                  onClick={() => onSelectTab('transkrip')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                    currentTab === 'transkrip'
                      ? 'bg-brand-deep text-white font-semibold shadow-xs'
                      : 'text-brand-charcoal hover:bg-brand-canvas hover:text-brand-deep'
                  }`}
                >
                  <img src="/icons-unpanda/icon_transkrip.png" alt="" className="w-5 h-5 object-contain shrink-0" />
                  <span>Transkrip Akademik</span>
                </button>
              </>
            )}

            {user.role === 'dosen' && (
              <button
                onClick={() => onSelectTab('kelas')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                  currentTab === 'kelas'
                    ? 'bg-brand-deep text-white font-semibold shadow-xs'
                    : 'text-brand-charcoal hover:bg-brand-canvas hover:text-brand-deep'
                }`}
              >
                <img src="/icons-unpanda/icon_gradebook.png" alt="" className="w-5 h-5 object-contain shrink-0" />
                <span>Kelas & Gradebook</span>
              </button>
            )}

            {user.role === 'admin' && (
              <>
                <button
                  onClick={() => onSelectTab('transkrip')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                    currentTab === 'transkrip'
                      ? 'bg-brand-deep text-white font-semibold shadow-xs'
                      : 'text-brand-charcoal hover:bg-brand-canvas hover:text-brand-deep'
                  }`}
                >
                  <img src="/icons-unpanda/icon_pemeriksaan.png" alt="" className="w-5 h-5 object-contain shrink-0" />
                  <span>Transkrip Mahasiswa</span>
                </button>
                <button
                  onClick={() => onSelectTab('audit')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                    currentTab === 'audit'
                      ? 'bg-brand-deep text-white font-semibold shadow-xs'
                      : 'text-brand-charcoal hover:bg-brand-canvas hover:text-brand-deep'
                  }`}
                >
                  <img src="/icons-unpanda/icon_audit.png" alt="" className="w-5 h-5 object-contain shrink-0" />
                  <span>Audit Trail Log PEP</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Access window policy card */}
        <div className="p-3.5 bg-brand-canvas border border-brand-border rounded-xl text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-brand-deep">
            <Calendar className="w-3.5 h-3.5 text-brand-olive" />
            <span>Window Akses Nilai</span>
          </div>
          <p className="text-ink-secondary leading-relaxed text-[11px]">
            Penginputan & finalisasi nilai aktif pukul <strong className="text-brand-deep font-semibold">07:00 – 21:00 WIB</strong> sesuai verifikasi konteks Zero Trust.
          </p>
        </div>

        {/* Mascot Microcard */}
        <div className="p-3 rounded-xl bg-[#FAF5EB] border border-[#C9A66B]/30 flex items-center gap-2.5">
          <img src="/maskot_unpanda.png" alt="Maskot UNPANDA" className="w-9 h-9 object-contain shrink-0" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-[#634819]">Panda Penjaga Data</div>
            <div className="text-[#8C6D32] text-[10px] mt-0.5">Selalu verifikasi sebelum percaya.</div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-brand-border text-[11px] text-ink-muted flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <img src="/icons-unpanda/icon_keamanan.png" alt="" className="w-4 h-4 object-contain" />
          <span className="font-medium">NIST SP 800-207</span>
        </div>
        <span className="text-[10px] text-brand-olive/80 font-mono">v1.0-UNPANDA</span>
      </div>
    </aside>
  );
};
