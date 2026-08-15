ALTER TABLE "TrPhishingSession"
ADD COLUMN "answeredCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;

UPDATE "TrPhishingSession" session
SET
  "answeredCount" = aggregate."answeredCount",
  "score" = aggregate."score"
FROM (
  SELECT
    "sessionId",
    COUNT(*)::INTEGER AS "answeredCount",
    COUNT(*) FILTER (WHERE "correct")::INTEGER AS "score"
  FROM "TrPhishingAnswer"
  WHERE "sessionId" IS NOT NULL
  GROUP BY "sessionId"
) aggregate
WHERE session."id" = aggregate."sessionId";

CREATE INDEX "TrPhishingSession_userId_status_startedAt_idx"
ON "TrPhishingSession"("userId", "status", "startedAt" DESC);
