# Jejak Backend

Jejak Backend adalah Express API dan session runtime untuk permainan literasi keamanan digital Jejak. Backend mengatur autentikasi pengguna, otorisasi, bank pertanyaan, lifecycle sesi, validasi jawaban, progres, dan komunikasi realtime dengan browser.

Backend menjadi sumber kebenaran untuk kepemilikan sesi, urutan jawaban, hasil permainan, dan status penyelesaian. Hasil Jejak merupakan materi latihan edukatif, bukan penilaian profesional atas kemampuan atau tingkat risiko keamanan seseorang.

## Trusted Responsibilities

- Better Auth untuk register, login, session restoration, dan logout
- Session cookie HTTP-only serta validasi session pengguna
- Bank pertanyaan Privasi dan Phishing
- Bank file aman dan mencurigakan untuk permainan Virus
- Pemilihan materi sesi secara acak
- Validasi jawaban dan progres permainan secara server-authoritative
- Penyimpanan akun, sesi, jawaban, dan progres melalui PostgreSQL/Prisma
- REST API dan WebSocket untuk permainan Privasi, Phishing, dan Virus
- Request ID, HTTP logger dengan redaksi data sensitif, rate limiting, Helmet, CORS, dan mutation-origin validation
- Graceful shutdown untuk HTTP server, WebSocket gateway, dan Prisma

## Technology Stack

| Area | Teknologi |
| --- | --- |
| Runtime | Node.js 22+, TypeScript, TSX |
| HTTP API | Express 5 |
| Authentication | Better Auth |
| Database | PostgreSQL dan Prisma 7 |
| Validation | Zod |
| Realtime | `ws` WebSocket |
| Security | Helmet, CORS, rate limiting, exact-origin checks |
| Logging | Request logger dengan request ID dan redaksi payload sensitif |
| Quality | ESLint dan TypeScript strict mode |

## API Areas

| Method / base path | Akses | Tanggung jawab |
| --- | --- | --- |
| `GET /healthz` | Public | Liveness backend |
| `/api/auth/*` | Public/session | Better Auth |
| `GET /api/v1/progress` | Authenticated | Ringkasan progres dan riwayat permainan |
| `POST /api/v1/progress` | Authenticated | Penyimpanan progres yang memakai idempotency key |
| `POST /api/v1/privacy-sessions` | Authenticated | Membuat atau memulihkan sesi Privasi |
| `POST /api/v1/privacy-sessions/:sessionId/answers` | Authenticated | Menjawab pertanyaan Privasi |
| `POST /api/v1/privacy-sessions/:sessionId/abandon` | Authenticated | Meninggalkan sesi Privasi |
| `POST /api/v1/phishing-sessions` | Authenticated | Membuat atau memulihkan sesi Phishing |
| `GET /api/v1/phishing-sessions/:sessionId` | Authenticated | Mengambil snapshot sesi Phishing |
| `POST /api/v1/phishing-sessions/:sessionId/answers` | Authenticated | Menyimpan jawaban Phishing |
| `POST /api/v1/virus-sessions` | Authenticated | Membuat sesi Virus |
| `GET /api/v1/virus-sessions/public/:publicId` | Authenticated | Mengambil sesi Virus melalui public ID |
| `POST /api/v1/virus-sessions/:sessionId/actions` | Authenticated | Menyimpan tindakan terhadap file |
| `POST /api/v1/virus-sessions/:sessionId/abandon` | Authenticated | Meninggalkan sesi Virus |

Semua route `/api/v1` memerlukan session pengguna. Mutation route juga memerlukan header `Origin` yang sama persis dengan `FRONTEND_ORIGIN`.

## WebSocket Endpoints

| Path | Tanggung jawab |
| --- | --- |
| `/api/v1/ws/privacy-sessions/:publicId` | Snapshot sesi dan jawaban realtime Privasi |
| `/api/v1/phishing-sessions/:publicId/ws` | Snapshot serta event jawaban Phishing |
| `/api/v1/ws/virus-sessions/:publicId` | Snapshot sesi dan tindakan file Virus |

Setiap koneksi WebSocket memvalidasi origin, session cookie, dan kepemilikan sesi. Gateway juga menggunakan heartbeat untuk membersihkan koneksi yang tidak lagi aktif.

## Environment Variables

Buat `.env` dari `.env.example` dan ganti nilai contoh sebelum menjalankan backend.

