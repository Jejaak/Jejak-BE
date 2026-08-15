ALTER TABLE "TrGameSession" ADD COLUMN "publicId" VARCHAR(32);

DO $$
DECLARE
    session_row RECORD;
    candidate TEXT;
    collision_attempt INTEGER;
    token TEXT;
BEGIN
    FOR session_row IN SELECT "id" FROM "TrGameSession" ORDER BY "id" LOOP
        collision_attempt := 0;
        LOOP
            IF collision_attempt = 0 THEN
                token := UPPER(SUBSTRING(REPLACE(session_row."id"::text, '-', '') FROM 1 FOR 16));
            ELSE
                token := UPPER(SUBSTRING(MD5(session_row."id"::text || ':' || collision_attempt::text) FROM 1 FOR 16));
            END IF;

            candidate := 'PRV-' || SUBSTRING(token FROM 1 FOR 6) || '-' || SUBSTRING(token FROM 7 FOR 6) || '-' || SUBSTRING(token FROM 13 FOR 4);
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM "TrGameSession" WHERE "publicId" = candidate
            );
            collision_attempt := collision_attempt + 1;
        END LOOP;

        UPDATE "TrGameSession"
        SET "publicId" = candidate
        WHERE "id" = session_row."id";
    END LOOP;
END $$;

ALTER TABLE "TrGameSession" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX "TrGameSession_publicId_key" ON "TrGameSession"("publicId");
