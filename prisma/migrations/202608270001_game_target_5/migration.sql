ALTER TABLE "TrGameSession" ALTER COLUMN "questionCount" SET DEFAULT 5;

ALTER TABLE "GameProgress" DROP CONSTRAINT IF EXISTS "GameProgress_values_check";

ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_values_check" CHECK (
  "durationMs" BETWEEN 1 AND 86400000 AND
  (
    ("mode" = 'PRIVACY' AND (("maxScore" = 4 AND "score" BETWEEN 0 AND 4 AND "mistakes" BETWEEN 0 AND 4) OR ("maxScore" = 5 AND "score" BETWEEN 0 AND 5 AND "mistakes" BETWEEN 0 AND 5) OR ("maxScore" = 15 AND "score" BETWEEN 0 AND 15 AND "mistakes" BETWEEN 0 AND 15))) OR
    ("mode" = 'PHISHING' AND (("maxScore" = 3 AND "score" BETWEEN 0 AND 3 AND "mistakes" BETWEEN 0 AND 3) OR ("maxScore" = 5 AND "score" BETWEEN 0 AND 5 AND "mistakes" BETWEEN 0 AND 5) OR ("maxScore" = 15 AND "score" BETWEEN 0 AND 15 AND "mistakes" BETWEEN 0 AND 15))) OR
    ("mode" = 'DOWNLOADS' AND (("maxScore" = 4 AND "score" BETWEEN 0 AND 4 AND "mistakes" BETWEEN 0 AND 3) OR ("maxScore" = 5 AND "score" BETWEEN 0 AND 5 AND "mistakes" BETWEEN 0 AND 3) OR ("maxScore" = 15 AND "score" BETWEEN 0 AND 15 AND "mistakes" BETWEEN 0 AND 3)))
  )
);
