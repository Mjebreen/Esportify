-- Match results (scrim/official scores → roster win rates)
CREATE TYPE "MatchKind" AS ENUM ('SCRIM', 'OFFICIAL');

CREATE TABLE "match_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "rosterId" UUID NOT NULL,
    "kind" "MatchKind" NOT NULL DEFAULT 'SCRIM',
    "opponent" TEXT NOT NULL,
    "ourScore" INTEGER NOT NULL,
    "theirScore" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_results_organizationId_id_key" ON "match_results"("organizationId", "id");
CREATE INDEX "match_results_organizationId_rosterId_playedAt_idx" ON "match_results"("organizationId", "rosterId", "playedAt");
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Announcements (org-wide feed)
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_organizationId_pinned_createdAt_idx" ON "announcements"("organizationId", "pinned", "createdAt");
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
