import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, ShieldAlert, KeyRound, Laptop, User, ArrowRight, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('mahasiswa1');
  const [password, setPassword] = useState('PasswordMhs123!');
  const [deviceId, setDeviceId] = useState('dev-mhs1-thinkpad-01');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    const res = await login(username, password, deviceId);
    if (!res.success) {
      setErrorMessage(res.message || 'Login gagal.');
    }
    setLoading(false);
  };

  const setDemoAccount = (u: string, p: string, d: string) => {
    setUsername(u);
    setPassword(p);
    setDeviceId(d);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-brand-canvas flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <img
            src="/logo_unpanda_horizontal.png"
            alt="Universitas Panda Raya - PANDAKAD"
            className="h-16 w-auto object-contain drop-shadow-sm"
          />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-deep">
          PANDAKAD
          <span className="block text-xs font-semibold text-brand-olive mt-1">
            NILAI — Academic Records • Universitas Panda Raya
          </span>
        </h1>
        <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-white border border-brand-border rounded-full text-[11px] text-ink-secondary">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-olive" />
          <span>Dilindungi Arsitektur Zero Trust (NIST SP 800-207)</span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-brand-border sm:rounded-2xl sm:px-10">
          {/* Welcome Mascot Banner */}
          <div className="mb-6 p-3 rounded-xl bg-[#FAF5EB] border border-[#C9A66B]/30 flex items-center gap-3">
            <img
              src="/maskot_unpanda.png"
              alt="Maskot Red Panda UNPANDA"
              className="w-12 h-12 object-contain shrink-0"
            />
            <div className="text-xs">
              <span className="font-bold text-[#634819]">Halo Civitas Akademika!</span>
              <p className="text-[#8C6D32] text-[11px] mt-0.5 leading-snug">
                Pastikan perangkat yang Anda gunakan sudah terdaftar di Markas Panda.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-rose-900">Akses Ditolak (Policy Deny)</h4>
                <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-deep uppercase tracking-wider mb-1">
                Username / Akun
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-olive">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: mahasiswa1"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-brand-border rounded-xl focus:border-brand-olive focus:ring-1 focus:ring-brand-olive bg-white text-brand-charcoal"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-deep uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-olive">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-brand-border rounded-xl focus:border-brand-olive focus:ring-1 focus:ring-brand-olive bg-white text-brand-charcoal"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-brand-deep uppercase tracking-wider">
                  Device ID Konteks (X-Device-ID)
                </label>
                <span className="text-[10px] text-brand-olive font-semibold">Zero Trust Binding</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-olive">
                  <Laptop className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="ID Perangkat Terdaftar"
                  className="block w-full pl-9 pr-3 py-2 text-sm font-mono text-xs border border-brand-border rounded-xl focus:border-brand-olive focus:ring-1 focus:ring-brand-olive bg-brand-canvas text-brand-charcoal"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-6 py-2.5 px-4 text-sm font-bold rounded-xl text-white bg-brand-deep hover:bg-brand-olive disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {loading ? 'Memverifikasi Policy...' : 'Masuk ke Sistem'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Selector */}
          <div className="mt-8 pt-6 border-t border-brand-border">
            <div className="text-xs font-bold text-brand-olive uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-olive" />
              <span>Akun Demo Cepat (Siap Uji)</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount('mahasiswa1', 'PasswordMhs123!', 'dev-mhs1-thinkpad-01')}
                className="text-left px-3 py-2 text-xs rounded-xl border border-brand-border hover:border-brand-olive hover:bg-brand-canvas transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-brand-charcoal">Mahasiswa 1 (Ahmad Fauzi)</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-mhs1-thinkpad-01</div>
                </div>
                <span className="text-[10px] bg-brand-canvas text-brand-deep border border-brand-border px-2 py-0.5 rounded-full font-semibold">Mahasiswa</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('dosen1', 'PasswordDosen123!', 'dev-dosen1-laptop-01')}
                className="text-left px-3 py-2 text-xs rounded-xl border border-brand-border hover:border-brand-olive hover:bg-brand-canvas transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-brand-charcoal">Dosen 1 (Dr. Budi Santoso)</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-dosen1-laptop-01 • Kelas A</div>
                </div>
                <span className="text-[10px] bg-[#EEF4E8] text-[#344522] border border-[#A3B18A] px-2 py-0.5 rounded-full font-semibold">Dosen</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('dosen2', 'PasswordDosen123!', 'dev-dosen2-macbook-02')}
                className="text-left px-3 py-2 text-xs rounded-xl border border-brand-border hover:border-brand-olive hover:bg-brand-canvas transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-brand-charcoal">Dosen 2 (Siti Rahmawati)</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-dosen2-macbook-02 • Kelas B</div>
                </div>
                <span className="text-[10px] bg-[#EEF4E8] text-[#344522] border border-[#A3B18A] px-2 py-0.5 rounded-full font-semibold">Dosen</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('admin1', 'PasswordAdmin123!', 'dev-admin-chrome-01')}
                className="text-left px-3 py-2 text-xs rounded-xl border border-brand-border hover:border-brand-olive hover:bg-brand-canvas transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-brand-charcoal">Administrator Pusat</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-admin-chrome-01</div>
                </div>
                <span className="text-[10px] bg-[#FBF6EC] text-[#8C6425] border border-[#C9A66B]/50 px-2 py-0.5 rounded-full font-semibold">Admin</span>
              </button>

              {/* Negative Test Simulator Button */}
              <button
                type="button"
                onClick={() => setDemoAccount('mahasiswa1', 'PasswordMhs123!', 'device-asing-ilegal-999')}
                className="text-left px-3 py-2 text-xs rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-rose-900">Uji Device Asing (Simulasi Ditolak)</div>
                  <div className="text-[11px] text-rose-700 font-mono">device-asing-ilegal-999</div>
                </div>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-bold">Simulasi 403</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
