# NILAI — Academic Records (Zero Trust Architecture)
### Tugas Praktikum Individu: Keamanan Informasi (KP70065004)
**Program Studi Informatika — Universitas Siliwangi**

Sistem Nilai Akademik berbasis **Zero Trust Security** yang menerapkan arsitektur **NIST SP 800-207** secara nyata pada level aplikasi dengan isolasi proses mikro-layanan (*process isolation*), penandatanganan token asimetris *RS256*, verifikasi identitas perangkat (*device binding*), penegakan jendela waktu operasional (*time window enforcement*), pertahanan *Assume Breach* (*Gateway Secret*), sinkronisasi transkrip idempoten, dan pencatatan jejak audit (*Audit Trail*).

---

## 1. Daftar Port & Arsitektur Layanan (NIST SP 800-207)

```
                       +-----------------------------------+
                       |        Client (Postman / Web)     |
                       +-----------------+-----------------+
                                         | Access Token + X-Device-ID
                                         v
   +-----------------------------------------------------------------------+
   |                     API GATEWAY (Port 3000) - PEP                     |
   |   - Policy Enforcement Point                                          |
   |   - Policy Engine / Policy Administrator (PE/PA)                      |
   |   - Audit Logger (audit_events & logs/audit.log)                      |
   |   - Sanitasi Header (Strip client X-Gateway-Secret)                   |
   +--------------------+-----------------------------+--------------------+
                        |                             |
      ALLOW +           |                             | ALLOW +
      X-Gateway-Secret  v                             v X-Gateway-Secret
   +----------------------------+     Service Token   +----------------------------+
   | Service Nilai (Port 3001)  |-------------------->| Service Transkrip (3002)   |
   | - Resource Service         | (via Gateway PEP)   | - Resource Service         |
   | - Verifikasi Secret & RS256|                     | - Verifikasi Secret & RS256|
   | - Gradebook & Finalisasi   |                     | - Idempotent Upsert        |
   +--------------+-------------+                     +--------------+-------------+
                  |                                                  |
                  +-----------------------+--------------------------+
                                          |
                                          v
                         +---------------------------------+
                         |  MySQL Database (Port 3306)     |
                         |  Database: zero_trust_db        |
                         +---------------------------------+
```

| Komponen | Port | Teknologi | Peran (NIST SP 800-207) | Tanggung Jawab Utama |
|---|:---:|---|:---:|---|
| **API Gateway** | `3000` | Node.js + Express + TypeScript | **PEP & PE/PA** | Satu-satunya pintu masuk. Menangani login, menerbitkan/mencabut token, mengevaluasi kebijakan di Policy Engine, mencatat Audit Log, dan mem-proxy request yang diizinkan. |
| **Service Nilai** | `3001` | Node.js + Express + TypeScript | **Resource Service** | Mengelola kelas dan penilaian. Memvalidasi `X-Gateway-Secret` & RS256 JWT. Saat finalisasi, meminta token service ke Gateway lalu menyinkronkan transkrip via Gateway. |
| **Service Transkrip** | `3002` | Node.js + Express + TypeScript | **Resource Service** | Menyediakan data transkrip mahasiswa dan sinkronisasi transkrip idempoten (`ON DUPLICATE KEY UPDATE`). Hanya menerima token service untuk endpoint sinkronisasi. |
| **Frontend ("NILAI")** | `5173` | React 18 + Vite + TypeScript + Tailwind | **Client Interface** | Antarmuka akademik multi-peran dengan penyimpanan token berbasis memori (RAM), zero-secret di sisi klien, dan tombol pengujian cepat. |
| **Database Bersama** | `3306` | MySQL 8.x / MariaDB (Laragon/XAMPP) | **Resource Data** | Basis data bersama `zero_trust_db` (users, devices, courses, classes, enrollments, grades, transcripts, refresh_sessions, service_clients, audit_events). |

---

## 2. Prasyarat Sistem (Prerequisites)

