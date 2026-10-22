import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/client.ts';
import type { TranscriptData, AuditEventItem } from '../types.ts';
import { Badge } from '../components/Badge.tsx';
import {
  Search,
  ShieldAlert,
  RefreshCw,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-brand-deep">
              {currentTab === 'transkrip' ? 'Pemeriksaan Transkrip Akademik Mahasiswa' : 'Audit Trail PEP (Policy Enforcement Point)'}
            </h2>
            <span className="text-[10px] font-bold bg-[#FAF5EB] text-[#8C6425] border border-[#C9A66B]/40 px-2 py-0.5 rounded-full">
              PANDAKAD ADMIN
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            {currentTab === 'transkrip'
              ? 'Administrator memiliki hak akses baca seluruh transkrip mahasiswa Universitas Panda Raya (NIST SP 800-207 Least Privilege)'
              : 'Catatan log keamanan real-time untuk setiap keputusan ALLOW dan DENY dari Policy Engine'}
          </p>
        </div>

        <button
          onClick={() => (currentTab === 'transkrip' ? fetchTranscript(targetNim) : fetchAuditTrail())}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-brand-deep bg-white border border-brand-border hover:bg-brand-canvas rounded-xl transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-brand-olive ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {currentTab === 'transkrip' ? (
        <>
          {/* NIM Search Bar */}
          <div className="bg-white p-5 border border-brand-border rounded-2xl shadow-xs space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-brand-olive absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={targetNim}
                  onChange={(e) => setTargetNim(e.target.value)}
                  placeholder="Masukkan NIM Mahasiswa (contoh: 2207051001)"
                  className="w-full pl-10 pr-3 py-2.5 text-xs font-mono font-bold border border-brand-border rounded-xl focus:border-brand-olive focus:ring-1 focus:ring-brand-olive bg-brand-canvas text-brand-charcoal"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-brand-deep hover:bg-brand-olive rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Cari Transkrip
              </button>
            </form>

            {/* Quick NIM Pickers */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-brand-border text-xs text-ink-muted">
              <span className="font-medium">Pilih Mahasiswa Demo:</span>
              <button
                type="button"
                onClick={() => {
                  setTargetNim('2207051001');
                  fetchTranscript('2207051001');
                }}
                className="px-3 py-1 rounded-xl bg-brand-canvas hover:bg-white border border-brand-border text-brand-charcoal text-[11px] font-mono font-bold cursor-pointer transition-all"
              >
                2207051001 (Ahmad Fauzi)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetNim('2207051002');
                  fetchTranscript('2207051002');
                }}
                className="px-3 py-1 rounded-xl bg-brand-canvas hover:bg-white border border-brand-border text-brand-charcoal text-[11px] font-mono font-bold cursor-pointer transition-all"
              >
                2207051002 (Bella Safitri)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetNim('2207051003');
                  fetchTranscript('2207051003');
                }}
                className="px-3 py-1 rounded-xl bg-brand-canvas hover:bg-white border border-brand-border text-brand-charcoal text-[11px] font-mono font-bold cursor-pointer transition-all"
              >
                2207051003 (Cahyo Wibowo)
              </button>
            </div>
          </div>

          {/* Transcript Details */}
          {transcript && (
            <div className="space-y-4">
              <div className="p-5 bg-white border border-brand-border rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#EEF4E8] border border-[#A3B18A] flex items-center justify-center text-brand-deep font-bold shrink-0">
                    <img src="/icons-unpanda/icon_mahasiswa.png" alt="" className="w-7 h-7 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-brand-charcoal">{transcript.student.fullName}</h3>
                    <div className="text-xs text-brand-olive font-mono font-bold">NIM: {transcript.student.nim}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-brand-olive font-bold">Total SKS</div>
                    <div className="text-2xl font-extrabold text-brand-deep">{transcript.summary.totalCredits}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-brand-olive font-bold">IPK Kumulatif</div>
                    <div className="text-2xl font-extrabold text-brand-deep">{transcript.summary.gpa.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-brand-border rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-border bg-[#FAFBF8] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/icons-unpanda/icon_pemeriksaan.png" alt="" className="w-4 h-4 object-contain" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-deep">Mata Kuliah Terdaftar di Transkrip</h4>
                  </div>
                  <span className="text-[11px] font-mono text-brand-olive">Universitas Panda Raya</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAFBF8] border-b border-brand-border text-brand-olive font-bold uppercase text-[11px]">
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
                    <tbody className="divide-y divide-brand-border text-brand-charcoal">
                      {transcript.entries.map((e) => (
                        <tr key={e.id} className="hover:bg-brand-canvas transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-brand-deep">{e.courseCode}</td>
                          <td className="px-6 py-4 font-semibold text-brand-charcoal">{e.courseName}</td>
                          <td className="px-6 py-4 text-center font-medium">{e.credits}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-brand-deep">{Number(e.score).toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 font-bold rounded-md bg-[#EEF4E8] text-[#344522] border border-[#A3B18A] text-xs">
                              {e.gradeLetter}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-mono font-bold text-brand-deep">{e.gradePoint.toFixed(1)}</td>
                          <td className="px-6 py-4 text-ink-muted font-mono text-[11px]">
                            {new Date(e.syncedAt).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                      {transcript.entries.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <img src="/maskot_unpanda.png" alt="Maskot UNPANDA" className="w-16 h-16 object-contain mb-3 opacity-90" />
                              <h4 className="text-sm font-bold text-brand-deep">Belum ada transkrip yang tercatat</h4>
                              <p className="text-xs text-ink-muted mt-1 max-w-sm">
                                Mahasiswa ini belum memiliki nilai yang difinalisasi oleh dosen pengampu.
                              </p>
                            </div>
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
        <div className="bg-white border border-brand-border rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-border bg-[#FAFBF8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icons-unpanda/icon_audit.png" alt="" className="w-5 h-5 object-contain" />
              <h3 className="text-sm font-bold text-brand-deep">Log Aktivitas Policy Enforcement Point (PEP)</h3>
            </div>
            <span className="text-[11px] text-brand-olive font-mono font-bold">
              Total Recorded: {auditEvents.length} Events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFBF8] border-b border-brand-border text-brand-olive font-bold uppercase text-[11px]">
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
              <tbody className="divide-y divide-brand-border text-brand-charcoal font-mono text-[11px]">
                {auditEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-brand-canvas transition-colors">
                    <td className="px-4 py-3 text-ink-secondary shrink-0 whitespace-nowrap">
                      {new Date(evt.occurredAt).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={evt.decision === 'ALLOW' ? 'success' : 'danger'}>
                        {evt.decision}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-bold text-brand-deep">
                      {evt.reasonCode}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      <span className="font-bold text-brand-charcoal">{evt.method}</span>{' '}
                      <span className="text-brand-deep font-semibold">{evt.path}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {evt.subjectType}: <span className="text-brand-charcoal font-bold">{evt.subjectId.slice(0, 16)}...</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted truncate max-w-xs">
                      {evt.deviceId}
                    </td>
                    <td className="px-4 py-3 text-ink-muted/60">
                      {evt.requestId}
                    </td>
                  </tr>
                ))}
                {auditEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <img src="/maskot_unpanda.png" alt="Maskot UNPANDA" className="w-16 h-16 object-contain mb-3 opacity-90" />
                        <h4 className="text-sm font-bold text-brand-deep">Belum ada pengumuman baru dari Markas Panda</h4>
                        <p className="text-xs text-ink-muted mt-1 max-w-sm">
                          Log aktivitas PEP akan muncul seiring dengan interaksi request ke sistem.
                        </p>
                      </div>
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
