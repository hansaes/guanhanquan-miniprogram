-- Additive migration; existing handlers also participate in resource versioning.
ALTER TABLE jobs ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE FUNCTION bump_job_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Counters/promotion timestamps do not change the content being reviewed.
  IF (to_jsonb(NEW) - ARRAY['version','view_count','apply_count','is_top','top_expire_at','priority_at','updated_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['version','view_count','apply_count','is_top','top_expire_at','priority_at','updated_at']) THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER jobs_version BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION bump_job_version();

CREATE TABLE command_receipts (
  actor_id text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT,
  operation text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  request_hash text NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation, idempotency_key)
);
-- Do not expire receipts automatically: an old retry must not become a new debit.
CREATE INDEX command_receipts_created_idx ON command_receipts(created_at);

CREATE TABLE job_reviews (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  admin_id text NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
  reviewed_version bigint NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, reviewed_version)
);
