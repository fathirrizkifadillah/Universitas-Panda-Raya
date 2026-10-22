# NILAI — Academic Records (Zero Trust Architecture)
### Tugas Praktikum Individu: Keamanan Informasi (KP70065004)
**Program Studi Informatika — Universitas Siliwangi**

Sistem Nilai Akademik berbasis **Zero Trust Security** yang menerapkan arsitektur **NIST SP 800-207** secara nyata pada level aplikasi dengan pemisahan proses yang ketat (*process isolation*), *asymmetric RS256 signing*, *device binding*, *time window enforcement*, pertahanan *Assume Breach* (*Gateway Secret*), sinkronisasi transkrip idempoten, dan pencatatan *Audit Trail*.

---

## 1. Daftar Port & Layanan (Architecture Layout)

| Komponen | Port | Teknologi | Tanggung Jawab (NIST SP 800-207) |
|---|---|---|---|
| **API Gateway** | `3000` | Node.js + Express + TypeScript | **Policy Enforcement Point (PEP)**: Autentikasi, Policy Engine, Audit Logger, Proxy |
| **Service Nilai** | `3001` | Node.js + Express + TypeScript | **Resource Service**: Gradebook, validasi kepemilikan kelas, inisiasi finalisasi nilai |
| **Service Transkrip** | `3002` | Node.js + Express + TypeScript | **Resource Service**: Transkrip resmi, sinkronisasi idempoten via Service Token |
| **Frontend ("NILAI")** | `5173` | React 18 + Vite + TypeScript + Tailwind CSS | **Client UI**: Dashboard akademik multi-role, memory token storage, zero secrets in client |
| **PostgreSQL Lokal** | `5432` | PostgreSQL 17 | **Resource**: Basis data bersama `zero_trust_db` (users, devices, grades, transcripts, audit) |

---

## 2. Prasyarat Sistem (Prerequisites)

- **Node.js**: Versi `v20.x` atau lebih baru (`v24.x` direkomendasikan).
- **npm**: Versi `10.x` atau lebih baru.
- **PostgreSQL**: PostgreSQL 17 lokal aktif pada port `5432`.
- **Operating System**: Windows (PowerShell) / Linux / macOS.

---

## 3. Langkah Instalasi & Setup Cepat (Windows PowerShell)

Jalankan perintah-perintah berikut secara berurutan di terminal **PowerShell**:

### Langkah 1: Kloning & Masuk ke Direktori Proyek
```powershell
Set-Location C:\CODING\zero_trust_security
```

### Langkah 2: Instal Dependensi
```powershell
npm install
npm install --prefix packages/frontend
```

### Langkah 3: Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```powershell
Copy-Item .env.example .env
```
Pastikan variabel database pada file `.env` telah disesuaikan:
```ini
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=##fathirdatabase$$1014
PGDATABASE=zero_trust_db
```

### Langkah 4: Pembuatan Kunci Kriptografi Asimetris (RS256)
Buat pasangan kunci RSA 2048-bit (dibuat sekali dan diabaikan dari git):
```powershell
npm run keys:gen
```
*Private key tersimpan di `keys/private_key.pem`, public key di `keys/public_key.pem`.*

### Langkah 5: Migrasi Skema Basis Data & Deterministic Seed
```powershell
npm run db:migrate
npm run db:seed
```

---

## 4. Cara Menjalankan Aplikasi

Anda dapat menjalankan seluruh sistem dengan satu perintah terpadu atau secara terpisah di terminal yang berbeda:

### Opsi A: Menjalankan Seluruh Sistem Sekaligus (Rekomendasi)
```powershell
npm run dev
```
*Perintah ini akan menyalakan Gateway (3000), Service Nilai (3001), Service Transkrip (3002), dan Frontend (5173).*

### Opsi B: Menjalankan Per Layanan Secara Terpisah
Buka 4 jendela PowerShell terpisah:
- **Terminal 1 (API Gateway)**:
  ```powershell
  npm run dev:gateway
  ```
- **Terminal 2 (Service Nilai)**:
  ```powershell
  npm run dev:nilai
  ```
- **Terminal 3 (Service Transkrip)**:
  ```powershell
  npm run dev:transkrip
  ```
- **Terminal 4 (Frontend UI)**:
  ```powershell
  npm run dev:frontend
  ```

Buka peramban (browser) di: **`http://localhost:5173`**

---

## 5. Akun Demo & ID Perangkat (Deterministic Seed)

Pada halaman login terdapat tombol **"Akun Demo Cepat"** untuk pengujian satu-klik tanpa perlu mengetik manual:

