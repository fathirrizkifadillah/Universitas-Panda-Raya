# Architecture Design: Zero Trust Academic Records ("NILAI")

## 1. Ikhtisar Arsitektur NIST SP 800-207

Arsitektur aplikasi dibangun berdasarkan panduan formal **NIST SP 800-207 (Zero Trust Architecture)**. Sistem memisahkan secara tegas antara **Control Plane** (Policy Enforcement Point & Policy Decision Point) dan **Data Plane** (Resource Services).

```mermaid
flowchart TD
    subgraph UntrustedZone ["Untrusted Client Zone"]
        ClientBrowser["Web Browser (React / Vite)\nlocalhost:5173"]
        ClientCLI["HTTP Client / Attacker / Postman"]
    end

    subgraph ControlPlane ["Control Plane & Gateway (Port 3000)"]
        PEP["API Gateway (PEP)\n- Header Stripping & Normalization\n- Rate Limiting & Helmet\n- Audit Logger"]
        PDP["Policy Engine (PDP)\n- Asymmetric JWT Validator\n- Device Context Verifier (X-Device-ID)\n- Time Window Evaluator (07:00-21:00 WIB)\n- Data Ownership & State Validator"]
        AuthAdmin["Policy Administrator (PA)\n- Login & RS256 JWT Issuer\n- Refresh Token Hash & Revocation\n- Service Token Issuer"]
    end

    subgraph DataPlane ["Data Plane / Resource Services"]
        direction TB
        ServiceNilai["Service Nilai (Port 3001)\n- Verify X-Gateway-Secret\n- Verify Asymmetric JWT\n- Gradebook & Finalization\n- Triggers Sync via Service Token"]
        ServiceTranskrip["Service Transkrip (Port 3002)\n- Verify X-Gateway-Secret\n- Verify Service/Admin Token\n- Idempotent Transcript Upsert"]
    end

    subgraph Persistence ["Shared Database Layer (Port 5432)"]
        PostgresDB[("PostgreSQL 17 (zero_trust_db)\n- users & devices\n- courses, classes, enrollments, grades\n- transcript_entries\n- refresh_sessions & service_clients\n- audit_events & outbox_events")]
    end

    ClientBrowser -->|"HTTP API (Bearer Token + X-Device-ID)"| PEP
    ClientCLI -->|"Direct Access Attempt (Blocked)"| PEP
    PEP <-->|"Decision Request"| PDP
    PDP <-->|"Read Attributes (User/Class/Device)"| PostgresDB
    AuthAdmin <-->|"Session Management"| PostgresDB
    PEP -->|"Audit Logs (Allow/Deny)"| PostgresDB
    
    PEP -->|"Proxy: ALLOW + Injected X-Gateway-Secret"| ServiceNilai
    PEP -->|"Proxy: ALLOW + Injected X-Gateway-Secret"| ServiceTranskrip
    
    ServiceNilai -->|"Sync Transkrip via Gateway (Service Token)"| PEP
    ServiceNilai <-->|"Class & Grade Transactions"| PostgresDB
    ServiceTranskrip <-->|"Transcript Transactions"| PostgresDB
    
    ClientCLI -.->|"Direct Port Attempt (Blocked: 403 No Secret)"| ServiceNilai
    ClientCLI -.->|"Direct Port Attempt (Blocked: 403 No Secret)"| ServiceTranskrip
```

---

## 2. Komponen & Alokasi Port

### 1. API Gateway / PEP (Port 3000)
- **Peran NIST SP 800-207**: *Policy Enforcement Point (PEP)* dan memuat *Policy Decision Point (PDP)* & *Policy Administrator (PA)*.
- **Tanggung Jawab**:
  - Satu-satunya titik masuk publik bagi antarmuka pengguna (Frontend/Client).
  - Autentikasi pengguna (`/auth/login`, `/auth/refresh`, `/auth/logout`) dan penerbitan service token (`/auth/service`).
  - Pembuatan access token JWT ditandatangani menggunakan algoritma asimetris **RS256** (Private Key RSA 2048-bit).
  - Sanitasi request masuk: secara paksa menghapus header `X-Gateway-Secret` yang dikirim oleh client untuk mencegah peniruan identitas internal gateway.
  - Memeriksa header wajib `X-Device-ID` dan memvalidasi kepemilikan perangkat di tabel `devices`.
  - Mengevaluasi kebijakan otorisasi kontekstual: peran (Role), kepemilikan data (NIM/Kelas), status final kelas, dan jam akses operasional (07:00–21:00 Asia/Jakarta).
  - Pencatatan seluruh keputusan evaluasi (*allow* maupun *deny*) ke tabel `audit_events`.
  - Jika keputusan adalah `ALLOW`, menyuntikkan header rahasia `X-Gateway-Secret` dari environment server, lalu meneruskan request ke target service internal (`http-proxy-middleware`).