- **Node.js**: Versi `v20.x` atau lebih baru (`v24.x` direkomendasikan).
- **npm**: Versi `10.x` atau lebih baru.
- **Database**: MySQL 8.x / MariaDB lokal aktif pada port `3306` (via **Laragon** atau **XAMPP**).
- **Sistem Operasi**: Windows (PowerShell) / Linux / macOS.
- **cURL**: Tersedia bawaan di Windows 10/11 (`curl.exe`).

---

## 3. Langkah Instalasi & Setup Cepat (Windows PowerShell)

Jalankan perintah berikut secara berurutan di terminal **PowerShell**:

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
Pastikan variabel database pada file `.env` telah sesuai dengan konfigurasi Laragon/XAMPP Anda (default root tanpa password):
```ini
# Service Ports
PORT=3000
GATEWAY_PORT=3000
SERVICE_NILAI_PORT=3001
SERVICE_TRANSKRIP_PORT=3002
FRONTEND_PORT=5173

# Shared Secret (Gateway to Services)
GATEWAY_SECRET=sec_zt_gateway_prod_9f482a17cb6e310d54a28f110cbe77

# Token Security (NIST Requirements)
ACCESS_TOKEN_TTL=10m
REFRESH_TOKEN_TTL=1d
SERVICE_TOKEN_TTL=5m

# Access Window (Asia/Jakarta, 07:00 to 21:00)
ACCESS_WINDOW_START=07:00
ACCESS_WINDOW_END=21:00
ACCESS_TIMEZONE=Asia/Jakarta

# Database Configuration (MySQL - Laragon / XAMPP)
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=zero_trust_db

# Service Client Credentials
SERVICE_CLIENT_ID=grades-service-client
SERVICE_CLIENT_SECRET=grades_client_super_secret_key_8820
```

> **Catatan Database:** Pastikan service MySQL di Laragon/XAMPP sudah dalam kondisi **Start**. Skrip migrasi akan otomatis membuat database `zero_trust_db` jika belum ada.

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

Anda dapat menjalankan seluruh sistem sekaligus dengan satu perintah terpadu atau secara terpisah di terminal yang berbeda:

### Opsi A: Menjalankan Seluruh Sistem Sekaligus (Rekomendasi)
```powershell
npm run dev
```
*Perintah ini akan menyalakan Gateway (3000), Service Nilai (3001), Service Transkrip (3002), dan Frontend (5173).*

### Opsi B: Menjalankan Per Layanan Secara Terpisah
Buka 4 jendela PowerShell terpisah:
- **Terminal 1 (API Gateway - Port 3000)**:
  ```powershell
  npm run dev:gateway
  ```
- **Terminal 2 (Service Nilai - Port 3001)**:
  ```powershell
  npm run dev:nilai
  ```
- **Terminal 3 (Service Transkrip - Port 3002)**:
  ```powershell
  npm run dev:transkrip
  ```
- **Terminal 4 (Frontend UI - Port 5173)**:
  ```powershell
  npm run dev:frontend
  ```

Buka peramban (browser) di: **`http://localhost:5173`**

---

## 5. Daftar Akun Demo, ID Perangkat & Kelas (Deterministic Seed)

Pada halaman login antarmuka web telah disediakan tombol **"Akun Demo Cepat"** untuk pengujian satu-klik. Berikut daftar lengkap seluruh akun yang tersedia di database:

