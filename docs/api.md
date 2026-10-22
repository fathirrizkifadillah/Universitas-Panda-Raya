# API Contract & Specifications

Seluruh endpoint di bawah ini diakses oleh klien secara eksklusif melalui **API Gateway (Port 3000)**.
Panggilan langsung ke Service Nilai (port 3001) dan Service Transkrip (port 3002) dari klien luar akan ditolak dengan `403 Forbidden` karena ketiadaan `X-Gateway-Secret`.

---

## 1. Authentication Endpoints

### 1.1 POST `/auth/login`
- **Aktor**: Semua pengguna (Mahasiswa, Dosen, Admin)
- **Header**:
  - `Content-Type: application/json`
  - `X-Device-ID: <string>` (Wajib, harus terdaftar untuk pengguna tersebut)
- **Request Body**:
  ```json
  {
    "username": "mahasiswa1",
    "password": "Password123!"
  }
  ```
- **Response Sukses (200 OK)**:
  - Header: `Set-Cookie: refreshToken=...; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=86400`
  ```json
  {
    "success": true,
    "message": "Login berhasil",
    "data": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "e305e55e-0498-444a-9eb5-8e4cb319d361",
        "username": "mahasiswa1",
        "fullName": "Ahmad Fauzi",
        "role": "mahasiswa",
        "nimNip": "2207051001"
      }
    }
  }
  ```
- **Response Gagal**:
  - `400 Bad Request`: `{ "error": "VALIDATION_ERROR", "message": "Username dan password wajib diisi" }`
  - `401 Unauthorized`: `{ "error": "INVALID_CREDENTIALS", "message": "Kredensial tidak valid" }`
  - `403 Forbidden`: `{ "error": "DEVICE_NOT_REGISTERED", "message": "Perangkat tidak terdaftar untuk akun ini" }`

### 1.2 POST `/auth/refresh`
- **Aktor**: Pengguna aktif (Session user)
- **Header/Cookie**:
  - Cookie: `refreshToken=<opaque_token>`
  - `X-Device-ID: <string>`
- **Response Sukses (200 OK)**:
  - Header: `Set-Cookie: refreshToken=<new_opaque_token>; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=86400`
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Response Gagal (401 Unauthorized)**:
  - `{ "error": "REFRESH_TOKEN_INVALID", "message": "Sesi tidak valid atau telah kedaluwarsa" }`

### 1.3 POST `/auth/logout`
- **Aktor**: Pengguna aktif
- **Header/Cookie**:
  - Cookie: `refreshToken=<opaque_token>`
- **Response Sukses (200 OK)**:
  - Header: Clear cookie `refreshToken`
  ```json
  {
    "success": true,
    "message": "Logout berhasil dan sesi telah dicabut"
  }
  ```

### 1.4 POST `/auth/service`
- **Aktor**: Khusus Service Nilai (Komunikasi antar-service)
- **Request Body**:
  ```json
  {
    "clientId": "grades-service-client",
    "clientSecret": "sec_grades_prod_99218a"
  }
  ```
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "serviceToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresIn": 300
    }
  }
  ```
- **Response Gagal (401 Unauthorized)**:
  - `{ "error": "INVALID_SERVICE_CREDENTIALS", "message": "Client ID atau Secret tidak valid" }`

---

## 2. Resource Endpoints: Nilai (Ditangani Service Nilai via Gateway)

### 2.1 GET `/nilai`
- **Aktor**: Mahasiswa & Dosen
- **Header**:
  - `Authorization: Bearer <accessToken>`
  - `X-Device-ID: <string>`
- **Perilaku**:
  - **Mahasiswa**: Otomatis mengembalikan daftar nilai mata kuliah yang diikutinya (berdasarkan NIM miliknya).
  - **Dosen**: Mengembalikan daftar kelas dan rekapitulasi nilai mahasiswa pada kelas yang diampunya.
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "gradeId": "91866380-60b6-455b-bf7b-2323a6c23179",
        "classId": "2c676d48-8df0-4b0d-b4b6-0e92272a2e06",
        "courseCode": "IF3101",
        "courseName": "Keamanan Informasi",
        "credits": 3,
        "term": "Ganjil 2026/2027",
        "score": 85.5,
        "gradeLetter": "A",
        "isFinalized": false
      }
    ]
  }
  ```

### 2.2 PUT `/nilai/:id`
- **Aktor**: Dosen (Pengampu kelas)
- **Header**:
  - `Authorization: Bearer <accessToken>`
  - `X-Device-ID: <string>`
- **Kondisi Kebijakan**:
  1. Pengguna adalah Dosen yang terdaftar sebagai pengampu kelas tersebut.
  2. Nilai kelas **belum difinalisasi** (`is_finalized == false`).
  3. Waktu request berada dalam **Jam Akses** (07.00 - 21.00 WIB).
  4. Skor valid berada pada rentang numerik `0.0` sampai `100.0`.
