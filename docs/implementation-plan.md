# Plan Implementasi: Zero Trust Academic Records System ("NILAI")

## 1. Ringkasan Eksekutif & Prinsip Zero Trust
Sistem ini dirancang untuk menerapkan prinsip **NIST SP 800-207 (Zero Trust Architecture)** pada level aplikasi secara utuh dan nyata:
1. **Never Trust, Always Verify**: Setiap permintaan wajib diautentikasi dan diotorisasi berulang kali. Ketiadaan token, token kedaluwarsa, device tak dikenal, atau direct access ke microservice internal ditolak secara mutlak (*fail-closed*).
2. **Least Privilege**: Mahasiswa hanya dapat melihat nilai & transkrip miliknya; Dosen hanya dapat melihat dan menilai kelas yang diampunya; Admin hanya dapat membaca transkrip; Service Nilai hanya dapat menyinkronkan data transkrip dengan service token terbatas.
3. **Assume Breach**: Microservice internal (`Service Nilai` & `Service Transkrip`) tidak pernah mempercayai panggilan jaringan secara implisit. Keduanya memvalidasi header rahasia (`X-Gateway-Secret`) yang hanya diketahui Gateway dan memverifikasi tanda tangan kriptografis token (asymmetric RS256 public key). Jika penyerang menyusup ke jaringan internal atau mencoba mem-bypass gateway, service tetap menolak permintaan.

---

## 2. Batas Layanan (Service Boundaries) & Alokasi Port

| Komponen | Port | Teknologi | Tanggung Jawab Utama |
|---|---|---|---|
| **API Gateway (PEP)** | 3000 | Node.js + Express + TypeScript | Policy Enforcement Point (PEP), Policy Engine (PDP), Auth & Token issuance/refresh, Audit logger, Reverse Proxy aman |
| **Service Nilai** | 3001 | Node.js + Express + TypeScript | Pengelolaan nilai mahasiswa, data kelas, verifikasi secret + JWT, inisiasi alur finalisasi nilai |
| **Service Transkrip** | 3002 | Node.js + Express + TypeScript | Pengelolaan transkrip akademik mahasiswa, verifikasi secret + service JWT, endpoint sinkronisasi transkrip idempoten |
| **Frontend ("NILAI")** | 5173 | React + Vite + TypeScript + Tailwind CSS | Antarmuka akademik profesional, stateful UI via Gateway, memory-based token storage, zero client-side secret |
| **PostgreSQL Database** | 5432 | PostgreSQL 17 (Lokal) | Penyimpanan persisten bersama: users, devices, courses, classes, enrollments, grades, transcripts, refresh_sessions, service_clients, audit_events, outbox_events |

---

## 3. Siklus Kriptografi & Token (Token Lifecycle)

- **Asymmetric Signing (RS256)**:
  - Private key RSA (2048-bit) disimpan aman di direktori lokal Gateway (masuk `.gitignore`).
  - Public key RSA didistribusikan ke Gateway, Service Nilai, dan Service Transkrip untuk verifikasi signature secara independen.
- **Access JWT**:
  - Masa berlaku: **10 menit** (`TTL=10m`).
  - Minimal claims: `sub` (User ID UUID), `role` (`mahasiswa` | `dosen` | `admin`), `nim` / `nip`, `iss`, `aud`, `iat`, `exp`, `jti`, `token_use='access'`.
  - Dikirim melalui header `Authorization: Bearer <token>`.
- **Refresh Token**:
  - Karakter: string opaque kriptografis 64 byte hexadecimal acak.
  - Masa berlaku: **1 hari** (`TTL=1d`).
  - Disimpan dalam bentuk hash (SHA-256) di tabel `refresh_sessions` (tidak ada plaintext token di database).
  - Rotasi otomatis saat digunakan (*refresh token rotation*); pencabutan token (*revocation*) saat logout.
- **Service Token**:
  - Diterbitkan Gateway via endpoint `POST /auth/service` khusus Service Nilai menggunakan Client ID dan Secret terdaftar.
  - Masa berlaku: **5 menit** (`TTL=5m`).
  - Claims: `role='service'`, `token_use='service'`, `sub='grades-service'`, `aud='transcript-service'`.
