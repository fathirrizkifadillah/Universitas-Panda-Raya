import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../api/client.ts';
import type { GradeItem, TranscriptData } from '../types.ts';
import { Badge } from '../components/Badge.tsx';
import { GraduationCap, Award, BookOpen, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-brand-deep">
              {currentTab === 'nilai' ? 'Nilai Perkuliahan Semester Ini' : 'Transkrip Akademik Resmi'}
            </h2>
            <span className="text-[10px] font-bold bg-[#FAF5EB] text-[#8C6425] border border-[#C9A66B]/40 px-2 py-0.5 rounded-full">
              UNPANDA
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Data akademik mahasiswa terverifikasi melalui Zero Trust API Gateway (NIM: <span className="font-mono font-bold text-brand-deep">{user?.nimNip}</span>)
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-brand-deep bg-white border border-brand-border hover:bg-brand-canvas rounded-xl transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-brand-olive ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-ink-muted">
          <div className="inline-block w-8 h-8 border-2 border-brand-olive border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-medium text-xs text-brand-deep">Memeriksa hak akses Zero Trust & memuat data...</p>
        </div>
      ) : currentTab === 'nilai' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white border border-brand-border rounded-2xl shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-olive uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-brand-olive" />
                <span>Mata Kuliah Diambil</span>
              </div>
              <div className="mt-2 text-3xl font-extrabold text-brand-deep">{grades.length}</div>
              <div className="text-[11px] text-ink-muted mt-1">Semester Ganjil • Universitas Panda Raya</div>
            </div>

            <div className="p-5 bg-white border border-brand-border rounded-2xl shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-olive uppercase tracking-wider">
                <GraduationCap className="w-4 h-4 text-brand-deep" />
                <span>Total SKS Semester</span>
              </div>
              <div className="mt-2 text-3xl font-extrabold text-brand-deep">
                {grades.reduce((acc, g) => acc + g.credits, 0)}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">Beban SKS akademik aktif</div>
            </div>

            <div className="p-5 bg-white border border-brand-border rounded-2xl shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-[#8C6425] uppercase tracking-wider">
                <Award className="w-4 h-4 text-brand-bamboo" />
                <span>Rata-Rata Nilai</span>
              </div>
              <div className="mt-2 text-3xl font-extrabold text-brand-deep">
                {grades.length > 0
                  ? (grades.reduce((acc, g) => acc + Number(g.score), 0) / grades.length).toFixed(1)
                  : '0.0'}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">Skala standar 0.00 – 100.00</div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-brand-border rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-border bg-[#FAFBF8] flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-deep">Daftar Nilai Semester</h3>
              <span className="text-[11px] font-mono text-brand-olive">Sumber: Service Nilai (Port 3001)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFBF8] border-b border-brand-border text-brand-olive font-bold uppercase tracking-wider text-[11px]">
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
                <tbody className="divide-y divide-brand-border text-brand-charcoal">
                  {grades.map((item) => (
                    <tr key={item.gradeId} className="hover:bg-brand-canvas transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-brand-deep">{item.courseCode}</td>
                      <td className="px-6 py-4 font-semibold text-brand-charcoal">{item.courseName}</td>
                      <td className="px-6 py-4 text-center font-medium">{item.credits}</td>
                      <td className="px-6 py-4 text-ink-secondary">{item.lecturerName}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-brand-deep">
                        {Number(item.score).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 font-bold rounded-md bg-[#EEF4E8] text-[#344522] border border-[#A3B18A] text-xs">
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
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <img src="/maskot_unpanda.png" alt="Maskot UNPANDA" className="w-16 h-16 object-contain mb-3 opacity-90" />
                          <h4 className="text-sm font-bold text-brand-deep">Belum ada nilai yang tumbuh di sini</h4>
                          <p className="text-xs text-ink-muted mt-1 max-w-sm">
                            Dosen pengampu sedang meramu hasil belajarmu. Cek kembali secara berkala.
                          </p>
                        </div>
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
            <div className="p-5 bg-white border border-brand-border rounded-2xl shadow-xs">
              <div className="text-xs font-bold text-brand-olive uppercase tracking-wider">Indeks Prestasi Kumulatif (IPK)</div>
              <div className="mt-2 text-4xl font-extrabold text-brand-deep">
                {transcript?.summary.gpa.toFixed(2) || '0.00'}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">Dihitung otomatis dari seluruh mata kuliah final berbobot SKS</div>
            </div>

            <div className="p-5 bg-white border border-brand-border rounded-2xl shadow-xs">
              <div className="text-xs font-bold text-brand-olive uppercase tracking-wider">Total SKS Lulus</div>
              <div className="mt-2 text-4xl font-extrabold text-brand-deep">
                {transcript?.summary.totalCredits || 0}
              </div>
              <div className="text-[11px] text-ink-muted mt-1">SKS telah disinkronkan ke Service Transkrip Universitas Panda Raya</div>
            </div>
          </div>

          <div className="bg-white border border-brand-border rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-border bg-[#FAFBF8] flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-deep">Riwayat Mata Kuliah Transkrip Resmi</h3>
              <span className="text-[11px] font-mono text-brand-olive">
                Sumber Data: Service Transkrip (Port 3002) via API Gateway
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFBF8] border-b border-brand-border text-brand-olive font-bold uppercase tracking-wider text-[11px]">
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
                <tbody className="divide-y divide-brand-border text-brand-charcoal">
                  {transcript?.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-brand-canvas transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-brand-deep">{entry.courseCode}</td>
                      <td className="px-6 py-4 font-semibold text-brand-charcoal">{entry.courseName}</td>
                      <td className="px-6 py-4 text-center font-medium">{entry.credits}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-brand-deep">
                        {Number(entry.score).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 font-bold rounded-md bg-[#EEF4E8] text-[#344522] border border-[#A3B18A] text-xs">
                          {entry.gradeLetter}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-brand-deep">
                        {entry.gradePoint.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-ink-muted font-mono text-[11px]">
                        {new Date(entry.syncedAt).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                  {(!transcript?.entries || transcript.entries.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <img src="/maskot_unpanda.png" alt="Maskot UNPANDA" className="w-16 h-16 object-contain mb-3 opacity-90" />
                          <h4 className="text-sm font-bold text-brand-deep">Transkripmu masih menunggu panen nilai</h4>
                          <p className="text-xs text-ink-muted mt-1 max-w-sm">
                            Mata kuliah akan otomatis masuk ke transkrip resmi setelah dosen menyelesaikan proses finalisasi kelas.
                          </p>
                        </div>
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
