CREATE TABLE "TrPhishingSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "publicId" VARCHAR(32) NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrPhishingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrPhishingSessionQuestion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "questionId" VARCHAR(64) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "TrPhishingSessionQuestion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TrPhishingAnswer" ADD COLUMN "sessionId" UUID;

CREATE UNIQUE INDEX "TrPhishingSession_publicId_key" ON "TrPhishingSession"("publicId");
CREATE INDEX "TrPhishingSession_userId_startedAt_idx" ON "TrPhishingSession"("userId", "startedAt" DESC);
CREATE UNIQUE INDEX "TrPhishingSessionQuestion_sessionId_position_key" ON "TrPhishingSessionQuestion"("sessionId", "position");
CREATE UNIQUE INDEX "TrPhishingSessionQuestion_sessionId_questionId_key" ON "TrPhishingSessionQuestion"("sessionId", "questionId");
CREATE INDEX "TrPhishingSessionQuestion_questionId_idx" ON "TrPhishingSessionQuestion"("questionId");
CREATE UNIQUE INDEX "TrPhishingAnswer_sessionId_questionId_key" ON "TrPhishingAnswer"("sessionId", "questionId");

ALTER TABLE "TrPhishingSession" ADD CONSTRAINT "TrPhishingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrPhishingSessionQuestion" ADD CONSTRAINT "TrPhishingSessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrPhishingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrPhishingSessionQuestion" ADD CONSTRAINT "TrPhishingSessionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MsPhishingQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrPhishingAnswer" ADD CONSTRAINT "TrPhishingAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrPhishingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