| Variable | Keterangan |
| --- | --- |
| `NODE_ENV` | `development`, `test`, atau `production` |
| `HOST` | Bind address HTTP; contoh `0.0.0.0` |
| `PORT` | Port backend; default contoh `3000` |
| `TRUST_PROXY_HOPS` | Jumlah proxy tepercaya di depan Express |
| `DATABASE_URL` | PostgreSQL connection URL |
| `BETTER_AUTH_SECRET` | Secret Better Auth minimal 32 karakter |
| `BETTER_AUTH_URL` | Origin backend untuk Better Auth |
| `FRONTEND_ORIGIN` | Exact origin frontend yang diizinkan |
| `JSON_BODY_LIMIT` | Batas ukuran body JSON |
| `API_RATE_LIMIT_MAX` | Batas request API per window |
| `API_RATE_LIMIT_WINDOW_MS` | Durasi window rate limit API |
| `AUTH_RATE_LIMIT_MAX` | Batas request autentikasi per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Durasi window rate limit autentikasi |

Production harus menggunakan HTTPS, secret acak dari secret manager, database privat, dan nilai origin yang sesuai dengan deployment sebenarnya.

## Getting Started

### Prerequisites

- Node.js `>=22.12.0`
- npm
- PostgreSQL
- Environment variable lengkap

### Installation

```bash
npm ci
copy .env.example .env
```

Ganti `BETTER_AUTH_SECRET` di `.env` dengan nilai acak minimal 32 karakter.

### Database

```bash
npm run prisma:generate
npm run prisma:migrate:dev
```

Migrasi membuat schema dan bank materi awal untuk permainan Privasi, Phishing, serta Virus. Untuk database deployment yang sudah dikelola, gunakan:

```bash
npm run prisma:migrate:deploy
```

### Development

```bash
npm run dev
```

Backend berjalan pada `http://localhost:3000` secara default.

### Build and Start

```bash
npm run build
npm start
```

Untuk menjalankan hasil build menggunakan `.env` lokal:

```bash
npm run start:local
```

### Quality Checks

```bash
npm run lint
npm run typecheck
npm run prisma:validate
npm run build
```

Test suite backend belum disertakan pada project saat ini.

## Project Structure

```text
src/
|-- auth/          # Better Auth setup dan Express handler
|-- config/        # Environment parsing dan runtime configuration
|-- db/            # Prisma client dan PostgreSQL adapter
|-- generated/     # Prisma client hasil generate
|-- middleware/    # Auth, errors, logging, origin, rate limit, dan request ID
|-- modules/
|   |-- phishing/        # Session, question, answer, event, REST, dan WebSocket
|   |-- privacy-session/ # Session, question, answer, REST, dan WebSocket
|   |-- progress/        # Penyimpanan dan ringkasan progres pengguna
|   `-- virus-session/   # Session, file action, REST, dan WebSocket
|-- types/         # Kontrak auth dan augmentasi Express
|-- app.ts         # Express middleware dan route assembly
`-- server.ts      # Composition root, HTTP server, gateway, dan shutdown

prisma/
|-- migrations/    # Forward database dan content migrations
`-- schema.prisma  # Auth, progress, question bank, dan session models
```

## Data Model

| Area | Model utama |
| --- | --- |
| Authentication | `User`, `Session`, `Account`, `Verification` |
| Progress | `GameProgress` |
| Phishing | `MsPhishingQuestion`, `TrPhishingSession`, `TrPhishingSessionQuestion`, `TrPhishingAnswer` |
| Virus | `MsVirusFile`, `TrVirusSession`, `TrVirusSessionFile` |
| Privacy | `MsPrivacyQuestion`, `TrGameSession`, `TrPrivacySessionQuestion` |

## Operational Notes

- PostgreSQL adalah sumber kebenaran untuk akun, bank materi, sesi, jawaban, dan progres.
- Browser tidak boleh menentukan kepemilikan sesi atau memfinalisasi hasil sendiri.
- Request dan response autentikasi tidak dicetak oleh HTTP logger.
- Password, cookie, token, email, nama, user ID, dan session ID disembunyikan dari preview log.
- Public session ID digunakan untuk route dan koneksi realtime yang dapat ditampilkan ke client.
- Shutdown `SIGINT` dan `SIGTERM` menutup gateway, HTTP server, dan koneksi Prisma.
- Lisensi source dan data materi belum didokumentasikan.
