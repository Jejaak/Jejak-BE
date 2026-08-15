ALTER TABLE "TrVirusSession" ADD COLUMN "publicId" VARCHAR(32);

UPDATE "TrVirusSession"
SET "publicId" = 'VRS-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 6)) || '-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 7 FOR 6)) || '-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 13 FOR 4));

ALTER TABLE "TrVirusSession" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX "TrVirusSession_publicId_key" ON "TrVirusSession"("publicId");