| Peran (Role) | Username | Password Demo | ID Perangkat Terdaftar (`X-Device-ID`) | Identitas & Kelas yang Diampu |
|---|---|---|---|---|
| **Admin 1** | `admin1` | `PasswordAdmin123!` | `dev-admin-chrome-01` | **Administrator Pusat** (NIP: `ADM001`), membaca seluruh transkrip & audit trail |
| **Admin 2** | `admin2` | `PasswordAdmin123!` | `dev-admin-laptop-02` | **Administrator Akademik** (NIP: `ADM002`), membaca seluruh transkrip & audit trail |
| **Dosen 1** | `dosen1` | `PasswordDosen123!` | `dev-dosen1-laptop-01` | Dr. Budi Santoso, M.Kom. • Mengampu **Kelas A** (`IF3101` — Keamanan Informasi) |
| **Dosen 2** | `dosen2` | `PasswordDosen123!` | `dev-dosen2-macbook-02` | Siti Rahmawati, M.T. • Mengampu **Kelas B** (`IF2204` — Basis Data Lanjut) |
| **Dosen 3** | `dosen3` | `PasswordDosen123!` | `dev-dosen3-thinkpad-03` | Ir. Hendra Gunawan, Ph.D. • Mengampu **Kelas C** (`IF3105` — Rekayasa Perangkat Lunak) |
| **Dosen 4** | `dosen4` | `PasswordDosen123!` | `dev-dosen4-desktop-04` | Dian Kusuma, M.Cs. • Mengampu **Kelas D** (`IF2208` — Jaringan Komputer Lanjut) |
| **Mahasiswa 1** | `mahasiswa1` | `PasswordMhs123!` | `dev-mhs1-thinkpad-01` | Ahmad Fauzi (NIM: `2207051001`) • Terdaftar di Kelas A, B, D |
| **Mahasiswa 2** | `mahasiswa2` | `PasswordMhs123!` | `dev-mhs2-laptop-02` | Bella Safitri (NIM: `2207051002`) • Terdaftar di Kelas A, B |
| **Mahasiswa 3** | `mahasiswa3` | `PasswordMhs123!` | `dev-mhs3-desktop-03` | Cahyo Wibowo (NIM: `2207051003`) • Terdaftar di Kelas A, C, D |
| **Mahasiswa 4** | `mahasiswa4` | `PasswordMhs123!` | `dev-mhs4-laptop-04` | Dewi Lestari (NIM: `2207051004`) • Terdaftar di Kelas A, C |
| **Mahasiswa 5** | `mahasiswa5` | `PasswordMhs123!` | `dev-mhs5-phone-05` | Eko Prasetyo (NIM: `2207051005`) • Terdaftar di Kelas B, C, D |
| **Mahasiswa 6** | `mahasiswa6` | `PasswordMhs123!` | `dev-mhs6-mac-06` | Fani Anggraini (NIM: `2207051006`) • Terdaftar di Kelas B, C, D |
| *Simulasi Ilegal* | `mahasiswa1` | `PasswordMhs123!` | `device-asing-ilegal-999` | **DITOLAK (403 Policy Deny)** — Simulasi penolakan perangkat asing |

> **PERINGATAN KEAMANAN:** Seluruh kredensial di atas dibuat khusus untuk lingkungan demonstrasi lokal. Jangan pernah menggunakan password ini di lingkungan produksi publik.

---

## 6. Panduan Pengujian via cURL / PowerShell

Sesuai ketentuan tugas (Bagian 5), seluruh fungsi kontrol akses dapat diuji secara mandiri melalui cURL di terminal PowerShell:

### 1. Uji Login & Ambil Access Token
```powershell
$res = curl.exe -s -X POST http://localhost:3000/auth/login `
  -H "Content-Type: application/json" `
  -H "X-Device-ID: dev-mhs1-thinkpad-01" `
  -d '{\"username\":\"mahasiswa1\",\"password\":\"PasswordMhs123!\"}' | ConvertFrom-Json

$mhsToken = $res.data.accessToken
Write-Host "Token Mahasiswa 1 Berhasil Diperoleh"
```

### 2. Uji Penolakan Perangkat Asing (Device Binding)
```powershell
curl.exe -i -X POST http://localhost:3000/auth/login `
  -H "Content-Type: application/json" `
  -H "X-Device-ID: device-asing-ilegal-999" `
  -d '{\"username\":\"mahasiswa1\",\"password\":\"PasswordMhs123!\"}'
