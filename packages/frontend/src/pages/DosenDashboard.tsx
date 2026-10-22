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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-canvas-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">
            Gradebook & Pengelolaan Nilai Dosen
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Penilaian akademik terlindungi otorisasi kepemilikan kelas dan window waktu akses (07:00 – 21:00 WIB)
          </p>
        </div>

        <button
          onClick={fetchClasses}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-secondary bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-800 text-xs">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Class Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {classes.map((cl) => (
          <button
            key={cl.classId}
            onClick={() => handleSelectClass(cl.classId)}
            className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
              selectedClassId === cl.classId
                ? 'bg-white border-accent-600 shadow-sm text-ink ring-1 ring-accent-600'
                : 'bg-canvas-subtle/50 border-slate-200 text-ink-muted hover:bg-white hover:text-ink'
            }`}
          >
            <div className="font-semibold text-ink flex items-center gap-2">
              <span>{cl.courseCode} — {cl.courseName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono">Kls {cl.section}</span>
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5 flex items-center gap-1.5">
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
      {currentClass && (
        <div className="bg-white border border-canvas-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-canvas-border bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">
                  {currentClass.courseCode} — {currentClass.courseName} (Seksi {currentClass.section})
                </h3>
                <Badge variant={currentClass.isFinalized ? 'success' : 'warning'}>
                  {currentClass.isFinalized ? 'STATUS: FINAL' : 'STATUS: DRAFT (DAPAT DIEDIT)'}
                </Badge>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Semester: {currentClass.term} • SKS: {currentClass.credits} SKS
              </p>
            </div>

            <div className="flex items-center gap-3">
              {currentClass.isFinalized ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kelas Telah Difinalisasi</span>
                </div>
              ) : (
                <button
                  onClick={() => setIsFinalizeModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-accent-700 hover:bg-accent-800 rounded-lg shadow-sm transition-colors"
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
              <thead className="bg-slate-50 border-b border-canvas-border text-ink-muted font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3.5">NIM</th>
                  <th className="px-6 py-3.5">Nama Mahasiswa</th>
                  <th className="px-6 py-3.5 text-center">Huruf Mutu</th>
                  <th className="px-6 py-3.5 text-right w-48">Skor Angka (0-100)</th>
                  <th className="px-6 py-3.5 text-center w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-border text-ink">
                {currentClass.students.map((student) => {
                  const draftVal = scoresDraft[student.studentId] ?? String(student.score);
                  const isLocked = currentClass.isFinalized;
                  const isSaving = savingGradeId === student.gradeId;

                  return (
                    <tr key={student.gradeId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-ink">{student.nim}</td>
                      <td className="px-6 py-4 font-medium text-ink">{student.fullName}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2 py-0.5 font-bold rounded bg-slate-100 text-slate-800 text-xs">
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
                          className={`w-28 text-right px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border focus:ring-1 focus:ring-accent-600 ${
                            isLocked
                              ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-white border-slate-300 text-ink'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          disabled={isLocked || isSaving || draftVal === String(student.score)}
                          onClick={() => handleSaveScore(student)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent-700 bg-accent-50 hover:bg-accent-100 disabled:opacity-30 disabled:hover:bg-accent-50 rounded-lg transition-colors"
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
              className="px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-slate-100 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-accent-700 hover:bg-accent-800 rounded-lg transition-colors shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{finalizing ? 'Memproses Sinkronisasi...' : 'Ya, Kunci & Finalisasi'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-ink-secondary">
          <p>
            Dengan menekan tombol konfirmasi di bawah:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-ink">
            <li>Nilai kelas <strong className="text-ink">{currentClass?.courseName} ({currentClass?.courseCode})</strong> akan <strong>dikunci permanen</strong> dan tidak dapat diubah lagi.</li>
            <li>Service Nilai akan secara otomatis meminta <strong>Service Token (RS256)</strong> ke API Gateway.</li>
            <li>Nilai mahasiswa akan <strong>disinkronkan langsung</strong> ke Service Transkrip melalui API Gateway.</li>
            <li>Transkrip resmi mahasiswa akan langsung terbit dengan IPK terhitung.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};
