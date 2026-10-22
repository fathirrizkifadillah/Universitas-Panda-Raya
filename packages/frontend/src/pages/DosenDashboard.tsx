import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../api/client.ts';
import type { LecturerClass, StudentGrade } from '../types.ts';
import { Badge } from '../components/Badge.tsx';
import { Modal } from '../components/Modal.tsx';
import {
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Users,
  ShieldAlert,
} from 'lucide-react';

export const DosenDashboard: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<LecturerClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editing state for scores: map studentId -> current edited score string
  const [scoresDraft, setScoresDraft] = useState<Record<string, string>>({});
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);

  // Finalization Modal state
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<LecturerClass[]>('/nilai');
    if (res.success && res.data) {
      setClasses(res.data);
      if (res.data.length > 0) {
        const active = selectedClassId && res.data.some(c => c.classId === selectedClassId)
          ? selectedClassId
          : res.data[0].classId;
        setSelectedClassId(active);

        // Prepopulate scores draft
        const targetClass = res.data.find(c => c.classId === active);
        if (targetClass) {
          const drafts: Record<string, string> = {};
          targetClass.students.forEach((s) => {
            drafts[s.studentId] = String(s.score);
          });
          setScoresDraft(drafts);
        }
      }
    } else {
      setError(res.message || 'Gagal memuat daftar kelas.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, [user]);

  const currentClass = classes.find((c) => c.classId === selectedClassId);

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setSuccessMessage(null);
    setError(null);
    const target = classes.find((c) => c.classId === classId);
    if (target) {
      const drafts: Record<string, string> = {};
      target.students.forEach((s) => {
        drafts[s.studentId] = String(s.score);
      });
      setScoresDraft(drafts);
    }
  };

  const handleScoreChange = (studentId: string, val: string) => {
    setScoresDraft((prev) => ({ ...prev, [studentId]: val }));
  };

  const handleSaveScore = async (student: StudentGrade) => {
    setSavingGradeId(student.gradeId);
    setError(null);
    setSuccessMessage(null);

    const val = scoresDraft[student.studentId];
    const num = Number(val);

    if (isNaN(num) || num < 0 || num > 100) {
      setError('Nilai harus berupa angka numerik antara 0 hingga 100.');
      setSavingGradeId(null);
      return;
    }

    const res = await apiFetch<{ gradeId: string; score: number; gradeLetter: string }>(
      `/nilai/${student.gradeId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ score: num }),
      }
    );

    if (res.success) {
      setSuccessMessage(`Nilai untuk ${student.fullName} berhasil diperbarui menjadi ${num}.`);
      await fetchClasses();
    } else {
      setError(res.message || 'Gagal menyimpan nilai.');
    }
    setSavingGradeId(null);
  };

  const handleFinalize = async () => {
    if (!currentClass) return;
    setFinalizing(true);
    setError(null);

    const res = await apiFetch(`/kelas/${currentClass.classId}/finalisasi`, {
      method: 'POST',
    });

    if (res.success) {
      setSuccessMessage('Kelas berhasil difinalisasi! Seluruh nilai kini terkunci dan telah disinkronkan ke Service Transkrip via Gateway.');
      setIsFinalizeModalOpen(false);
      await fetchClasses();
    } else {
      setError(res.message || 'Gagal memfinalisasi kelas.');
      setIsFinalizeModalOpen(false);
    }
    setFinalizing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-brand-deep">
              Gradebook & Pengelolaan Nilai Dosen
            </h2>
            <span className="text-[10px] font-bold bg-[#FAF5EB] text-[#8C6425] border border-[#C9A66B]/40 px-2 py-0.5 rounded-full">
              PANDAKAD
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Penilaian akademik terlindungi otorisasi kepemilikan kelas dan window waktu akses (07:00 – 21:00 WIB)
          </p>
        </div>

        <button
          onClick={fetchClasses}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-brand-deep bg-white border border-brand-border hover:bg-brand-canvas rounded-xl transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-brand-olive ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-[#EEF4E8] border border-[#A3B18A] flex items-start gap-3 text-[#344522] text-xs">
          <CheckCircle className="w-4 h-4 shrink-0 text-brand-olive mt-0.5" />
          <p className="font-semibold">{successMessage}</p>
        </div>
      )}

      {/* Class Selector Tabs */}
      <div className="flex flex-wrap gap-2.5">
        {classes.map((cl) => (
          <button
            key={cl.classId}
            onClick={() => handleSelectClass(cl.classId)}
            className={`px-4 py-3 rounded-2xl text-xs font-medium border transition-all text-left cursor-pointer ${
              selectedClassId === cl.classId
                ? 'bg-white border-brand-olive shadow-xs text-brand-charcoal ring-2 ring-brand-olive/30'
                : 'bg-brand-canvas border-brand-border text-ink-muted hover:bg-white hover:text-brand-charcoal'
            }`}
          >
            <div className="font-bold text-brand-charcoal flex items-center gap-2">
              <img src="/icons-unpanda/icon_gradebook.png" alt="" className="w-3.5 h-3.5 object-contain" />
              <span>{cl.courseCode} — {cl.courseName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-canvas text-brand-deep border border-brand-border font-mono font-bold">Kls {cl.section}</span>
            </div>
            <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2">
              <span>{cl.students.length} Mahasiswa</span>
              <span>•</span>
              <Badge variant={cl.isFinalized ? 'success' : 'neutral'} size="sm">
                {cl.isFinalized ? 'TERKUNCI' : 'DRAFT'}
              </Badge>
            </div>
          </button>
        ))}
      </div>

      {/* Gradebook Card */}
      {currentClass ? (
        <div className="bg-white border border-brand-border rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-brand-border bg-[#FAFBF8] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <img src="/icons-unpanda/icon_gradebook.png" alt="" className="w-6 h-6 object-contain shrink-0" />
                <h3 className="text-base font-extrabold text-brand-deep">
                  {currentClass.courseCode} — {currentClass.courseName} (Seksi {currentClass.section})
                </h3>
                <Badge variant={currentClass.isFinalized ? 'success' : 'warning'}>
                  {currentClass.isFinalized ? 'STATUS: FINAL' : 'STATUS: DRAFT (DAPAT DIEDIT)'}
                </Badge>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Semester: {currentClass.term} • SKS: {currentClass.credits} SKS • Universitas Panda Raya
              </p>
            </div>

            <div className="flex items-center gap-3">
              {currentClass.isFinalized ? (
                <div className="flex items-center gap-1.5 text-xs text-[#344522] bg-[#EEF4E8] border border-[#A3B18A] px-3.5 py-2 rounded-xl font-bold">
                  <Lock className="w-3.5 h-3.5 text-brand-olive" />
                  <span>Kelas Telah Difinalisasi</span>
                </div>
              ) : (
                <button
                  onClick={() => setIsFinalizeModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-deep hover:bg-brand-olive rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Finalisasi Nilai Kelas</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFBF8] border-b border-brand-border text-brand-olive font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3.5">NIM</th>
                  <th className="px-6 py-3.5">Nama Mahasiswa</th>
                  <th className="px-6 py-3.5 text-center">Huruf Mutu</th>
                  <th className="px-6 py-3.5 text-right w-48">Skor Angka (0-100)</th>
                  <th className="px-6 py-3.5 text-center w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-brand-charcoal">
                {currentClass.students.map((student) => {
                  const draftVal = scoresDraft[student.studentId] ?? String(student.score);
                  const isLocked = currentClass.isFinalized;
                  const isSaving = savingGradeId === student.gradeId;

                  return (
                    <tr key={student.gradeId} className="hover:bg-brand-canvas transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-brand-deep">{student.nim}</td>
                      <td className="px-6 py-4 font-semibold text-brand-charcoal">{student.fullName}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 font-bold rounded-md bg-[#EEF4E8] text-[#344522] border border-[#A3B18A] text-xs">
                          {student.gradeLetter}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          disabled={isLocked || isSaving}
                          value={draftVal}
                          onChange={(e) => handleScoreChange(student.studentId, e.target.value)}
                          className={`w-28 text-right px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border focus:ring-1 focus:ring-brand-olive ${
                            isLocked
                              ? 'bg-brand-canvas border-brand-border text-ink-muted cursor-not-allowed'
                              : 'bg-white border-brand-border text-brand-charcoal'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          disabled={isLocked || isSaving || draftVal === String(student.score)}
                          onClick={() => handleSaveScore(student)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-brand-olive hover:bg-brand-deep disabled:opacity-30 disabled:hover:bg-brand-olive rounded-xl transition-all cursor-pointer"
                        >
                          <Save className="w-3 h-3" />
                          <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white border border-brand-border rounded-2xl">
          <img src="/maskot_unpanda.png" alt="Maskot UNPANDA" className="w-16 h-16 object-contain mx-auto mb-3 opacity-90" />
          <h4 className="text-sm font-bold text-brand-deep">Belum ada kelas yang diampu</h4>
          <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
            Hubungi bagian administrasi Universitas Panda Raya jika Anda belum ditugaskan mengajar kelas semester ini.
          </p>
        </div>
      )}

      {/* Finalize Confirmation Modal */}
      <Modal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        title="Konfirmasi Finalisasi Nilai Kelas"
        isWarning
        description="Perhatian: Tindakan ini menerapkan prinsip Zero Trust Immutability."
        footer={
          <>
            <button
              onClick={() => setIsFinalizeModalOpen(false)}
              disabled={finalizing}
              className="px-4 py-2 text-xs font-semibold text-brand-charcoal hover:bg-brand-canvas rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-deep hover:bg-brand-olive rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{finalizing ? 'Memproses Sinkronisasi...' : 'Ya, Kunci & Finalisasi'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-brand-charcoal">
          <p className="font-medium">
            Dengan menekan tombol konfirmasi di bawah:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-brand-charcoal">
            <li>Nilai kelas <strong className="text-brand-deep">{currentClass?.courseName} ({currentClass?.courseCode})</strong> akan <strong>dikunci permanen</strong> dan tidak dapat diubah lagi.</li>
            <li>Service Nilai akan secara otomatis meminta <strong>Service Token (RS256)</strong> ke API Gateway.</li>
            <li>Nilai mahasiswa akan <strong>disinkronkan langsung</strong> ke Service Transkrip melalui API Gateway.</li>
            <li>Transkrip resmi mahasiswa di Universitas Panda Raya akan langsung terbit dengan IPK terhitung.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};
