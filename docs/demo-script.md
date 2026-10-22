# Panduan & Naskah Demo Video (6 – 9 Menit)
## Sistem Nilai Akademik Berbasis Zero Trust Security (NIST SP 800-207)
**Mata Kuliah:** Keamanan Informasi (KP70065004) — Informatika Universitas Siliwangi

---

## 1. Rencana Waktu Video (Timeline Overview)

| Menit | Segmen | Fokus Demonstrasi | File Kode yang Ditunjukkan |
|---|---|---|---|
| **00:00 – 01:00** | **Pendahuluan & Arsitektur** | Menjelaskan arsitektur Zero Trust NIST SP 800-207, 3 proses terpisah (Gateway 3000, Nilai 3001, Transkrip 3002), dan basis data PostgreSQL. | `docs/architecture.md`, diagram flowchart |
| **01:00 – 02:30** | **Mekanisme Autentikasi, RS256 JWT & Device Binding** | Demo login Mahasiswa & Dosen, verifikasi header `X-Device-ID`, pemeriksaan token RS256 asimetris, dan simulasi penolakan device asing. | `packages/gateway/src/controllers/authController.ts`<br/>`packages/gateway/src/policy/policyEngine.ts` |
| **02:30 – 04:00** | **Pertahanan Antar-Service & Gateway Secret** | Menunjukkan proteksi Service Nilai & Transkrip dari direct access (curl port 3001 tanpa Gateway Secret), serta penghapusan header rahasia yang dikirim klien luar. | `packages/service-nilai/src/middleware/verifyInternalAccess.ts`<br/>`packages/gateway/src/middleware/sanitizeHeaders.ts` |
| **04:00 – 05:30** | **Alur Dosen: Input Nilai, Time Window & Finalisasi** | Dosen mengubah nilai mahasiswa di kelasnya, menjelaskan proteksi jam akses (07.00–21.00 WIB), konfirmasi modal finalisasi, dan penguncian gradebook menjadi read-only. | `packages/service-nilai/src/routes/nilaiRoutes.ts`<br/>`packages/gateway/src/policy/timeEvaluator.ts` |
| **05:30 – 07:00** | **Komunikasi Service Token & Sinkronisasi Idempoten** | Menjelaskan bagaimana Service Nilai meminta Service JWT ke Gateway (`POST /auth/service`), memanggil `POST /transkrip/sinkron`, dan Service Transkrip melakukan upsert idempoten. | `packages/service-nilai/src/routes/nilaiRoutes.ts:270`<br/>`packages/service-transkrip/src/routes/transkripRoutes.ts:75` |
| **07:00 – 08:00** | **Pencegahan IDOR & Transkrip Mahasiswa/Admin** | Mahasiswa melihat transkripnya sendiri dan simulasi penolakan 403 saat mencoba melihat transkrip NIM lain. Admin melihat transkrip mahasiswa manapun. | `packages/gateway/src/policy/policyEngine.ts:160` |
| **08:00 – 09:00** | **Audit Trail Logging & Bukti Pengujian Otomatis** | Menampilkan log real-time di antarmuka Admin (keputusan ALLOW/DENY beserta reason_code), redaction data sensitif, dan menjalankan `npm test`. | `packages/gateway/src/audit/auditLogger.ts`<br/>Terminal: `npm test` |

---

## 2. Naskah Presentasi Langkah-demi-Langkah (Detailed Script)

### Segmen 1: Pembukaan & Arsitektur (00:00 - 01:00)
- **Narasi:**
  > "Halo semuanya. Pada video ini saya mendemonstrasikan implementasi sistem nilai akademik berbasis Zero Trust Architecture sesuai standar NIST SP 800-207.
  > Sistem ini dibangun dengan prinsip *Never Trust, Always Verify*, *Least Privilege*, dan *Assume Breach*.
  > Sistem berjalan pada 3 proses server yang benar-benar terpisah:
  > 1. API Gateway pada port 3000 sebagai Policy Enforcement Point (PEP) dan memuat Policy Engine.
  > 2. Service Nilai pada port 3001 untuk mengelola kelas dan nilai.
  > 3. Service Transkrip pada port 3002 untuk transkrip resmi dan sinkronisasi idempoten.
  > 4. PostgreSQL lokal sebagai basis data persisten bersama."
