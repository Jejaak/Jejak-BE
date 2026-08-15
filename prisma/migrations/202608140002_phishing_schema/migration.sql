ALTER TABLE "GameProgress" DROP CONSTRAINT IF EXISTS "GameProgress_values_check";

ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_values_check" CHECK (
  "durationMs" BETWEEN 1 AND 86400000 AND
  (
    ("mode" = 'PRIVACY' AND (("maxScore" = 4 AND "score" BETWEEN 0 AND 4 AND "mistakes" BETWEEN 0 AND 4) OR ("maxScore" = 15 AND "score" BETWEEN 0 AND 15 AND "mistakes" BETWEEN 0 AND 15))) OR
    ("mode" = 'PHISHING' AND (("maxScore" = 3 AND "score" BETWEEN 0 AND 3 AND "mistakes" BETWEEN 0 AND 3) OR ("maxScore" = 15 AND "score" BETWEEN 0 AND 15 AND "mistakes" BETWEEN 0 AND 15))) OR
    ("mode" = 'DOWNLOADS' AND "maxScore" = 4 AND "score" BETWEEN 0 AND 4 AND "mistakes" BETWEEN 0 AND 3)
  )
);

CREATE TABLE "MsPhishingQuestion" (
  "id" VARCHAR(64) NOT NULL,
  "sequence" INTEGER NOT NULL,
  "senderName" VARCHAR(100) NOT NULL,
  "senderEmail" VARCHAR(254) NOT NULL,
  "senderAsset" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(160) NOT NULL,
  "preview" VARCHAR(200) NOT NULL,
  "greeting" VARCHAR(120) NOT NULL,
  "body" TEXT NOT NULL,
  "action" VARCHAR(255) NOT NULL,
  "attachmentName" VARCHAR(180),
  "attachmentAsset" VARCHAR(255),
  "suspicious" BOOLEAN NOT NULL,
  "explanation" TEXT NOT NULL,
  "clues" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MsPhishingQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrPhishingAnswer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "questionId" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "selectedClueIds" TEXT[] NOT NULL,
  "markedSuspicious" BOOLEAN NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrPhishingAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MsPhishingQuestion_sequence_key" ON "MsPhishingQuestion"("sequence");
CREATE INDEX "MsPhishingQuestion_isActive_sequence_idx" ON "MsPhishingQuestion"("isActive", "sequence");
CREATE UNIQUE INDEX "TrPhishingAnswer_userId_idempotencyKey_key" ON "TrPhishingAnswer"("userId", "idempotencyKey");
CREATE INDEX "TrPhishingAnswer_userId_answeredAt_idx" ON "TrPhishingAnswer"("userId", "answeredAt" DESC);
CREATE INDEX "TrPhishingAnswer_questionId_idx" ON "TrPhishingAnswer"("questionId");

ALTER TABLE "TrPhishingAnswer" ADD CONSTRAINT "TrPhishingAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrPhishingAnswer" ADD CONSTRAINT "TrPhishingAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MsPhishingQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
