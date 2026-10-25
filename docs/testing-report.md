# Testing & Quality Assurance Report

## 1. Ringkasan Eksekutif Hasil Pengujian

Seluruh rangkaian pengujian (Unit, Integration, Security Abuse Cases, dan End-to-End Browser Journeys) telah dieksekusi secara nyata pada lingkungan lokal Windows dengan hasil **100% PASS**:

- **Total Test Suites**: 6 Suites (5 Vitest Suites + 1 Playwright Suite)
- **Total Test Cases**: **53 Test Cases** (41 Vitest Tests + 12 Playwright Multi-Viewport Tests)
- **Status Akhir**: **53 Passed, 0 Failed, 0 Skipped**
- **Test Artifacts**: 8 screenshot browser visual tersimpan di `docs/screenshots/`

---

## 2. Rincian Eksekusi Test Suite

### A. Vitest Test Pyramid (41 Tests - 100% Pass)
Command: `npm test` (`npx vitest run`)

| Test Suite | File | Jumlah Test | Durasi | Status | Cakupan Verifikasi |
|---|---|---|---|---|---|
| **Unit: Crypto & Token** | `tests/unit/crypto-tokens.test.ts` | 8 | 551 ms | **PASS** | Penandatanganan & verifikasi RS256 JWT, audience filtering, deteksi tampering signature, Bcrypt password hash, SHA-256 token hash, timing-safe equality, konversi nilai angka ke huruf & bobot mutu |
| **Unit: Time Window** | `tests/unit/time-window.test.ts` | 6 | 50 ms | **PASS** | Pengujian batas waktu (Asia/Jakarta 07:00-21:00 WIB) pada boundary 06:59 (Deny), 07:00 (Allow), 12:30 (Allow), 20:59 (Allow), 21:00 (Allow), dan 21:01 (Deny) |
| **Integration: Auth Flow** | `tests/integration/auth-flow.test.ts` | 8 | 3.20 s | **PASS** | Login berhasil + Set-Cookie HttpOnly refreshToken, penolakan password salah, penolakan device asing, penolakan header device hilang, rotasi refresh token otomatis, deteksi reuse refresh token lama (family revocation), logout & revokasi database, penerbitan service token |
| **Integration: Workflow** | `tests/integration/business-workflow.test.ts` | 9 | 2.61 s | **PASS** | Mahasiswa melihat nilai sendiri melalui Gateway, Dosen melihat kelas sendiri, penolakan dosen mengedit kelas dosen lain, update nilai valid di kelas yang diampu, finalisasi kelas + transmisi service token + sinkronisasi transkrip antar-service, penguncian gradebook read-only pasca-finalisasi (409 Conflict), pencegahan re-finalisasi (409 Conflict), mahasiswa melihat transkrip dengan IPK terhitung, admin melihat transkrip mahasiswa manapun |
| **Security: Abuse Cases** | `tests/security/security-abuse.test.ts` | 10 | 1.43 s | **PASS** | Penolakan direct access port 3001 tanpa Gateway Secret, penolakan direct access dengan secret salah, penolakan direct access tanpa token walau secret benar, stripping header secret yang diinjeksi klien, pencegahan IDOR transkrip mahasiswa, pencegahan eskalasi hak akses (role tampering di body/query), isolasi endpoint service sync dari token pengguna biasa, proteksi SQL Injection pada form login, verifikasi audit log bebas kebocoran kredensial/token |

---

### B. Playwright Browser E2E Tests (12 Tests - 100% Pass)
Command: `npx playwright test`

Dijalankan secara headless pada mesin browser Chromium nyata pada 3 resolusi viewport berbeda:
1. **Desktop Chromium (1440x900)**: 4 tests passed (17.8s)
2. **Tablet Chromium (768x1024)**: 4 tests passed (24.4s)
3. **Mobile Pixel 7 (360x800)**: 4 tests passed (18.2s)

