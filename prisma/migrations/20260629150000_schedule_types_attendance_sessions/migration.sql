-- AlterEnum: richer attendance statuses for practice-session logging
ALTER TYPE "AttendanceType" ADD VALUE 'PRESENT';
ALTER TYPE "AttendanceType" ADD VALUE 'EXCUSED';

-- AlterEnum: broader schedule event types (photoshoots, media days, etc.)
ALTER TYPE "ScheduleType" ADD VALUE 'PHOTOSHOOT';
ALTER TYPE "ScheduleType" ADD VALUE 'MEDIA_DAY';
ALTER TYPE "ScheduleType" ADD VALUE 'OTHER';

-- schedules becomes an FK target for the attendance same-org guard
CREATE UNIQUE INDEX "schedules_organizationId_id_key" ON "schedules"("organizationId", "id");

-- Attendance can be tied to a specific practice/scrim session
ALTER TABLE "attendance" ADD COLUMN "scheduleId" UUID;
CREATE INDEX "attendance_organizationId_scheduleId_idx" ON "attendance"("organizationId", "scheduleId");
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
