# Security Model & Threat Specification

## 1. Zero Trust Principles & Trust Boundaries

Sistem Nilai Akademik "NILAI" mengimplementasikan arsitektur keamanan dengan premis bahwa **lingkungan jaringan tidak pernah dianggap aman (untrusted network)**, baik jaringan publik maupun internal antar-service.

### Batas Kepercayaan (Trust Boundaries)
1. **Client / Browser (Boundary 0 - Untrusted)**:
   - Kode dieksekusi di sisi pengguna (browser). Tidak pernah dipercaya untuk otorisasi atau penegakan aturan bisnis.
   - Tidak ada token rahasia, service secret, atau private key yang disimpan atau dikirim ke browser.
   - Access token disimpan di memory aplikasi React (hilang saat tab ditutup/reload jika tidak di-refresh).
   - Refresh token disimpan di cookie `HttpOnly`, `SameSite=Strict`, `Path=/auth`, `Secure` (saat HTTPS/produksi).

2. **API Gateway Boundary (Boundary 1 - PEP / Policy Enforcement Point)**:
   - Titik demarkasi pertama antara dunia luar dan sistem internal.
   - Mengisolasi Service Nilai dan Service Transkrip.
   - Memegang **RSA Private Key** untuk penandatanganan JWT (RS256).
   - Menghapus header `X-Gateway-Secret` yang berasal dari inbound client dan menyuntikkan header rahasia server-side.
   - Menegakkan verifikasi identitas perangkat (`X-Device-ID`), time-window akses, dan kepemilikan data (NIM/Kelas).

3. **Internal Microservices Boundary (Boundary 2 - Defense-in-Depth / Assume Breach)**:
   - Service Nilai (port 3001) dan Service Transkrip (port 3002).
   - Keduanya **menolak** request tanpa header `X-Gateway-Secret` yang cocok.
   - Keduanya **menolak** request tanpa JWT valid bertanda tangan RSA Public Key Gateway, meskipun header `X-Gateway-Secret` valid.
   - Komunikasi antar-service (sinkronisasi nilai ke transkrip) **wajib melalui API Gateway** menggunakan service token dengan audience dan scope spesifik.

4. **Database Boundary (Boundary 3 - Persistensi Terisolasi)**:
   - MySQL 8.x lokal Laragon/XAMPP (`zero_trust_db`).
   - Seluruh query menggunakan parameterized SQL untuk mencegah SQL Injection.
   - Password pengguna di-hash menggunakan **Bcrypt** (cost factor 10) atau Argon2id; tidak pernah disimpan plaintext.
   - Refresh token di-hash menggunakan **SHA-256** sebelum disimpan di tabel `refresh_sessions`.

---

## 2. Matriks Kebijakan Akses (Policy Matrix)