| Peran (Role) | Nama Pengguna | Password Demo | ID Perangkat Terdaftar (`X-Device-ID`) | Hak Akses Utama |
|---|---|---|---|---|
| **Mahasiswa 1** | `mahasiswa1` | `PasswordMhs123!` | `dev-mhs1-thinkpad-01` | Nilai sendiri (IF3101 & IF2204), transkrip sendiri (NIM: 2207051001) |
| **Mahasiswa 2** | `mahasiswa2` | `PasswordMhs123!` | `dev-mhs2-laptop-02` | Nilai sendiri, transkrip sendiri (NIM: 2207051002) |
| **Mahasiswa 3** | `mahasiswa3` | `PasswordMhs123!` | `dev-mhs3-desktop-03` | Nilai sendiri (IF3101), transkrip sendiri (NIM: 2207051003) |
| **Dosen 1** | `dosen1` | `PasswordDosen123!` | `dev-dosen1-laptop-01` | Mengampu Kelas A (Keamanan Informasi IF3101), edit & finalisasi nilai |
| **Dosen 2** | `dosen2` | `PasswordDosen123!` | `dev-dosen2-macbook-02` | Mengampu Kelas B (Basis Data Lanjut IF2204), edit & finalisasi nilai |
| **Admin** | `admin1` | `PasswordAdmin123!` | `dev-admin-chrome-01` | Membaca seluruh transkrip mahasiswa, melihat Audit Trail PEP |
| *Simulasi Ilegal* | `mahasiswa1` | `PasswordMhs123!` | `device-asing-ilegal-999` | **DITOLAK (403 Policy Deny)** — Simulasi penolakan perangkat asing |

> **PERINGATAN:** Seluruh kredensial di atas dibuat khusus untuk lingkungan demonstrasi lokal. Jangan pernah menggunakan password atau kredensial ini di lingkungan publik/internet.

---

## 6. Cara Menjalankan Pengujian Otomatis

Proyek ini dilengkapi dengan piramida pengujian otomatis yang komprehensif:

### 1. Menjalankan Unit, Integration & Security Tests (Vitest)
```powershell
npm test
```
*Menjalankan 41 test cases (Unit Crypto, Time Window, Auth Flow, Service-to-Service, SQLi, IDOR, Token Abuse, dan Replay Attacks).*

### 2. Menjalankan Browser End-to-End Tests (Playwright)
```powershell
npm run test:e2e
```
*Menguji skenario interaksi browser nyata untuk Mahasiswa, Dosen, Admin, dan Security Device Rejection pada berbagai breakpoint layar (Desktop, Tablet, Mobile).*

---

## 7. Dokumentasi Lengkap Proyek

Informasi mendalam dan analisis teknis tersedia pada folder `docs/`:
- **[docs/architecture.md](file:///c:/CODING/zero_trust_security/docs/architecture.md)**: Diagram arsitektur NIST SP 800-207, pembagian zona keamanan, dan sequence diagram alur request.
- **[docs/security-model.md](file:///c:/CODING/zero_trust_security/docs/security-model.md)**: Model ancaman, matriks kontrol keamanan, siklus token RS256, dan analisis batasan sistem.
- **[docs/api.md](file:///c:/CODING/zero_trust_security/docs/api.md)**: Kontrak API lengkap (request/response format, status HTTP, error codes).
- **[docs/testing-report.md](file:///c:/CODING/zero_trust_security/docs/testing-report.md)**: Laporan detail pengujian, matriks matched requirements, dan bukti eksekusi.
- **[docs/skills-used.md](file:///c:/CODING/zero_trust_security/docs/skills-used.md)**: Audit trail pemakaian skill, verifikasi path `SKILL.md`, dan keputusan teknis yang dipengaruhi.
- **[docs/demo-script.md](file:///c:/CODING/zero_trust_security/docs/demo-script.md)**: Rencana dan naskah video demo 6–9 menit beserta panduan lokasi file kode.

---

## 8. Panduan Penanganan Masalah (Common Errors & Troubleshooting)

| Gejala Masalah | Penyebab Umum | Solusi |
|---|---|---|
| `EADDRINUSE: address already in use :::3000` (atau 3001/3002/5173) | Ada proses node yang masih menggantung dari eksekusi sebelumnya. | Hentikan proses via PowerShell: `Get-Process node \| Stop-Process -Force` |
| `password authentication failed for user "postgres"` | Password PostgreSQL pada file `.env` belum sesuai dengan master password lokal Anda. | Periksa variabel `PGPASSWORD` pada file `.env`. |
| `RSA Private key not found` | Belum menjalankan pembuatan kunci enkripsi. | Jalankan `npm run keys:gen`. |
| `CLASS_FINALIZED` saat update nilai | Nilai kelas telah difinalisasi dosen dan terkunci (read-only). | Status kelas bersifat permanen sesuai prinsip Zero Trust. Untuk menguji ulang, jalankan `npm run db:reset`. |
| `OUTSIDE_ACCESS_WINDOW` | Request dilakukan di luar pukul 07:00 – 21:00 WIB. | Sesuaikan jam server atau ubah `ACCESS_WINDOW_START` / `ACCESS_WINDOW_END` pada `.env`. |
