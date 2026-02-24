-- Add password support for manager auth emails.
-- Default all existing and new rows to "password" unless changed by the manager.

ALTER TABLE manager_auth_emails
ADD COLUMN IF NOT EXISTS password TEXT;

UPDATE manager_auth_emails
SET password = 'password'
WHERE password IS NULL OR BTRIM(password) = '';

ALTER TABLE manager_auth_emails
ALTER COLUMN password SET DEFAULT 'password';

ALTER TABLE manager_auth_emails
ALTER COLUMN password SET NOT NULL;