```
*Hasil yang diharapkan:* `HTTP/1.1 403 Forbidden` (`DEVICE_NOT_REGISTERED`).

### 3. Uji Pertahanan Assume Breach (Bypass Port 3001 Tanpa Gateway Secret)
```powershell
curl.exe -i http://localhost:3001/nilai
```
*Hasil yang diharapkan:* `HTTP/1.1 403 Forbidden` (`FORBIDDEN_GATEWAY_SECRET_REQUIRED`).

### 4. Uji Pencegahan IDOR Transkrip Mahasiswa
Gunakan token Mahasiswa 1 (`2207051001`) untuk mencoba mengintip transkrip Mahasiswa 2 (`2207051002`):
```powershell
curl.exe -i http://localhost:3000/transkrip/2207051002 `
  -H "Authorization: Bearer $mhsToken" `
  -H "X-Device-ID: dev-mhs1-thinkpad-01"
```
*Hasil yang diharapkan:* `HTTP/1.1 403 Forbidden` (`IDOR_ATTEMPT_DENIED`).

### 5. Uji Pengambilan Token Service & Isolasi Sinkronisasi
```powershell
# 1. Service Nilai meminta Service Token (5m, role: service)
$svcRes = curl.exe -s -X POST http://localhost:3000/auth/service `
  -H "Content-Type: application/json" `
  -d '{\"clientId\":\"grades-service-client\",\"clientSecret\":\"grades_client_super_secret_key_8820\"}' | ConvertFrom-Json
$svcToken = $svcRes.data.serviceToken

# 2. Coba panggil /transkrip/sinkron dengan token user biasa (DITOLAK)
curl.exe -i -X POST http://localhost:3000/transkrip/sinkron `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $mhsToken" `
  -d '{\"classId\":\"test\",\"courseId\":\"test\",\"entries\":[]}'
