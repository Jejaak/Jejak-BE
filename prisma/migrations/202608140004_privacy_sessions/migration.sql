CREATE TYPE "PrivacyChoice" AS ENUM ('SHARE', 'REJECT');
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

CREATE TABLE "MsPrivacyQuestion" (
    "id" VARCHAR(64) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "characterName" VARCHAR(100) NOT NULL,
    "characterAsset" VARCHAR(255) NOT NULL,
    "accountAge" VARCHAR(60) NOT NULL,
    "relationship" VARCHAR(160) NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "correctFeedback" TEXT NOT NULL,
    "correctChoice" "PrivacyChoice" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MsPrivacyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrGameSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "questionCount" INTEGER NOT NULL DEFAULT 15,
    "score" INTEGER NOT NULL DEFAULT 0,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrGameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrPrivacySessionQuestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "questionId" VARCHAR(64) NOT NULL,
    "position" INTEGER NOT NULL,
    "selectedChoice" "PrivacyChoice",
    "correct" BOOLEAN,
    "idempotencyKey" VARCHAR(128),
    "answeredAt" TIMESTAMP(3),
    CONSTRAINT "TrPrivacySessionQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MsPrivacyQuestion_sequence_key" ON "MsPrivacyQuestion"("sequence");
CREATE INDEX "MsPrivacyQuestion_isActive_sequence_idx" ON "MsPrivacyQuestion"("isActive", "sequence");
CREATE INDEX "TrGameSession_userId_mode_startedAt_idx" ON "TrGameSession"("userId", "mode", "startedAt" DESC);
CREATE INDEX "TrGameSession_userId_status_idx" ON "TrGameSession"("userId", "status");
CREATE UNIQUE INDEX "TrPrivacySessionQuestion_sessionId_position_key" ON "TrPrivacySessionQuestion"("sessionId", "position");
CREATE UNIQUE INDEX "TrPrivacySessionQuestion_sessionId_questionId_key" ON "TrPrivacySessionQuestion"("sessionId", "questionId");
CREATE UNIQUE INDEX "TrPrivacySessionQuestion_sessionId_idempotencyKey_key" ON "TrPrivacySessionQuestion"("sessionId", "idempotencyKey");
CREATE INDEX "TrPrivacySessionQuestion_questionId_idx" ON "TrPrivacySessionQuestion"("questionId");

ALTER TABLE "TrGameSession" ADD CONSTRAINT "TrGameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrPrivacySessionQuestion" ADD CONSTRAINT "TrPrivacySessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrPrivacySessionQuestion" ADD CONSTRAINT "TrPrivacySessionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MsPrivacyQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