- **Gateway Secret Injection**:
  - Header `X-Gateway-Secret` di-strip/di-overwrite oleh Gateway pada setiap inbound request client agar client tidak dapat memalsukan secret.
  - Gateway menyuntikkan `X-Gateway-Secret` resmi dari environment saat meneruskan request ke Service Nilai atau Service Transkrip.
  - Service memvalidasi header ini menggunakan *constant-time comparison* (`crypto.timingSafeEqual`).

---

## 4. Matriks Akses & Kebijakan Konteks (Policy Matrix)

| Endpoint | PEP / Service | Role Diizinkan | Kondisi Kebijakan (Zero Trust Context) |
|---|---|---|---|
| `POST /auth/login` | Gateway (PEP) | Publik | Kredensial valid + `X-Device-ID` terdaftar & aktif untuk user tersebut |
| `POST /auth/refresh` | Gateway (PEP) | Semua role | Refresh token valid, belum kedaluwarsa, belum dicabut di database |
| `POST /auth/logout` | Gateway (PEP) | Semua role | Mencabut session refresh token di database & menghapus cookie |
| `POST /auth/service` | Gateway (PEP) | Service Nilai | Client ID & Client Secret valid (constant-time verification) |
| `GET /nilai` | Nilai (3001) | Mahasiswa, Dosen | Mahasiswa: hanya nilai miliknya sendiri. Dosen: hanya nilai kelas yang diampunya |
| `PUT /nilai/:id` | Nilai (3001) | Dosen | Kelas diampu oleh dosen yang bersangkutan, nilai kelas belum difinalisasi, jam akses aktif (07.00–21.00 WIB) |
| `POST /kelas/:id/finalisasi` | Nilai (3001) | Dosen | Kelas diampu dosen, jam akses aktif, belum final. Mengunci kelas dan memicu sinkronisasi transkrip via Gateway |
| `GET /transkrip/:nim` | Transkrip (3002) | Mahasiswa, Admin | Mahasiswa: hanya NIM miliknya sendiri. Admin: dapat melihat seluruh NIM |
| `POST /transkrip/sinkron` | Transkrip (3002) | Service Token | Hanya token service dengan claim valid; token user biasa (apapun rolenya) ditolak 403 |

### Verifikasi Konteks Tambahan:
- **Device Fingerprint / ID**: Header `X-Device-ID` diperiksa ke tabel `devices`. Device harus aktif dan dimiliki oleh user yang terotentikasi.
- **Time Window**: Evaluasi jam server waktu `Asia/Jakarta` (07.00 - 21.00 WIB). Konfigurasi waktu dapat diinjeksi (*clock provider*) untuk memfasilitasi pengujian otomatis deterministik.
- **Audit Trail**: Setiap evaluasi policy dicatat ke database (`audit_events`) mencakup timestamp, subject_id, subject_type, endpoint, method, device_id, decision (`ALLOW` / `DENY`), reason_code, dan request_id. Payload sensitif (password, secret, token) tidak pernah dicatat.

---

## 5. Skema Basis Data PostgreSQL

Tabel-tabel utama yang dirancang:
1. `users`: ID (UUID), username, email, full_name, role (`mahasiswa`, `dosen`, `admin`), password_hash (Argon2id/Bcrypt), nim_nip, is_active, created_at, updated_at.
2. `devices`: ID (UUID), user_id (FK), device_id (unique string), label, is_active, last_seen_at.
3. `courses`: ID (UUID), code (unique), name, credits (SKS), created_at.
4. `classes`: ID (UUID), course_id (FK), lecturer_id (FK users), academic_year, term, section, is_finalized (boolean), finalized_by (FK), finalized_at.
5. `enrollments`: ID (UUID), class_id (FK), student_id (FK users), unique(class_id, student_id).
6. `grades`: ID (UUID), class_id (FK), student_id (FK users), score (numeric 0..100), updated_by (FK), created_at, updated_at.
7. `transcript_entries`: ID (UUID), student_id (FK), class_id (FK), course_id (FK), score, grade_letter, credits, synced_at, source_version.
8. `refresh_sessions`: ID (UUID), user_id (FK), token_hash (unique), expires_at, revoked_at, replaced_by_id, created_at.
9. `service_clients`: ID (UUID), client_id (unique), secret_hash, allowed_scope, is_active.
10. `audit_events`: ID (UUID), occurred_at, subject_id, subject_type (`user` | `service` | `anonymous`), method, path, device_id, decision (`ALLOW` | `DENY`), reason_code, request_id.
11. `outbox_events`: ID (UUID), event_type, aggregate_id, payload (JSONB), status (`PENDING` | `COMPLETED` | `FAILED`), attempts, created_at, processed_at.

