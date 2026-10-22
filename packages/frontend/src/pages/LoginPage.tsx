import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, ShieldAlert, KeyRound, Laptop, User, ArrowRight, CheckCircle2 } from 'lucide-react';

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
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-600 text-white shadow-md mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          NILAI — Academic Records
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sistem Nilai Akademik Berbasis Zero Trust Security (NIST SP 800-207)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-canvas-border sm:rounded-2xl sm:px-10">
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
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Username / Akun
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: mahasiswa1"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-accent-600 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-accent-600 bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                  Device ID Konteks (X-Device-ID)
                </label>
                <span className="text-[10px] text-accent-700 font-medium">Zero Trust Binding</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                  <Laptop className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="ID Perangkat Terdaftar"
                  className="block w-full pl-9 pr-3 py-2 text-sm font-mono text-xs border border-slate-200 rounded-lg focus:border-accent-600 bg-slate-50/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-6 py-2.5 px-4 text-sm font-semibold rounded-lg text-white bg-accent-600 hover:bg-accent-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Memverifikasi Policy...' : 'Masuk ke Sistem'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Selector */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-600" />
              <span>Akun Demo Cepat (Siap Uji)</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount('mahasiswa1', 'PasswordMhs123!', 'dev-mhs1-thinkpad-01')}
                className="text-left px-3 py-2 text-xs rounded-lg border border-slate-200 hover:border-accent-500 hover:bg-accent-50/40 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-ink">Mahasiswa 1 (Ahmad Fauzi)</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-mhs1-thinkpad-01</div>
                </div>
                <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-medium">Mahasiswa</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('dosen1', 'PasswordDosen123!', 'dev-dosen1-laptop-01')}
                className="text-left px-3 py-2 text-xs rounded-lg border border-slate-200 hover:border-accent-500 hover:bg-accent-50/40 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-ink">Dosen 1 (Dr. Budi Santoso)</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-dosen1-laptop-01 • Kelas A</div>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Dosen</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('dosen2', 'PasswordDosen123!', 'dev-dosen2-macbook-02')}
                className="text-left px-3 py-2 text-xs rounded-lg border border-slate-200 hover:border-accent-500 hover:bg-accent-50/40 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-ink">Dosen 2 (Siti Rahmawati)</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-dosen2-macbook-02 • Kelas B</div>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Dosen</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('admin1', 'PasswordAdmin123!', 'dev-admin-chrome-01')}
                className="text-left px-3 py-2 text-xs rounded-lg border border-slate-200 hover:border-accent-500 hover:bg-accent-50/40 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-ink">Administrator Pusat</div>
                  <div className="text-[11px] text-ink-muted font-mono">dev-admin-chrome-01</div>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">Admin</span>
              </button>

              {/* Negative Test Simulator Button */}
              <button
                type="button"
                onClick={() => setDemoAccount('mahasiswa1', 'PasswordMhs123!', 'device-asing-ilegal-999')}
                className="text-left px-3 py-2 text-xs rounded-lg border border-rose-200 bg-rose-50/40 hover:bg-rose-50 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-rose-900">Uji Device Asing (Simulasi Ditolak)</div>
                  <div className="text-[11px] text-rose-700 font-mono">device-asing-ilegal-999</div>
                </div>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-semibold">Simulasi 403</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
