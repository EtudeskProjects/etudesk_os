-- Migration 055: Simplify application statuses to 4 values
-- Old: PENDING, REVIEWING, SHORTLISTED, INTERVIEWING, OFFERED, ACCEPTED, REJECTED, WITHDRAWN
-- New: SUBMITTED, IN_REVIEW, ACCEPTED, REJECTED

ALTER TABLE opportunity_applications DROP CONSTRAINT opportunity_applications_status_check;

UPDATE opportunity_applications SET status = 'SUBMITTED' WHERE status IN ('PENDING', 'WITHDRAWN');
UPDATE opportunity_applications SET status = 'IN_REVIEW' WHERE status IN ('REVIEWING', 'SHORTLISTED', 'INTERVIEWING', 'OFFERED');

ALTER TABLE opportunity_applications ADD CONSTRAINT opportunity_applications_status_check
  CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED'));