| Subjek / Role | Resource & Aksi | Atribut Konteks yang Divalidasi | Hasil Evaluasi | Alasan Penolakan (Reason Code) |
|---|---|---|---|---|
| **Mahasiswa** | `GET /nilai` | `user.role == 'mahasiswa'`, `device.is_active == true` | ALLOW (Filter nilai milik NIM sendiri) | `INVALID_DEVICE`, `TOKEN_EXPIRED` |
| **Mahasiswa** | `PUT /nilai/:id` | `user.role == 'mahasiswa'` | DENY (403) | `ROLE_NOT_PERMITTED` |
| **Mahasiswa** | `GET /transkrip/:nim` | `path.nim == user.nim` | ALLOW (Hanya transkrip sendiri) | `IDOR_ATTEMPT_DENIED` |
| **Mahasiswa** | `GET /transkrip/:nim_lain` | `path.nim != user.nim` | DENY (403) | `IDOR_ATTEMPT_DENIED` |
| **Dosen** | `GET /nilai` | `user.role == 'dosen'` | ALLOW (Hanya kelas yang diampu) | `INVALID_DEVICE` |
| **Dosen** | `PUT /nilai/:id` | `class.lecturer_id == user.id`, `class.is_finalized == false`, `currentTime in 07:00..21:00 WIB` | ALLOW | `NOT_CLASS_LECTURER`, `CLASS_FINALIZED`, `OUTSIDE_ACCESS_WINDOW` |
| **Dosen** | `POST /kelas/:id/finalisasi` | `class.lecturer_id == user.id`, `class.is_finalized == false`, `currentTime in 07:00..21:00 WIB` | ALLOW (Kunci kelas & pemicu sync) | `NOT_CLASS_LECTURER`, `ALREADY_FINALIZED`, `OUTSIDE_ACCESS_WINDOW` |
| **Admin** | `GET /transkrip/:nim` | `user.role == 'admin'` | ALLOW (Bisa melihat transkrip siapa pun) | `INVALID_DEVICE` |
| **Admin** | `PUT /nilai/:id` | `user.role == 'admin'` | DENY (403: Admin dilarang memanipulasi nilai kelas dosen) | `ROLE_NOT_PERMITTED` |
| **Service (Nilai)** | `POST /transkrip/sinkron` | `jwt.role == 'service'`, `jwt.token_use == 'service'`, `jwt.sub == 'grades-service'` | ALLOW (Upsert transkrip) | `INVALID_SERVICE_TOKEN`, `FORBIDDEN_CALLER` |
| **User Biasa** | `POST /transkrip/sinkron` | `jwt.role in ['mahasiswa', 'dosen', 'admin']` | DENY (403) | `SERVICE_TOKEN_REQUIRED` |

---

## 3. Threat Model & Mitigasi Keamanan (Threat-to-Control Mapping)

| Skenario Serangan / Bypass | Vektor Ancaman | Kontrol Mitigasi Teknis | Lokasi Penegakan Kode | Automated Security Test |
|---|---|---|---|---|
| **1. Token Hilang / Kedaluwarsa / Palsu** | Penyerang mengirim token tanpa signature, signature salah, atau expired | Validasi strict RSA RS256 signature, exp, issuer, audience, token_use | Gateway (`src/middleware/auth.ts`) & Service (`src/middleware/serviceAuth.ts`) | `tests/security/auth-token.test.ts` |
| **2. IDOR Transkrip / Nilai** | Mahasiswa A mengubah path parameter NIM ke NIM Mahasiswa B | Pemeriksaan kepemilikan subjek (`token.nim === req.params.nim`) | Gateway (`src/policy/policyEngine.ts`) & Repository query | `tests/security/idor.test.ts` |
| **3. Eskalasi Hak Akses (Role Escalation)** | Mahasiswa mengirim payload JSON `{ "role": "admin" }` pada request | Role hanya diambil dari klaim terverifikasi di JWT; abaikan seluruh field body/query | Gateway (`src/policy/policyEngine.ts`) | `tests/security/privilege-escalation.test.ts` |
| **4. Pemalsuan Device (Spoofing X-Device-ID)** | Penyerang menggunakan credential curian dari device yang tidak terdaftar | Gateway memverifikasi kecocokan `X-Device-ID` di tabel `devices` milik `user_id` yang sedang aktif | Gateway (`src/middleware/deviceAuth.ts`) | `tests/security/device-verification.test.ts` |
| **5. Akses Langsung ke Service (Direct Port Bypass)** | Penyerang menghubungi port 3001/3002 secara langsung tanpa melewati Gateway | Service menolak bila header `X-Gateway-Secret` tidak ada atau tidak cocok | Service Nilai & Transkrip (`src/middleware/requireGatewaySecret.ts`) | `tests/security/gateway-bypass.test.ts` |
| **6. Injeksi Header Secret oleh Klien** | Klien mengirimkan header `X-Gateway-Secret` tebakan ke Gateway | Gateway secara paksa menghapus/meng-overwrite `X-Gateway-Secret` inbound | Gateway (`src/middleware/sanitizeHeaders.ts`) | `tests/security/secret-injection.test.ts` |
| **7. Pemanggilan Endpoint Sync oleh Pengguna Biasa** | Pengguna mengirim Bearer Token user ke endpoint `POST /transkrip/sinkron` | Gateway & Service Transkrip memeriksa `token_use === 'service'` & `role === 'service'` | Policy Engine & Service Transkrip | `tests/security/service-isolation.test.ts` |
| **8. Serangan SQL Injection** | Penyerang mengirim query string berbahaya seperti `' OR '1'='1` | Seluruh interaksi database menggunakan Parameterized Queries via driver `pg` | Database Repositories | `tests/security/sqli.test.ts` |
| **9. Replay Refresh Token / Logout Bypass** | Penyerang menggunakan kembali refresh token lama yang sudah di-rotate atau di-logout | Hash SHA-256 disimpan di DB; sistem menandai `revoked_at` saat rotasi/logout; deteksi reuse membatalkan seluruh famili token | Gateway Auth Controller (`src/controllers/authController.ts`) | `tests/security/refresh-replay.test.ts` |
| **10. Kebocoran Kredensial di Audit Log** | Logging Gateway membocorkan password, JWT, atau secret ke tabel audit log | Redaksi eksplisit dan sanitasi terpusat; hanya data non-sensitif (user_id, endpoint, decision, reason_code) yang disimpan | Gateway (`src/audit/auditLogger.ts`) | `tests/security/audit-leak.test.ts` |
| **11. Manipulasi Waktu (Time-Window Tampering)** | Dosen memanipulasi jam lokal PC klien di luar pukul 07.00 - 21.00 WIB | Evaluasi jam menggunakan jam internal server dengan timezone `Asia/Jakarta` | Policy Engine (`src/policy/timeEvaluator.ts`) | `tests/security/time-window.test.ts` |

