# JEJAK Backend

Backend JEJAK menyediakan autentikasi, progres pemain, bank soal, session lifecycle, REST API, dan sinkronisasi WebSocket untuk tiga permainan edukasi keamanan digital.

- Production API: https://api.jejaak.my.id
- Swagger UI: https://api.jejaak.my.id/api/docs
- OpenAPI JSON: https://api.jejaak.my.id/api/docs/openapi.json
- Frontend: https://jejaak.my.id
- Frontend Repository: https://github.com/Jejaak/Jejak-FE

## Teknologi

- Node.js 22+
- TypeScript strict mode
- Express 5
- PostgreSQL
- Prisma ORM
- Better Auth
- Zod
- `ws` WebSocket server
- Swagger UI / OpenAPI 3.1
- Helmet, CORS, rate limiting, request ID, dan structured logging

## Arsitektur

```text
Jejak-BE/
├── prisma/
│   ├── migrations/       riwayat perubahan database
│   └── schema.prisma     model auth, master, transaksi, dan progres
├── src/
│   ├── auth/             konfigurasi Better Auth
│   ├── config/           validasi environment
│   ├── db/               Prisma/PostgreSQL client
│   ├── docs/             OpenAPI dan Swagger UI
│   ├── middleware/       auth, CORS, origin, error, log, dan rate limit
│   ├── modules/
│   │   ├── progress/
│   │   ├── privacy-session/
│   │   ├── phishing/
│   │   └── virus-session/
│   ├── app.ts            komposisi Express
│   └── server.ts         HTTP, WebSocket, dan graceful shutdown
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

Setiap fitur mengikuti alur route → controller → service → repository.

## Fitur API

- Email/password sign-up, sign-in, session, dan sign-out.
- Cookie session Better Auth.
- Ringkasan progres dan riwayat permainan.
- Session ID publik untuk Privasi, Phishing, dan Virus.
- Batas 15 soal/file aman dan 3 kesalahan.
- Idempotency key untuk operasi progres dan jawaban tertentu.
- Ownership check agar pemain hanya dapat membuka sesinya sendiri.
- Status terminal `COMPLETED`, `WON`, `LOST`, atau `ABANDONED`.
- WebSocket realtime dengan heartbeat dan graceful shutdown.
- Swagger UI lokal tanpa CDN.

## Dokumentasi API

Setelah backend berjalan, buka:

- http://localhost:3000/api/docs
- http://localhost:3000/api/docs/openapi.json

Swagger mencakup endpoint HTTP utama. Login di aplikasi atau endpoint Auth terlebih dahulu agar cookie sesi tersedia ketika menggunakan **Try it out**.

### WebSocket

OpenAPI tidak mendeskripsikan WebSocket. Endpoint realtime JEJAK:

| Game | Endpoint |
|---|---|
| Privasi | `/api/v1/ws/privacy-sessions/:publicId` |
| Phishing | `/api/v1/ws/phishing-sessions/:publicId` |
| Virus | `/api/v1/ws/virus-sessions/:publicId` |

Semua koneksi memerlukan cookie Better Auth, origin yang diizinkan, ownership sesi, dan ID sesi yang valid.

## Endpoint Ringkas

| Method | Path | Fungsi |
|---|---|---|
| GET | `/healthz` | Liveness check |
| POST | `/api/auth/sign-up/email` | Registrasi |
| POST | `/api/auth/sign-in/email` | Login |
| GET | `/api/auth/get-session` | Sesi saat ini |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/v1/progress` | Ringkasan progres |
| POST | `/api/v1/progress` | Simpan progres Phishing/Virus |
| POST | `/api/v1/privacy-sessions` | Mulai/lanjut Privasi |
| GET | `/api/v1/privacy-sessions/public/:publicId` | Sesi Privasi aktif |
| POST | `/api/v1/privacy-sessions/:sessionId/answers` | Jawab Privasi |
| POST | `/api/v1/phishing-sessions` | Mulai/lanjut Phishing |
| GET | `/api/v1/phishing-sessions/:publicId` | Ambil sesi Phishing |
| POST | `/api/v1/phishing-sessions/:publicId/answers` | Jawab Phishing |
| POST | `/api/v1/virus-sessions` | Buat sesi Virus |
| GET | `/api/v1/virus-sessions/public/:publicId` | Sesi Virus aktif |
| POST | `/api/v1/virus-sessions/:sessionId/actions` | Allow/block file |

Detail body, response, status code, dan schema tersedia di Swagger.

## Persyaratan

- Node.js `>=22.12.0`.
- npm.
- PostgreSQL.

## Menjalankan Secara Lokal

```bash
npm ci
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Linux/macOS:

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Backend tersedia di http://localhost:3000.

## Environment Variables

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
TRUST_PROXY_HOPS=0
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jejak
DB_POOL_MAX=10
DB_POOL_CONNECTION_TIMEOUT_MS=10000
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_TRANSACTION_MAX_WAIT_MS=10000
DB_TRANSACTION_TIMEOUT_MS=15000
BETTER_AUTH_SECRET=ganti-dengan-secret-minimal-32-karakter
BETTER_AUTH_URL=http://localhost:3000
FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_ORIGINS=http://localhost:5173
JSON_BODY_LIMIT=16kb
API_RATE_LIMIT_MAX=120
API_RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=20
AUTH_RATE_LIMIT_WINDOW_MS=60000
```

Production wajib memakai HTTPS untuk `BETTER_AUTH_URL` dan seluruh frontend origin. Gunakan secret acak yang kuat dan jangan commit `.env`.

## Database dan Migration

Local development:

```bash
npm run prisma:migrate:dev
```

Deployment:

```bash
npm run prisma:migrate:deploy
```

Utility:

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:studio
```

## Validasi dan Build

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

`npm start` menjalankan `dist/server.js` dan mengharapkan environment disediakan platform deployment. `npm run start:local` memuat `.env`.

## Deployment

1. Sediakan PostgreSQL production.
2. Set seluruh environment production.
3. Jalankan `npm ci`.
4. Jalankan `npm run prisma:migrate:deploy`.
5. Jalankan `npm run build`.
6. Jalankan `npm start`.
7. Arahkan health check ke `/healthz`.
8. Set `TRUST_PROXY_HOPS=1` jika berada di belakang satu reverse proxy.
9. Masukkan custom domain dan domain deployment frontend dalam `FRONTEND_ORIGINS`.

## Keamanan

- Cookie HTTP-only, Secure pada HTTPS, dan SameSite sesuai environment.
- Exact-origin mutation guard.
- Credentialed CORS allowlist.
- Rate limit terpisah untuk auth dan API.
- Strict JSON body dan batas payload.
- Request ID pada setiap response.
- Zod validation dan error envelope konsisten.
- Session ownership dan state validation.
- Graceful shutdown untuk HTTP, WebSocket, dan Prisma.

## Akun Demo

Tidak ada akun demo hard-coded. Juri dapat mendaftar melalui frontend `/register` atau endpoint `/api/auth/sign-up/email`. Cara ini memastikan penilaian menggunakan akun dan progres yang terisolasi.

## Error Format

Endpoint aplikasi menggunakan bentuk berikut:

```json
{
  "error": {
    "code": "resource_not_found",
    "message": "Resource tidak ditemukan.",
    "requestId": "uuid"
  }
}
```

Validation error dapat menyertakan objek `fields`. Error Better Auth mengikuti format vendor Better Auth.
