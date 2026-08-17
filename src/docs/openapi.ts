export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'JEJAK API',
    version: '1.0.0',
    description: 'HTTP API untuk autentikasi, progres, dan sesi permainan edukasi keamanan digital JEJAK. Endpoint WebSocket dijelaskan di README backend.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://api.jejaak.my.id', description: 'Production' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Progress' },
    { name: 'Privacy' },
    { name: 'Phishing' },
    { name: 'Virus' },
  ],
  paths: {
    '/healthz': {
      get: { tags: ['Health'], summary: 'Liveness check', security: [], responses: { '200': { description: 'Service hidup', content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', const: 'ok' } } } } } } } },
    },
    '/api/auth/sign-up/email': {
      post: { tags: ['Auth'], summary: 'Mendaftarkan pemain', security: [], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SignUpRequest' } } } }, responses: { '200': { description: 'Pendaftaran berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } } } }, '422': { description: 'Email telah digunakan atau input tidak valid' } } },
    },
    '/api/auth/sign-in/email': {
      post: { tags: ['Auth'], summary: 'Login pemain', security: [], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInRequest' } } } }, responses: { '200': { description: 'Login berhasil dan cookie sesi dibuat', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } } } }, '401': { description: 'Kredensial tidak sesuai' } } },
    },
    '/api/auth/get-session': {
      get: { tags: ['Auth'], summary: 'Mengambil sesi login saat ini', security: [], responses: { '200': { description: 'Sesi aktif atau null', content: { 'application/json': { schema: { oneOf: [{ $ref: '#/components/schemas/AuthSessionResult' }, { type: 'null' }] } } } } } },
    },
    '/api/auth/sign-out': {
      post: { tags: ['Auth'], summary: 'Logout pemain', responses: { '200': { description: 'Sesi dicabut', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } } } } },
    },
    '/api/v1/progress': {
      get: { tags: ['Progress'], summary: 'Ringkasan progres pemain', responses: { '200': { description: 'Ringkasan progres', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/ProgressSummary' } } } } } }, '401': { $ref: '#/components/responses/Unauthorized' } } },
      post: { tags: ['Progress'], summary: 'Menyimpan hasil Phishing atau Virus', parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProgressRequest' } } } }, responses: { '201': { description: 'Progres tersimpan' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '409': { $ref: '#/components/responses/Conflict' } } },
    },
    '/api/v1/privacy-sessions': {
      post: { tags: ['Privacy'], summary: 'Membuat atau melanjutkan sesi Privasi', responses: { '200': { description: 'Sesi Privasi', content: { 'application/json': { schema: { $ref: '#/components/schemas/PrivacySessionEnvelope' } } } }, '503': { description: 'Bank soal belum tersedia' } } },
    },
    '/api/v1/privacy-sessions/public/{publicId}': {
      get: { tags: ['Privacy'], summary: 'Mengambil sesi Privasi aktif', parameters: [{ $ref: '#/components/parameters/PrivacyPublicId' }], responses: { '200': { description: 'Sesi aktif', content: { 'application/json': { schema: { $ref: '#/components/schemas/PrivacySessionEnvelope' } } } }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
    '/api/v1/privacy-sessions/{sessionId}/tutorial-completed': {
      post: { tags: ['Privacy'], summary: 'Menandai tutorial Privasi selesai', parameters: [{ $ref: '#/components/parameters/SessionUuid' }], responses: { '200': { description: 'Tutorial ditandai selesai' }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
    '/api/v1/privacy-sessions/{sessionId}/answers': {
      post: { tags: ['Privacy'], summary: 'Menjawab pertanyaan Privasi', parameters: [{ $ref: '#/components/parameters/SessionUuid' }, { $ref: '#/components/parameters/IdempotencyKey' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['questionId', 'choice'], properties: { questionId: { type: 'string', maxLength: 64 }, choice: { type: 'string', enum: ['SHARE', 'REJECT'] } } } } } }, responses: { '200': { description: 'Jawaban diproses' }, '409': { $ref: '#/components/responses/Conflict' } } },
    },
    '/api/v1/privacy-sessions/{sessionId}/abandon': {
      post: { tags: ['Privacy'], summary: 'Mengakhiri sesi Privasi', parameters: [{ $ref: '#/components/parameters/SessionUuid' }], responses: { '200': { description: 'Sesi diakhiri' }, '409': { $ref: '#/components/responses/Conflict' } } },
    },
    '/api/v1/phishing-sessions': {
      post: { tags: ['Phishing'], summary: 'Membuat atau melanjutkan sesi Phishing', requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, properties: { restart: { type: 'boolean', default: false } } } } } }, responses: { '201': { description: 'Sesi Phishing', content: { 'application/json': { schema: { $ref: '#/components/schemas/PhishingSessionEnvelope' } } } } } },
    },
    '/api/v1/phishing-sessions/{publicId}': {
      get: { tags: ['Phishing'], summary: 'Mengambil sesi Phishing', parameters: [{ $ref: '#/components/parameters/PhishingPublicId' }], responses: { '200': { description: 'Sesi Phishing', content: { 'application/json': { schema: { $ref: '#/components/schemas/PhishingSessionEnvelope' } } } }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
    '/api/v1/phishing-sessions/{publicId}/answers': {
      post: { tags: ['Phishing'], summary: 'Menilai email Phishing', parameters: [{ $ref: '#/components/parameters/PhishingPublicId' }, { $ref: '#/components/parameters/IdempotencyKey' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['questionId', 'selectedClueIds', 'markedSuspicious'], properties: { questionId: { type: 'string', pattern: '^[a-z0-9-]+$' }, selectedClueIds: { type: 'array', uniqueItems: true, maxItems: 5, items: { type: 'string' } }, markedSuspicious: { type: 'boolean' } } } } } }, responses: { '201': { description: 'Jawaban tersimpan' }, '409': { $ref: '#/components/responses/Conflict' } } },
    },
    '/api/v1/phishing-sessions/{publicId}/abandon': {
      post: { tags: ['Phishing'], summary: 'Mengakhiri sesi Phishing', parameters: [{ $ref: '#/components/parameters/PhishingPublicId' }], responses: { '200': { description: 'Sesi diakhiri' }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
    '/api/v1/virus-sessions': {
      post: { tags: ['Virus'], summary: 'Membuat sesi Virus baru', responses: { '201': { description: 'Sesi Virus', content: { 'application/json': { schema: { $ref: '#/components/schemas/VirusSessionEnvelope' } } } } } },
    },
    '/api/v1/virus-sessions/public/{publicId}': {
      get: { tags: ['Virus'], summary: 'Mengambil sesi Virus aktif', parameters: [{ $ref: '#/components/parameters/VirusPublicId' }], responses: { '200': { description: 'Sesi Virus', content: { 'application/json': { schema: { $ref: '#/components/schemas/VirusSessionEnvelope' } } } }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
    '/api/v1/virus-sessions/{sessionId}/actions': {
      post: { tags: ['Virus'], summary: 'Mengizinkan atau memblokir file', parameters: [{ $ref: '#/components/parameters/SessionUuid' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['fileId', 'action'], properties: { fileId: { type: 'string', minLength: 1, maxLength: 64 }, action: { type: 'string', enum: ['ALLOW', 'BLOCK'] } } } } } }, responses: { '200': { description: 'Aksi file diproses' }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
    '/api/v1/virus-sessions/{sessionId}/abandon': {
      post: { tags: ['Virus'], summary: 'Mengakhiri sesi Virus', parameters: [{ $ref: '#/components/parameters/SessionUuid' }], responses: { '204': { description: 'Sesi diakhiri' }, '404': { $ref: '#/components/responses/NotFound' } } },
    },
  },
  components: {
    securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token', description: 'Cookie sesi Better Auth. Login melalui endpoint Auth atau aplikasi web terlebih dahulu.' } },
    parameters: {
      SessionUuid: { name: 'sessionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      PrivacyPublicId: { name: 'publicId', in: 'path', required: true, schema: { type: 'string', pattern: '^PRV-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4}$' } },
      PhishingPublicId: { name: 'publicId', in: 'path', required: true, schema: { type: 'string', pattern: '^PH-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4}$' } },
      VirusPublicId: { name: 'publicId', in: 'path', required: true, schema: { type: 'string', pattern: '^VRS-[A-F0-9]{6}-[A-F0-9]{6}-[A-F0-9]{4}$' } },
      IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9._:-]+$' } },
    },
    responses: {
      BadRequest: { description: 'Request tidak valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      Unauthorized: { description: 'Sesi login diperlukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      NotFound: { description: 'Resource tidak ditemukan', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
      Conflict: { description: 'Konflik state atau idempotensi', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
    },
    schemas: {
      User: { type: 'object', required: ['id', 'name', 'email', 'emailVerified', 'createdAt', 'updatedAt'], properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, emailVerified: { type: 'boolean' }, image: { type: ['string', 'null'] }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
      SignUpRequest: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string', minLength: 2 }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 128 } } },
      SignInRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, maxLength: 128 }, rememberMe: { type: 'boolean' } } },
      AuthResult: { type: 'object', properties: { token: { type: ['string', 'null'] }, user: { $ref: '#/components/schemas/User' }, redirect: { type: 'boolean' }, url: { type: ['string', 'null'] } } },
      AuthSessionResult: { type: 'object', required: ['session', 'user'], properties: { session: { type: 'object', additionalProperties: true }, user: { $ref: '#/components/schemas/User' } } },
      ErrorEnvelope: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message', 'requestId'], properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' }, fields: { type: 'object', additionalProperties: { type: 'string' } } } } } },
      CreateProgressRequest: { type: 'object', required: ['mode', 'score', 'maxScore', 'mistakes', 'durationMs'], properties: { mode: { type: 'string', enum: ['PHISHING', 'DOWNLOADS'] }, score: { type: 'integer', minimum: 0, maximum: 15 }, maxScore: { type: 'integer', const: 15 }, mistakes: { type: 'integer', minimum: 0, maximum: 15 }, durationMs: { type: 'integer', minimum: 1, maximum: 86400000 } } },
      ProgressSummary: { type: 'object', properties: { completedGames: { type: 'integer' }, totalGames: { type: 'integer', const: 3 }, games: { type: 'array', items: { type: 'object', properties: { gameType: { type: 'string', enum: ['PRIVACY', 'PHISHING', 'DOWNLOADS'] }, status: { type: 'string', enum: ['NOT_STARTED', 'COMPLETED'] }, bestScore: { type: ['integer', 'null'] }, lastPlayedAt: { type: ['string', 'null'], format: 'date-time' } } } }, recentHistory: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
      PrivacyQuestion: { type: 'object', properties: { id: { type: 'string' }, position: { type: 'integer' }, characterName: { type: 'string' }, characterAsset: { type: 'string' }, accountAge: { type: 'string' }, relationship: { type: 'string' }, prompt: { type: 'string' } } },
      PrivacySession: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, publicId: { type: 'string' }, status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'LOST', 'ABANDONED'] }, questionCount: { type: 'integer' }, answeredCount: { type: 'integer' }, resumePosition: { type: 'integer' }, score: { type: 'integer' }, mistakes: { type: 'integer' }, tutorialRequired: { type: 'boolean' }, questions: { type: 'array', items: { $ref: '#/components/schemas/PrivacyQuestion' } } } },
      PrivacySessionEnvelope: { type: 'object', properties: { data: { $ref: '#/components/schemas/PrivacySession' } } },
      PhishingQuestion: { type: 'object', properties: { id: { type: 'string' }, senderName: { type: 'string' }, senderEmail: { type: 'string' }, senderAsset: { type: 'string' }, subject: { type: 'string' }, preview: { type: 'string' }, greeting: { type: 'string' }, body: { type: 'string' }, action: { type: 'string' }, attachment: { type: ['object', 'null'], additionalProperties: true } } },
      PhishingSession: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, publicId: { type: 'string' }, status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'LOST', 'ABANDONED'] }, startedAt: { type: 'string', format: 'date-time' }, completedAt: { type: ['string', 'null'], format: 'date-time' }, answeredCount: { type: 'integer' }, score: { type: 'integer' }, mistakes: { type: 'integer' }, questions: { type: 'array', items: { $ref: '#/components/schemas/PhishingQuestion' } }, answers: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
      PhishingSessionEnvelope: { type: 'object', properties: { data: { $ref: '#/components/schemas/PhishingSession' } } },
      VirusFile: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, asset: { type: 'string' }, suspicious: { type: 'boolean' }, position: { type: 'integer' }, resolved: { type: 'boolean' } } },
      VirusSession: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, publicId: { type: 'string' }, status: { type: 'string', enum: ['ACTIVE', 'WON', 'LOST', 'ABANDONED'] }, safeCount: { type: 'integer' }, mistakes: { type: 'integer' }, startedAt: { type: 'string', format: 'date-time' }, completedAt: { type: ['string', 'null'], format: 'date-time' }, files: { type: 'array', items: { $ref: '#/components/schemas/VirusFile' } } } },
      VirusSessionEnvelope: { type: 'object', properties: { data: { $ref: '#/components/schemas/VirusSession' } } },
    },
  },
  security: [{ sessionCookie: [] }],
} as const;
