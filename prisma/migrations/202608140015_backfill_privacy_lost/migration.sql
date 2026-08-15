UPDATE "TrGameSession"
SET
  "status" = 'LOST'::"GameSessionStatus",
  "completedAt" = COALESCE("completedAt", NOW()),
  "updatedAt" = NOW()
WHERE "mode" = 'PRIVACY'::"GameMode"
  AND "status" = 'ACTIVE'::"GameSessionStatus"
  AND "mistakes" >= 3;