# -> Ditolak: 403 Forbidden (SERVICE_TOKEN_REQUIRED)
```

---

## 7. Cara Menjalankan Pengujian Otomatis

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

## 8. Pemetaan Lokasi Kode Implementasi (Rubrik Bagian 4)

Bagi penguji yang ingin memeriksa implementasi teknis pada kode sumber:

| Kebutuhan Spesifikasi | File Implementasi Utama | Baris Kode |
|---|---|:---:|
| **Access Token RS256 (10m)** | [`packages/shared/src/crypto.ts`](file:///c:/CODING/zero_trust_security/packages/shared/src/crypto.ts) | `L23-L38` |
| **Refresh Token DB & Revokasi Logout** | [`packages/gateway/src/controllers/authController.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/controllers/authController.ts) | `L152-L162`, `L359-L392` |
| **Token Service (5m, role service)** | [`packages/gateway/src/controllers/authController.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/controllers/authController.ts) | `L394-L484` |
| **Gateway Secret Injection** | [`packages/gateway/src/proxy/serviceProxy.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/proxy/serviceProxy.ts) | `L9-L16` |
| **Sanitasi Header Klien Luar** | [`packages/gateway/src/middleware/sanitizeHeaders.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/middleware/sanitizeHeaders.ts) | `L3-L9` |
| **Verifikasi Ulang Independen di Service** | [`packages/service-nilai/src/middleware/verifyInternalAccess.ts`](file:///c:/CODING/zero_trust_security/packages/service-nilai/src/middleware/verifyInternalAccess.ts) | `L14-L50` |
| **Policy Engine Terpusat (Tabel 3)** | [`packages/gateway/src/policy/policyEngine.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/policy/policyEngine.ts) | `L71-L420` |
| **Verifikasi Device Binding (`X-Device-ID`)** | [`packages/gateway/src/policy/policyEngine.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/policy/policyEngine.ts) | `L85-L114` |
| **Jendela Waktu Jam Akses (07.00 - 21.00)** | [`packages/gateway/src/policy/timeEvaluator.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/policy/timeEvaluator.ts) | `L11-L45` |
| **Pencegahan IDOR Transkrip** | [`packages/gateway/src/policy/policyEngine.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/policy/policyEngine.ts) | `L183-L220` |
| **Finalisasi Kelas & Panggilan Service Sinkron** | [`packages/service-nilai/src/routes/nilaiRoutes.ts`](file:///c:/CODING/zero_trust_security/packages/service-nilai/src/routes/nilaiRoutes.ts) | `L277-L302` |
| **Sinkronisasi Idempoten Transkrip** | [`packages/service-transkrip/src/routes/transkripRoutes.ts`](file:///c:/CODING/zero_trust_security/packages/service-transkrip/src/routes/transkripRoutes.ts) | `L151-L162` |
| **Audit Logger (MySQL & File)** | [`packages/gateway/src/audit/auditLogger.ts`](file:///c:/CODING/zero_trust_security/packages/gateway/src/audit/auditLogger.ts) | `L24-L74` |

---

## 9. Dokumentasi Lengkap Proyek

Informasi mendalam dan analisis teknis tersedia pada folder `docs/`:
- **[docs/architecture.md](file:///c:/CODING/zero_trust_security/docs/architecture.md)**: Diagram arsitektur NIST SP 800-207, pembagian zona keamanan, dan sequence diagram alur request.
- **[docs/security-model.md](file:///c:/CODING/zero_trust_security/docs/security-model.md)**: Model ancaman, matriks kontrol keamanan, siklus token RS256, dan analisis batasan sistem.
- **[docs/api.md](file:///c:/CODING/zero_trust_security/docs/api.md)**: Kontrak API lengkap (request/response format, status HTTP, error codes).
- **[docs/testing-report.md](file:///c:/CODING/zero_trust_security/docs/testing-report.md)**: Laporan detail pengujian, matriks matched requirements, dan bukti eksekusi.
- **[docs/skills-used.md](file:///c:/CODING/zero_trust_security/docs/skills-used.md)**: Audit trail pemakaian skill, verifikasi path `SKILL.md`, dan keputusan teknis yang dipengaruhi.
- **[docs/demo-script.md](file:///c:/CODING/zero_trust_security/docs/demo-script.md)**: Rencana dan naskah video demo 6–9 menit beserta panduan lokasi file kode.

---

## 10. Panduan Penanganan Masalah (Common Errors & Troubleshooting)

| Gejala Masalah | Penyebab Umum | Solusi |
|---|---|---|
| `EADDRINUSE: address already in use :::3000` (atau 3001/3002/5173) | Ada proses node yang masih menggantung dari eksekusi sebelumnya. | Hentikan proses via PowerShell: `Get-Process node \| Stop-Process -Force` |
| `Access denied for user 'root'@'localhost'` (atau koneksi DB gagal) | Kredensial MySQL pada file `.env` belum sesuai dengan konfigurasi Laragon/XAMPP lokal Anda. | Periksa variabel `DB_USER` dan `DB_PASSWORD` pada file `.env`, serta pastikan service MySQL aktif di port 3306. |
| `RSA Private key not found` | Belum menjalankan pembuatan kunci enkripsi asimetris. | Jalankan `npm run keys:gen`. |
| `CLASS_FINALIZED` saat update nilai | Nilai kelas telah difinalisasi dosen dan terkunci (read-only). | Status kelas bersifat permanen sesuai prinsip Zero Trust. Untuk menguji ulang dari awal, jalankan `npm run db:reset`. |
| `OUTSIDE_ACCESS_WINDOW` | Request perubahan nilai dilakukan di luar pukul 07:00 – 21:00 WIB. | Sesuaikan jam server atau ubah `ACCESS_WINDOW_START` / `ACCESS_WINDOW_END` pada `.env`, atau kirim header `X-Mock-Time` saat pengujian. |
