import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../api/client.ts';
import type { GradeItem, TranscriptData } from '../types.ts';
import { Badge } from '../components/Badge.tsx';
import { GraduationCap, Award, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';

interface MahasiswaDashboardProps {
  currentTab: string;
}

export const MahasiswaDashboard: React.FC<MahasiswaDashboardProps> = ({ currentTab }) => {
  const { user } = useAuth();
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    if (currentTab === 'nilai') {
      const res = await apiFetch<GradeItem[]>('/nilai');
      if (res.success && res.data) {
        setGrades(res.data);
      } else {
        setError(res.message || 'Gagal memuat data nilai.');
      }
    } else if (currentTab === 'transkrip') {
      const res = await apiFetch<TranscriptData>(`/transkrip/${user.nimNip}`);
      if (res.success && res.data) {
        setTranscript(res.data);
      } else {
        setError(res.message || 'Gagal memuat transkrip akademik.');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentTab, user]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-canvas-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">
            {currentTab === 'nilai' ? 'Nilai Perkuliahan Semester Ini' : 'Transkrip Akademik Resmi'}
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Data akademik mahasiswa terverifikasi melalui Zero Trust API Gateway (NIM: <span className="font-mono font-semibold text-ink">{user?.nimNip}</span>)
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-secondary bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-ink-muted">
          <div className="inline-block w-6 h-6 border-2 border-accent-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p>Memuat data dari Zero Trust Gateway...</p>
        </div>
      ) : currentTab === 'nilai' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white border border-canvas-border rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted uppercase">
                <BookOpen className="w-4 h-4 text-accent-600" />
                <span>Mata Kuliah Diambil</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-ink">{grades.length}</div>
              <div className="text-[11px] text-ink-muted mt-1">Semester Ganjil 2026/2027</div>
            </div>

            <div className="p-5 bg-white border border-canvas-border rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted uppercase">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Total SKS Semester</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-ink">
                {grades.reduce((acc, g) => acc + g.credits, 0)}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">Beban SKS aktif</div>
            </div>

            <div className="p-5 bg-white border border-canvas-border rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted uppercase">
                <Award className="w-4 h-4 text-amber-600" />
                <span>Rata-Rata Nilai</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-ink">
                {grades.length > 0
                  ? (grades.reduce((acc, g) => acc + Number(g.score), 0) / grades.length).toFixed(1)
                  : '0.0'}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">Skala 0.00 – 100.00</div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-canvas-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-canvas-border bg-slate-50/50">
              <h3 className="text-sm font-semibold text-ink">Daftar Nilai Semester</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-canvas-border text-ink-muted font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-3.5">Kode</th>
                    <th className="px-6 py-3.5">Mata Kuliah</th>
                    <th className="px-6 py-3.5 text-center">SKS</th>
                    <th className="px-6 py-3.5">Dosen Pengampu</th>
                    <th className="px-6 py-3.5 text-right">Skor</th>
                    <th className="px-6 py-3.5 text-center">Huruf</th>
                    <th className="px-6 py-3.5 text-center">Status Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-border text-ink">
                  {grades.map((item) => (
                    <tr key={item.gradeId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-ink">{item.courseCode}</td>
                      <td className="px-6 py-4 font-medium text-ink">{item.courseName}</td>
                      <td className="px-6 py-4 text-center">{item.credits}</td>
                      <td className="px-6 py-4 text-ink-secondary">{item.lecturerName}</td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-ink">
                        {Number(item.score).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2 py-0.5 font-bold rounded bg-slate-100 text-slate-800 text-xs">
                          {item.gradeLetter}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={item.isFinalized ? 'success' : 'neutral'}>
                          {item.isFinalized ? 'FINAL' : 'DRAFT'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {grades.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-ink-muted">
                        Belum ada data perkuliahan yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Transcript Tab */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-white border border-canvas-border rounded-xl shadow-sm">
              <div className="text-xs font-semibold text-ink-muted uppercase">Indeks Prestasi Kumulatif (IPK)</div>
              <div className="mt-2 text-3xl font-extrabold text-accent-700">
                {transcript?.summary.gpa.toFixed(2) || '0.00'}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">Dihitung dari seluruh mata kuliah final</div>
            </div>

            <div className="p-5 bg-white border border-canvas-border rounded-xl shadow-sm">
              <div className="text-xs font-semibold text-ink-muted uppercase">Total SKS Lulus</div>
              <div className="mt-2 text-3xl font-extrabold text-ink">
                {transcript?.summary.totalCredits || 0}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">SKS telah diverifikasi di Service Transkrip</div>
            </div>
          </div>

          <div className="bg-white border border-canvas-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-canvas-border bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Riwayat Mata Kuliah Transkrip</h3>
              <span className="text-[11px] text-ink-muted">
                Sumber Data: Service Transkrip (Port 3002) via API Gateway
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-canvas-border text-ink-muted font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-3.5">Kode</th>
                    <th className="px-6 py-3.5">Mata Kuliah</th>
                    <th className="px-6 py-3.5 text-center">SKS</th>
                    <th className="px-6 py-3.5 text-right">Skor</th>
                    <th className="px-6 py-3.5 text-center">Nilai Huruf</th>
                    <th className="px-6 py-3.5 text-center">Bobot Mutu</th>
                    <th className="px-6 py-3.5">Waktu Sinkronisasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-border text-ink">
                  {transcript?.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-ink">{entry.courseCode}</td>
                      <td className="px-6 py-4 font-medium text-ink">{entry.courseName}</td>
                      <td className="px-6 py-4 text-center font-medium">{entry.credits}</td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-ink">
                        {Number(entry.score).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2 py-0.5 font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
                          {entry.gradeLetter}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-semibold text-ink">
                        {entry.gradePoint.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-ink-muted font-mono text-[11px]">
                        {new Date(entry.syncedAt).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                  {(!transcript?.entries || transcript.entries.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-ink-muted">
                        Belum ada transkrip yang disinkronkan. Nilai akan muncul setelah dosen memfinalisasi kelas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