| Journey | Skenario Alur Pengguna | Bukti Screenshot | Status |
|---|---|---|---|
| **Journey 1: Mahasiswa** | Login via demo shortcut `mahasiswa1` → Akses daftar nilai mata kuliah semester → Pindah ke tab Transkrip Akademik Resmi → Verifikasi IPK & SKS → Logout | `docs/screenshots/01-mahasiswa-grades.png`<br/>`docs/screenshots/02-mahasiswa-transkrip.png` | **PASS** |
| **Journey 2: Dosen** | Login via demo shortcut `dosen1` → Buka kelas IF3101 → Tinjau gradebook mahasiswa → Buka Modal Konfirmasi Finalisasi Nilai Kelas → Konfirmasi finalisasi → Verifikasi status berubah menjadi `STATUS: FINAL` & gradebook terkunci (read-only) → Logout | `docs/screenshots/03-dosen-gradebook.png`<br/>`docs/screenshots/04-dosen-finalize-modal.png`<br/>`docs/screenshots/05-dosen-finalized-locked.png` | **PASS** |
| **Journey 3: Admin** | Login via demo shortcut `admin1` → Cari transkrip mahasiswa `2207051001` → Verifikasi nilai dan IPK terakumulasi → Buka tab Audit Trail Log PEP → Verifikasi log terekam secara real-time dengan status ALLOW/DENY → Logout | `docs/screenshots/06-admin-transcript.png`<br/>`docs/screenshots/07-admin-audit-trail.png` | **PASS** |
| **Journey 4: Security Negative** | Klik tombol demo "Uji Device Asing" (`device-asing-ilegal-999`) → Kirim login → Policy Engine menolak dengan status 403 Forbidden → Verifikasi banner merah penolakan Zero Trust di UI | `docs/screenshots/08-security-device-rejected.png` | **PASS** |

---

## 3. Matriks Matched Requirements ke Automated Test Evidence

| No | Kebutuhan Wajib Rubrik | File Implementasi | Bukti Uji Otomatis |
|---|---|---|---|
| 1 | API Gateway / PEP port 3000 | `packages/gateway/src/server.ts` | `tests/integration/business-workflow.test.ts:100` |
| 2 | Service Nilai port 3001 terpisah | `packages/service-nilai/src/server.ts` | `tests/integration/business-workflow.test.ts:114` |
| 3 | Service Transkrip port 3002 terpisah | `packages/service-transkrip/src/server.ts` | `tests/integration/business-workflow.test.ts:193` |
| 4 | Asymmetric RS256 Access Token (TTL 10m) | `packages/shared/src/crypto.ts` | `tests/unit/crypto-tokens.test.ts:16` |
| 5 | Revocable Refresh Token (TTL 1d, hash di DB) | `packages/gateway/src/controllers/authController.ts` | `tests/integration/auth-flow.test.ts:65` |
| 6 | Service Token (TTL 5m, role service) | `packages/gateway/src/controllers/authController.ts` | `tests/integration/auth-flow.test.ts:140` |
| 7 | Gateway Secret Injection & Direct Call Rejection | `packages/gateway/src/proxy/serviceProxy.ts` & `verifyInternalAccess.ts` | `tests/security/security-abuse.test.ts:68` |
| 8 | Otorisasi Konteks: X-Device-ID | `packages/gateway/src/policy/policyEngine.ts` | `tests/integration/auth-flow.test.ts:50` & Playwright Journey 4 |
| 9 | Otorisasi Konteks: Time Window 07:00-21:00 WIB | `packages/gateway/src/policy/timeEvaluator.ts` | `tests/unit/time-window.test.ts:6` |
| 10 | Pencegahan IDOR Mahasiswa | `packages/gateway/src/policy/policyEngine.ts` | `tests/security/security-abuse.test.ts:106` |
| 11 | Audit Trail Logging (Allow/Deny, no secrets) | `packages/gateway/src/audit/auditLogger.ts` | `tests/security/security-abuse.test.ts:153` |
| 12 | Finalisasi Kelas & Sinkronisasi Idempoten | `packages/service-nilai/src/routes/nilaiRoutes.ts` | `tests/integration/business-workflow.test.ts:156` |

---

## 4. Temuan dan Isu Terbuka (Remaining Issues)

- **Issues / Failures Aktif**: **Nihil (0)**. Seluruh 53 test cases berhasil lulus.
- **Batasan Simulasi Jam Operasional**: Dalam environment otomatis, simulasi jam di luar window (07:00-21:00 WIB) diuji secara deterministik menggunakan injeksi header `X-Mock-Time` pada test runner. Pada lingkungan produksi, waktu diambil murni dari jam internal server berbasis timezone `Asia/Jakarta`.
