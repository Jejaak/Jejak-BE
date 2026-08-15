UPDATE "TrPhishingSession"
SET
  "status" = 'LOST',
  "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "status" = 'ACTIVE'
  AND "answeredCount" - "score" >= 3;