- **Aksi Layar:** Tampilkan diagram dari [docs/architecture.md](file:///c:/CODING/zero_trust_security/docs/architecture.md) dan tunjukkan 3 server yang sedang berjalan di terminal.

### Segmen 2: Autentikasi, JWT RS256 & Device Binding (01:00 - 02:30)
- **Narasi:**
  > "Setiap permintaan dari pengguna ke Gateway wajib menyertakan token akses JWT dan header konteks `X-Device-ID`.
  > JWT ditandatangani menggunakan algoritma asimetris RS256 dengan private key yang disimpan aman hanya di Gateway.
  > Sekarang kita uji login sebagai Mahasiswa 1 (`mahasiswa1`) dengan perangkat terdaftar `dev-mhs1-thinkpad-01`. Login berhasil.
  > Sekarang mari kita demonstrasikan penolakan perangkat tidak dikenal menggunakan tombol uji device asing (`device-asing-ilegal-999`). Gateway segera menolak dengan status 403 DEVICE_NOT_REGISTERED."
- **Aksi Layar:**
  1. Klik tombol demo `Mahasiswa 1 (Ahmad Fauzi)`. Login sukses, masuk ke dashboard.
  2. Logout, lalu klik tombol merah `Uji Device Asing`. Tunjukkan banner merah *Policy Deny*.
  3. Buka kode `packages/gateway/src/policy/policyEngine.ts` baris 75–95 (validasi device).

### Segmen 3: Gateway Secret & Isolasi Port Service (02:30 - 04:00)
- **Narasi:**
  > "Berdasarkan prinsip *Assume Breach*, Service internal Nilai dan Transkrip tidak boleh mempercayai panggilan langsung. Keduanya memvalidasi header rahasia `X-Gateway-Secret`.
  > Bila seorang penyerang mencoba memanggil Service Nilai secara langsung di port 3001 tanpa melalui Gateway, service menolak dengan 403 FORBIDDEN_GATEWAY_SECRET_REQUIRED.
  > Selain itu, jika klien mencoba menyuntikkan header rahasia ke Gateway, middleware Gateway secara paksa menghapusnya."
- **Aksi Layar:**
  1. Buka PowerShell / Postman. Jalankan `curl -i http://localhost:3001/nilai` → Tunjukkan respon HTTP 403.
  2. Tunjukkan kode `packages/service-nilai/src/middleware/verifyInternalAccess.ts`.
  3. Tunjukkan kode `packages/gateway/src/middleware/sanitizeHeaders.ts`.

### Segmen 4: Pengelolaan Nilai Dosen & Jam Akses (04:00 - 05:30)
- **Narasi:**
  > "Sekarang kita login sebagai Dosen 1 (`dosen1`). Dosen hanya dapat melihat dan menilai kelas yang diampunya, yaitu Kelas A Keamanan Informasi.
  > Kebijakan Jam Akses membatasi perubahan nilai hanya antara pukul 07.00 hingga 21.00 WIB.
  > Sekarang kita ubah nilai Ahmad Fauzi menjadi 95.00 dan simpan.
  > Selanjutnya, dosen melakukan finalisasi kelas. Ketika tombol finalisasi diklik, muncul modal konfirmasi yang menjelaskan bahwa nilai akan dikunci permanen."
- **Aksi Layar:**
  1. Login sebagai `dosen1`.
  2. Ubah skor Ahmad Fauzi menjadi 95.00, klik *Simpan*.
  3. Klik *Finalisasi Nilai Kelas*. Tunjukkan modal konfirmasi. Klik *Ya, Kunci & Finalisasi*.
  4. Status kelas berubah menjadi *FINAL*, dan kolom skor terkunci menjadi *read-only*.
  5. Tunjukkan kode transaksi locking di `packages/service-nilai/src/routes/nilaiRoutes.ts`.

### Segmen 5: Service Token & Sinkronisasi Idempoten (05:30 - 07:00)
- **Narasi:**
  > "Saat finalisasi berhasil, Service Nilai tidak memanggil Service Transkrip secara langsung.
  > Service Nilai terlebih dahulu meminta Service Token ke Gateway via endpoint `POST /auth/service` menggunakan client ID dan secret internal.
  > Token service ini berlaku 5 menit dengan role khusus `service`.
  > Lalu Service Nilai memanggil `POST /transkrip/sinkron` melalui API Gateway.
  > Service Transkrip menerima payload dan melakukan operasi UPSERT idempoten menggunakan `ON CONFLICT (student_id, class_id) DO UPDATE` sehingga tidak akan terjadi duplikasi transkrip."
- **Aksi Layar:**
  1. Tunjukkan kode `packages/service-nilai/src/routes/nilaiRoutes.ts` baris 270–295.
  2. Tunjukkan kode `packages/service-transkrip/src/routes/transkripRoutes.ts` baris 75–120.

### Segmen 6: Verifikasi Transkrip & Pencegahan IDOR (07:00 - 08:00)
- **Narasi:**
  > "Sekarang kita login kembali sebagai Mahasiswa 1 (`mahasiswa1`).
  > Buka tab Transkrip Akademik. Terlihat mata kuliah Keamanan Informasi telah masuk ke transkrip dengan nilai 95 (Huruf A) dan IPK terhitung 4.00.
  > Di sisi keamanan, mahasiswa dilarang melihat transkrip mahasiswa lain. Jika dicoba melalui URL atau API, Gateway menolak dengan 403 IDOR_ATTEMPT_DENIED.
  > Sekarang kita beralih login sebagai Administrator (`admin1`). Admin memiliki otorisasi Least Privilege untuk melihat transkrip mahasiswa manapun namun tidak dapat mengedit nilai."
- **Aksi Layar:**
  1. Login sebagai `mahasiswa1`, buka Transkrip. Tunjukkan IPK 4.00 dan skor 95.
  2. Login sebagai `admin1`, pilih mahasiswa Ahmad Fauzi, lalu Bella Safitri. Transkrip tampil rapi.

### Segmen 7: Audit Trail & Bukti Pengujian Komprehensif (08:00 - 09:00)
- **Narasi:**
  > "Sebagai penutup, kita tinjau tab Audit Trail Log PEP pada akun Admin.
  > Seluruh keputusan evaluasi akses tercatat secara terstruktur: waktu, subjek, endpoint, device ID, keputusan ALLOW atau DENY, dan reason code spesifik.
  > Seluruh pengujian otomatis telah disiapkan dan lulus 100%: 41 unit/integration/security test pada Vitest dan 12 end-to-end browser test pada Playwright.
  > Terima kasih atas perhatiannya."
- **Aksi Layar:**
  1. Tunjukkan tabel Audit Trail di dashboard Admin.
  2. Buka terminal dan jalankan `npm test`. Tunjukkan output 41 tests passed.
  3. Tunjukkan laporan Playwright di `docs/testing-report.md`.