### 2. Service Nilai (Port 3001)
- **Peran NIST SP 800-207**: *Resource Service*.
- **Tanggung Jawab**:
  - Menyediakan endpoint baca (`GET /nilai`) dan ubah nilai (`PUT /nilai/:id`).
  - Menyediakan endpoint finalisasi kelas (`POST /kelas/:id/finalisasi`).
  - **Pertahanan Mandiri**: Setiap request yang masuk diperiksa:
    1. Keberadaan dan validitas `X-Gateway-Secret` via *timing-safe comparison*.
    2. Validitas kriptografis JWT menggunakan **Public Key** RSA (menolak request langsung walau secret diketahui jika tanpa token valid).
  - Melakukan finalisasi dalam transaksi atomik PostgreSQL: mengunci baris kelas, mengubah status menjadi final, mencatat log outbox/sinkronisasi.
  - Memperoleh service token dari Gateway melalui `POST /auth/service` menggunakan client credentials internal, lalu memanggil `POST /transkrip/sinkron` **melalui Gateway (port 3000)**, bukan direct URL port 3002.

### 3. Service Transkrip (Port 3002)
- **Peran NIST SP 800-207**: *Resource Service*.
- **Tanggung Jawab**:
  - Menyediakan endpoint transkrip akademik (`GET /transkrip/:nim`).
  - Menyediakan endpoint sinkronisasi transkrip (`POST /transkrip/sinkron`).
  - **Pertahanan Mandiri**: Memverifikasi `X-Gateway-Secret` dan Public Key JWT.
  - Endpoint `/transkrip/sinkron` **hanya** menerima token dengan `role=service` dan `sub=grades-service`. Permintaan yang membawa token pengguna umum (mahasiswa, dosen, bahkan admin) ditolak 403.
  - Implementasi operasi idempoten: request sinkronisasi berulang untuk kelas/mahasiswa yang sama memperbarui data transkrip tanpa membuat duplikasi entri (`ON CONFLICT (student_id, class_id) DO UPDATE`).

### 4. Database Layer (PostgreSQL 17 Lokal, Port 5432)
- Database bersama `zero_trust_db` menyimpan data pengguna, perangkat, perkuliahan, nilai, transkrip, sesi refresh token (hash), kredensial service client, dan log audit.
- Akses dilakukan dengan parameterized SQL untuk pencegahan total terhadap serangan SQL Injection.

### 5. Frontend Client ("NILAI", Port 5173)
- Single Page Application (SPA) berbasis React 19 + TypeScript + Vite.
- Tidak menyimpan token di `localStorage` (mencegah pencurian XSS). Access token disimpan dalam memory runtime; refresh token dikelola via cookie HttpOnly dengan proteksi CSRF.

---

## 3. Diagram Alur Permintaan (Sequence Diagrams)

### Alur 1: Autentikasi Pengguna & Penerbitan Token

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (Browser)
    participant GW as API Gateway (Port 3000)
    participant DB as PostgreSQL (zero_trust_db)

    User->>GW: POST /auth/login<br/>{username, password} + Header X-Device-ID
    GW->>DB: Query user by username & query device by X-Device-ID
    DB-->>GW: User record (password_hash) & Device record
    GW->>GW: Verify password (Bcrypt/Argon2id)<br/>Verify device ownership & active status
    alt Kredensial atau Device Tidak Valid
        GW->>DB: Write Audit Event (DENY: INVALID_CREDENTIALS / UNKNOWN_DEVICE)
        GW-->>User: 401 Unauthorized / 403 Forbidden
    else Valid
        GW->>GW: Generate RS256 Access JWT (TTL: 10m)<br/>Generate Cryptographic Refresh Token (Opaque 64 bytes)
        GW->>DB: Store SHA-256(refresh_token) in refresh_sessions
        GW->>DB: Write Audit Event (ALLOW: LOGIN_SUCCESS)
        GW-->>User: 200 OK + Body {accessToken} + Set-Cookie refresh_token (HttpOnly)
    end