---

## 4. Siklus Hidup Token (Token Lifecycle)

```
[User Login] ──> Validasi Password + Device
                 │
                 ├──> Diterbitkan Access Token (RS256, TTL 10 Menit)
                 │    Claims: sub, role, nim/nip, iss, aud, jti, token_use=access
                 │
                 └──> Diterbitkan Refresh Token (Opaque 64-char Hex, TTL 1 Hari)
                      Tersimpan SHA-256 hash di database MySQL (tabel refresh_sessions)
                      Dikirim via Set-Cookie (HttpOnly, SameSite=Strict)

[Request API] ──> Header: "Authorization: Bearer <access_token>" + "X-Device-ID"
                  Gateway memverifikasi RSA RS256 signature & waktu kedaluwarsa.
                  Jika expired (HTTP 401 TOKEN_EXPIRED) ──>

[Rotasi Token] ─> Client mengirim POST /auth/refresh
                  Gateway memvalidasi hash refresh token di database MySQL.
                  Token lama ditandai REVOKED (rotasi otomatis).
                  Diterbitkan pasang token baru: Access Token baru (10m) + Refresh Token baru (1d).

[Logout] ───────> Client mengirim POST /auth/logout
                  Gateway mencabut seluruh sesi token yang bersangkutan di database MySQL.
                  Cookie dibersihkan.
```

---

## 5. Batasan yang Diketahui (Known Limitations)

1. **Device ID Header (`X-Device-ID`)**:
   - Penggunaan header HTTP merupakan *software-level device binding* sesuai instruksi tugas praktikum.
   - Ini bukan *Hardware Attestation* kriptografis (seperti TPM, FIDO2/WebAuthn, atau Secure Enclave). Jika penyerang berhasil mencuri `device_id` yang valid dan kredensial pengguna, mereka dapat mengirim header ini melalui curl.
2. **Database Bersama (Shared Database)**:
   - Sesuai spesifikasi tugas, Service Nilai dan Service Transkrip berbagi satu instance database MySQL `zero_trust_db`. Dalam skenario enterprise riil, kedua service idealnya memiliki database terisolasi penuh dengan koneksi terpisah.