---

## 6. Rencana Pengujian Komprehensif (Test Pyramid)

1. **Unit Tests (Vitest)**:
   - Validasi klaim JWT & algoritma (menolak `none` alg, expired, wrong audience).
   - Policy Engine rules: ownership check, NIM mismatch, closed time window, finalized grade lock.
   - Perhitungan huruf mutu akademik (A, A-, B+, B, dll.).
2. **Integration API Tests (Supertest)**:
   - Alur autentikasi: login sukses, login salah password, login device tidak terdaftar.
   - Rotasi & revocasi refresh token; reuse detection.
   - Proxy Gateway dan penolakan direct request ke port 3001/3002 tanpa Gateway Secret.
   - Penolakan permintaan direct service tanpa token valid walau secret ada.
   - Service-to-service authentication (`POST /auth/service` -> `POST /transkrip/sinkron`).
   - Idempotensi sinkronisasi transkrip.
3. **Security Negative Tests**:
   - IDOR prevention: Mahasiswa A mencoba mengakses transkrip/nilai Mahasiswa B via path & parameter.
   - Privilege Escalation: Mahasiswa mencoba inject `role=admin` di body/header.
   - Spoofing Header: Client mengirim `X-Gateway-Secret` palsu.
   - SQL Injection & Parameter Tampering.
   - Boundary Clock tests: pengujian jam 06:59, 07:00, 20:59, 21:00, 21:01.
4. **E2E Browser Tests (Playwright Chromium)**:
   - Journey Mahasiswa: Login -> lihat dashboard & nilai -> transkrip -> logout.
   - Journey Dosen: Login -> pilih kelas -> ubah nilai -> simpan -> konfirmasi modal finalisasi -> gradebook terkunci (read-only) -> transkrip mahasiswa terbarui.
   - Journey Admin: Login -> cari transkrip mahasiswa -> audit trail view (read-only).
   - Negative Journey: Penolakan device asing, penolakan saat session expired.
   - Screenshot otomatis pada breakpoint mobile (360px), tablet (768px), dan desktop (1440px).

---

## 7. Rencana Gate Kualitas (G0 - G7)

- [x] **G0 - Discovery & Rencana**: Audit workspace, periksa versi runtime (Node v24, Postgres 17, Docker), inventarisasi skill, susun rencana ini.
- [ ] **G1 - Arsitektur, Kontrak API & Keypair**: Setup TypeScript workspace monorepo/multi-package, generate RS256 keypair, buat skema data ERD & kontrak API.
- [ ] **G2 - Basis Data & Migrasi/Seed**: Setup koneksi PostgreSQL, buat tabel dengan constraint & foreign key ketat, seed data deterministik (1 admin, 2 dosen, 3 mahasiswa, 2 kelas, device terdaftar).
- [ ] **G3 - Gateway (PEP) & Service Security**: Implementasi PEP proxy, policy engine, audit logger, validasi X-Device-ID, secret injection, serta middleware verifikasi independen di service.
- [ ] **G4 - Alur Bisnis Nilai & Transkrip**: Implementasi modul nilai, finalisasi transaksi terkunci, komunikasi service token, dan sinkronisasi transkrip idempoten.
- [ ] **G5 - Frontend Premium ("NILAI")**: UI React + Tailwind akademik berkelas, tanpa template generik/AI slop, terhubung ke real Gateway API.
- [ ] **G6 - Pengujian Penuh & Hardening**: Eksekusi seluruh test pyramid (Unit, Integration, Security, Playwright E2E), tangkap screenshot, verifikasi audit trail.
- [ ] **G7 - Serah Terima & Dokumentasi**: README lengkap, panduan setup PowerShell, `docs/architecture.md`, `docs/security-model.md`, `docs/api.md`, `docs/testing-report.md`, `docs/skills-used.md`, dan naskah demo video 6-9 menit (`docs/demo-script.md`).