```

### Alur 2: Akses Data Nilai oleh Dosen (Otorisasi Kontekstual & Proxy)

```mermaid
sequenceDiagram
    autonumber
    actor Dosen as Dosen (Browser)
    participant GW as API Gateway (Port 3000)
    participant DB as PostgreSQL (zero_trust_db)
    participant SN as Service Nilai (Port 3001)

    Dosen->>GW: GET /nilai<br/>Authorization: Bearer <AccessJWT> + X-Device-ID
    GW->>GW: Strip any client X-Gateway-Secret<br/>Validate JWT Signature (RS256 Private/Public Key)<br/>Validate Token Expiration & Claims (token_use=access)
    GW->>DB: Validate X-Device-ID belongs to sub (User ID)
    GW->>GW: Policy Engine: Evaluate Role (dosen)
    GW->>DB: Write Audit Event (ALLOW: GET_NILAI)
    GW->>SN: Proxy GET /nilai<br/>Header X-Gateway-Secret (Injected)<br/>Header Authorization: Bearer <AccessJWT>
    SN->>SN: Verify X-Gateway-Secret (Timing-safe)<br/>Verify JWT Signature (RSA Public Key)
    SN->>DB: Query classes taught by lecturer_id
    DB-->>SN: Grade records
    SN-->>GW: 200 OK [Grade Data]
    GW-->>Dosen: 200 OK [Grade Data]
```

### Alur 3: Finalisasi Nilai Kelas & Sinkronisasi Antar-Service

```mermaid
sequenceDiagram
    autonumber
    actor Dosen as Dosen (Browser)
    participant GW as API Gateway (Port 3000)
    participant DB as PostgreSQL (zero_trust_db)
    participant SN as Service Nilai (Port 3001)
    participant ST as Service Transkrip (Port 3002)

    Dosen->>GW: POST /kelas/:id/finalisasi<br/>Authorization: Bearer <AccessJWT> + X-Device-ID
    GW->>GW: Verify JWT + Device ID<br/>Policy Engine: Check Time Window (07:00-21:00 WIB)<br/>Check Class Ownership
    GW->>DB: Write Audit Event (ALLOW: FINALIZE_CLASS)
    GW->>SN: Proxy POST /kelas/:id/finalisasi + X-Gateway-Secret
    SN->>SN: Verify X-Gateway-Secret + JWT
    SN->>DB: BEGIN TRANSACTION<br/>SELECT class FOR UPDATE<br/>Verify not finalized<br/>UPDATE classes SET is_finalized=TRUE<br/>COMMIT
    SN->>GW: POST /auth/service<br/>{client_id, client_secret}
    GW->>DB: Verify service_clients credentials
    GW-->>SN: 200 OK {serviceToken: RS256 JWT, TTL: 5m, role: service}
    SN->>GW: POST /transkrip/sinkron<br/>Authorization: Bearer <serviceToken><br/>Payload: {classId, grades: [...]}
    GW->>GW: Policy Engine: Endpoint /transkrip/sinkron<br/>Requires role=service & token_use=service<br/>ALLOW
    GW->>DB: Write Audit Event (ALLOW: SYNC_TRANSCRIPT)
    GW->>ST: Proxy POST /transkrip/sinkron + X-Gateway-Secret
    ST->>ST: Verify X-Gateway-Secret + Service JWT
    ST->>DB: Upsert transcript_entries (Idempotent ON CONFLICT)
    DB-->>ST: Synced
    ST-->>GW: 200 OK {status: "synced"}
    GW-->>SN: 200 OK {status: "synced"}
    SN-->>GW: 200 OK {status: "finalized and synced"}
    GW-->>Dosen: 200 OK {status: "finalized and synced"}
```