- **Request Body**:
  ```json
  {
    "score": 88.0
  }
  ```
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Nilai berhasil diperbarui",
    "data": {
      "gradeId": "91866380-60b6-455b-bf7b-2323a6c23179",
      "score": 88.0,
      "updatedAt": "2026-10-22T07:15:00.000Z"
    }
  }
  ```
- **Response Gagal**:
  - `403 Forbidden (NOT_CLASS_LECTURER)`: `{ "error": "ACCESS_DENIED", "message": "Anda bukan pengampu kelas ini" }`
  - `409 Conflict (CLASS_FINALIZED)`: `{ "error": "CLASS_FINALIZED", "message": "Nilai kelas telah difinalisasi dan terkunci" }`
  - `403 Forbidden (OUTSIDE_ACCESS_WINDOW)`: `{ "error": "ACCESS_DENIED", "message": "Perubahan nilai hanya diizinkan pukul 07.00 - 21.00 WIB" }`

### 2.3 POST `/kelas/:id/finalisasi`
- **Aktor**: Dosen (Pengampu kelas)
- **Header**:
  - `Authorization: Bearer <accessToken>`
  - `X-Device-ID: <string>`
- **Kondisi Kebijakan**: Dosen pengampu, kelas belum final, jam akses 07.00 - 21.00 WIB.
- **Perilaku Sistem**:
  1. Kunci baris kelas secara atomik dengan transaksi (`SELECT ... FOR UPDATE`).
  2. Set `is_finalized = true`, `finalized_by = user.id`, `finalized_at = NOW()`.
  3. Service Nilai meminta Service Token dari Gateway (`POST /auth/service`).
  4. Service Nilai memanggil `POST /transkrip/sinkron` melalui Gateway untuk memperbarui transkrip mahasiswa secara idempoten.
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Kelas berhasil difinalisasi dan nilai disinkronkan ke transkrip",
    "data": {
      "classId": "2c676d48-8df0-4b0d-b4b6-0e92272a2e06",
      "isFinalized": true,
      "finalizedAt": "2026-10-22T07:20:00.000Z",
      "syncedStudentsCount": 3
    }
  }
  ```

---

## 3. Resource Endpoints: Transkrip (Ditangani Service Transkrip via Gateway)

### 3.1 GET `/transkrip/:nim`
- **Aktor**: Mahasiswa & Admin
- **Header**:
  - `Authorization: Bearer <accessToken>`
  - `X-Device-ID: <string>`
- **Kondisi Kebijakan**:
  - Mahasiswa **hanya** dapat mengakses transkrip jika `params.nim === token.nim`.
  - Admin dapat mengakses transkrip untuk NIM apa pun.
  - Mahasiswa mencoba mengakses NIM orang lain akan ditolak `403 Forbidden`.
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "student": {
        "nim": "2207051001",
        "fullName": "Ahmad Fauzi"
      },
      "summary": {
        "totalCredits": 6,
        "gpa": 3.75
      },
      "entries": [
        {
          "courseCode": "IF3101",
          "courseName": "Keamanan Informasi",
          "credits": 3,
          "score": 88.0,
          "gradeLetter": "A",
          "syncedAt": "2026-10-22T07:20:00.000Z"
        }
      ]
    }
  }
  ```
- **Response Gagal**:
  - `403 Forbidden (IDOR_ATTEMPT)`: `{ "error": "ACCESS_DENIED", "message": "Anda tidak memiliki hak akses untuk transkrip NIM lain" }`
  - `404 Not Found`: `{ "error": "STUDENT_NOT_FOUND", "message": "Mahasiswa dengan NIM tersebut tidak ditemukan" }`

### 3.2 POST `/transkrip/sinkron`
- **Aktor**: Khusus Service Nilai (Memerlukan Service Token)
- **Header**:
  - `Authorization: Bearer <serviceToken>`
- **Kondisi Kebijakan**:
  - Token wajib memiliki klaim `role: "service"`, `token_use: "service"`, dan `sub: "grades-service"`.
  - Token pengguna biasa (mahasiswa, dosen, admin) **wajib ditolak** dengan `403 Forbidden`.
- **Request Body**:
  ```json
  {
    "classId": "2c676d48-8df0-4b0d-b4b6-0e92272a2e06",
    "courseId": "bfd6b6e4-44bf-42f0-97b7-6ec800a724db",
    "entries": [
      {
        "studentId": "e305e55e-0498-444a-9eb5-8e4cb319d361",
        "score": 88.0,
        "gradeLetter": "A"
      }
    ]
  }
  ```
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Transkrip berhasil disinkronkan secara idempoten",
    "data": {
      "processedCount": 1
    }
  }
  ```

---

## 4. Audit Trail Endpoints (Nilai Plus)

### 4.1 GET `/audit`
- **Aktor**: Admin Only
- **Header**:
  - `Authorization: Bearer <accessToken>`
  - `X-Device-ID: <string>`
- **Response Sukses (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "e70d4d05-4c07-4221-8178-500b84000302",
        "occurredAt": "2026-10-22T07:15:00.000Z",
        "subjectId": "e305e55e-0498-444a-9eb5-8e4cb319d361",
        "subjectType": "user",
        "method": "GET",
        "path": "/transkrip/2207051002",
        "deviceId": "dev-mhs-01-chrome",
        "decision": "DENY",
        "reasonCode": "IDOR_ATTEMPT_DENIED",
        "requestId": "req_18fbc8d31a"
      }
    ]
  }
  ```
