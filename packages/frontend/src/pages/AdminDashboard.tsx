import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client.ts';
import type { TranscriptData, AuditEventItem } from '../types.ts';
import { Badge } from '../components/Badge.tsx';
import {
  Search,
  Activity,
  FileText,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  User,
} from 'lucide-react';

interface AdminDashboardProps {
  currentTab: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentTab }) => {
  const [targetNim, setTargetNim] = useState('2207051001');
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscript = async (nim: string) => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<TranscriptData>(`/transkrip/${nim}`);
    if (res.success && res.data) {
      setTranscript(res.data);
    } else {
      setError(res.message || 'Transkrip untuk NIM tersebut tidak ditemukan.');
      setTranscript(null);
    }
    setLoading(false);
  };

  const fetchAuditTrail = async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<{ events: AuditEventItem[]; total: number }>('/audit?limit=50');
    if (res.success && res.data) {
      setAuditEvents(res.data.events);
    } else {
      setError(res.message || 'Gagal memuat log audit trail.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentTab === 'transkrip') {
      fetchTranscript(targetNim);
    } else if (currentTab === 'audit') {
      fetchAuditTrail();
    }
  }, [currentTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetNim) {
      fetchTranscript(targetNim.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-canvas-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">
            {currentTab === 'transkrip' ? 'Pemeriksaan Transkrip Akademik Mahasiswa' : 'Audit Trail PEP (Policy Enforcement Point)'}
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            {currentTab === 'transkrip'
              ? 'Admin memiliki hak akses baca seluruh transkrip mahasiswa (NIST SP 800-207 Least Privilege)'
              : 'Catatan log keamanan real-time untuk setiap keputusan ALLOW dan DENY dari Policy Engine'}
          </p>
        </div>

        <button
          onClick={() => (currentTab === 'transkrip' ? fetchTranscript(targetNim) : fetchAuditTrail())}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-secondary bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {currentTab === 'transkrip' ? (
        <>
          {/* NIM Search Bar */}
          <div className="bg-white p-5 border border-canvas-border rounded-xl shadow-sm space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={targetNim}
                  onChange={(e) => setTargetNim(e.target.value)}
                  placeholder="Masukkan NIM Mahasiswa (contoh: 2207051001)"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-semibold border border-slate-200 rounded-lg focus:ring-1 focus:ring-accent-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-accent-600 hover:bg-accent-700 rounded-lg shadow-sm transition-colors"
              >
                Cari Transkrip
              </button>
            </form>

            {/* Quick NIM Pickers */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-ink-muted">
              <span>Pilih Mahasiswa Demo:</span>
              <button
                type="button"
                onClick={() => {
                  setTargetNim('2207051001');
                  fetchTranscript('2207051001');
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-ink text-[11px] font-mono font-medium"
              >
                2207051001 (Ahmad Fauzi)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetNim('2207051002');
                  fetchTranscript('2207051002');
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-ink text-[11px] font-mono font-medium"
              >
                2207051002 (Bella Safitri)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetNim('2207051003');
                  fetchTranscript('2207051003');
                }}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-ink text-[11px] font-mono font-medium"
              >
                2207051003 (Cahyo Wibowo)
              </button>
            </div>
          </div>

          {/* Transcript Details */}
          {transcript && (
            <div className="space-y-4">
              <div className="p-5 bg-white border border-canvas-border rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-50 border border-accent-200 flex items-center justify-center text-accent-700 font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">{transcript.student.fullName}</h3>
                    <div className="text-xs text-ink-muted font-mono">NIM: {transcript.student.nim}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Total SKS</div>
                    <div className="text-xl font-bold text-ink">{transcript.summary.totalCredits}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">IPK Kumulatif</div>
                    <div className="text-xl font-bold text-accent-700">{transcript.summary.gpa.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-canvas-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-canvas-border bg-slate-50/50">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink">Mata Kuliah Terdaftar di Transkrip</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-canvas-border text-ink-muted font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="px-6 py-3.5">Kode</th>
                        <th className="px-6 py-3.5">Mata Kuliah</th>
                        <th className="px-6 py-3.5 text-center">SKS</th>
                        <th className="px-6 py-3.5 text-right">Skor</th>
                        <th className="px-6 py-3.5 text-center">Huruf</th>
                        <th className="px-6 py-3.5 text-center">Bobot Mutu</th>
                        <th className="px-6 py-3.5">Tanggal Sinkronisasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-canvas-border text-ink">
                      {transcript.entries.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4 font-mono font-semibold text-ink">{e.courseCode}</td>
                          <td className="px-6 py-4 font-medium text-ink">{e.courseName}</td>
                          <td className="px-6 py-4 text-center">{e.credits}</td>
                          <td className="px-6 py-4 text-right font-mono font-semibold">{Number(e.score).toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block px-2 py-0.5 font-bold rounded bg-slate-100 text-slate-800 text-xs">
                              {e.gradeLetter}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-mono font-semibold">{e.gradePoint.toFixed(1)}</td>
                          <td className="px-6 py-4 text-ink-muted font-mono text-[11px]">
                            {new Date(e.syncedAt).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                      {transcript.entries.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-ink-muted">
                            Belum ada entri transkrip untuk mahasiswa ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Audit Trail Tab */
        <div className="bg-white border border-canvas-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-canvas-border bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-600" />
              <h3 className="text-sm font-bold text-ink">Log Aktivitas Policy Enforcement Point (PEP)</h3>
            </div>
            <span className="text-[11px] text-ink-muted font-mono">
              Total Recorded: {auditEvents.length} Events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-canvas-border text-ink-muted font-semibold uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Waktu (WIB)</th>
                  <th className="px-4 py-3">Keputusan</th>
                  <th className="px-4 py-3">Alasan (Reason Code)</th>
                  <th className="px-4 py-3">Metode & Path</th>
                  <th className="px-4 py-3">Subjek (User / Service)</th>
                  <th className="px-4 py-3">Device ID</th>
                  <th className="px-4 py-3">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-border text-ink font-mono text-[11px]">
                {auditEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-ink-secondary shrink-0 whitespace-nowrap">
                      {new Date(evt.occurredAt).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={evt.decision === 'ALLOW' ? 'success' : 'danger'}>
                        {evt.decision}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">
                      {evt.reasonCode}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      <span className="font-bold text-slate-700">{evt.method}</span>{' '}
                      <span className="text-accent-700">{evt.path}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {evt.subjectType}: <span className="text-ink">{evt.subjectId.slice(0, 16)}...</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted truncate max-w-xs">
                      {evt.deviceId}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {evt.requestId}
                    </td>
                  </tr>
                ))}
                {auditEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-ink-muted">
                      Belum ada catatan log audit yang terekam.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
