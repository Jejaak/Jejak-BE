CREATE TYPE "VirusSessionStatus" AS ENUM ('ACTIVE', 'WON', 'LOST');
CREATE TYPE "VirusFileAction" AS ENUM ('ALLOW', 'BLOCK');

CREATE TABLE "MsVirusFile" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "suspicious" BOOLEAN NOT NULL,
    "asset" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MsVirusFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrVirusSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "status" "VirusSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "safeCount" INTEGER NOT NULL DEFAULT 0,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrVirusSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrVirusSessionFile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "fileId" VARCHAR(64) NOT NULL,
    "position" INTEGER NOT NULL,
    "action" "VirusFileAction",
    "correct" BOOLEAN,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "TrVirusSessionFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MsVirusFile_name_key" ON "MsVirusFile"("name");
CREATE INDEX "MsVirusFile_isActive_suspicious_idx" ON "MsVirusFile"("isActive", "suspicious");
CREATE INDEX "TrVirusSession_userId_startedAt_idx" ON "TrVirusSession"("userId", "startedAt" DESC);
CREATE UNIQUE INDEX "TrVirusSessionFile_sessionId_position_key" ON "TrVirusSessionFile"("sessionId", "position");
CREATE UNIQUE INDEX "TrVirusSessionFile_sessionId_fileId_key" ON "TrVirusSessionFile"("sessionId", "fileId");
CREATE INDEX "TrVirusSessionFile_fileId_idx" ON "TrVirusSessionFile"("fileId");

ALTER TABLE "TrVirusSession" ADD CONSTRAINT "TrVirusSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrVirusSessionFile" ADD CONSTRAINT "TrVirusSessionFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrVirusSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrVirusSessionFile" ADD CONSTRAINT "TrVirusSessionFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MsVirusFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MsVirusFile" ("id", "name", "suspicious", "asset", "updatedAt") VALUES
('safe-01', 'tugas-sekolah.docx', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-02', 'foto-keluarga.jpg', false, '/assets/Shared/Game/FilePhoto.png', CURRENT_TIMESTAMP),
('safe-03', 'materi-matematika.pdf', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-04', 'jadwal-kelas.xlsx', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-05', 'presentasi-kelompok.pptx', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-06', 'catatan-harian.txt', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-07', 'musik-favorit.mp3', false, '/assets/Game3/file.png', CURRENT_TIMESTAMP),
('safe-08', 'video-liburan.mp4', false, '/assets/Game3/file.png', CURRENT_TIMESTAMP),
('safe-09', 'poster-lomba.png', false, '/assets/Shared/Game/FilePhoto.png', CURRENT_TIMESTAMP),
('safe-10', 'resep-kue.pdf', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-11', 'laporan-praktikum.docx', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-12', 'daftar-buku.xlsx', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-13', 'desain-logo.png', false, '/assets/Shared/Game/FilePhoto.png', CURRENT_TIMESTAMP),
('safe-14', 'rekaman-podcast.mp3', false, '/assets/Game3/file.png', CURRENT_TIMESTAMP),
('safe-15', 'formulir-sekolah.pdf', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('safe-16', 'kalender-acara.ics', false, '/assets/Game3/file.png', CURRENT_TIMESTAMP),
('safe-17', 'panduan-belajar.epub', false, '/assets/Game3/file.png', CURRENT_TIMESTAMP),
('safe-18', 'foto-profil.jpeg', false, '/assets/Shared/Game/FilePhoto.png', CURRENT_TIMESTAMP),
('safe-19', 'arsip-tugas.zip', false, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('safe-20', 'data-penelitian.csv', false, '/assets/Shared/Game/FileText.png', CURRENT_TIMESTAMP),
('bad-01', 'ROBUX-GRATIS.exe', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-02', 'update-penting.scr', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-03', 'crack-game.bat', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-04', 'hadiah-menang.cmd', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-05', 'invoice-palsu.exe', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-06', 'foto-rahasia.jpg.exe', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-07', 'tugas-sekolah.docx.vbs', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-08', 'antivirus-gratis.msi', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-09', 'password-stealer.exe', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-10', 'browser-update.com', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-11', 'aktivasi-windows.bat', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-12', 'bonus-skin.scr', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-13', 'cheat-game.exe', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-14', 'dokumen-penting.js', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-15', 'scan-keamanan.ps1', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-16', 'undangan-pernikahan.apk', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-17', 'patch-premium.dmg', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-18', 'plugin-browser.xpi', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-19', 'laporan-keuangan.xlsm', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP),
('bad-20', 'paket-kurir.iso', true, '/assets/Shared/Game/FileZip.png', CURRENT_TIMESTAMP);
