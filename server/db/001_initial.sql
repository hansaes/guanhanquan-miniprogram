-- PostgreSQL 14+. Opaque TEXT IDs deliberately preserve existing cloud document IDs.
-- Core entities are typed; attrs is reserved for optional extension metadata.
CREATE TABLE users (
  id text PRIMARY KEY,
  openid text NOT NULL UNIQUE,
  nickname text NOT NULL DEFAULT '', avatar text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
  user_type text NOT NULL DEFAULT 'worker' CHECK (user_type IN ('worker', 'employer')),
  city text, intro text, age bigint, gender bigint,
  points bigint NOT NULL DEFAULT 0 CHECK (points >= 0), balance numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  status bigint NOT NULL DEFAULT 0 CHECK (status IN (0,1)),
  real_name text, id_card_enc text, id_card_masked text,
  real_name_verified boolean NOT NULL DEFAULT false, real_name_status bigint NOT NULL DEFAULT -1 CHECK (real_name_status IN (-1,0,1,2)),
  real_name_reject_reason text, enterprise_verified boolean NOT NULL DEFAULT false,
  enterprise_status bigint NOT NULL DEFAULT -1 CHECK (enterprise_status IN (-1,0,1,2)), enterprise_reject_reason text,
  enterprise_present boolean NOT NULL DEFAULT false,
  enterprise_company_name text, enterprise_credit_code text, enterprise_license text, enterprise_address text, enterprise_contact_name text,
  show_phone boolean NOT NULL DEFAULT true, profile_task_rewarded boolean NOT NULL DEFAULT false,
  last_sign_date text NOT NULL DEFAULT '', last_login_at timestamptz, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX users_created_idx ON users (created_at DESC);
CREATE INDEX users_last_login_idx ON users (last_login_at DESC);
CREATE INDEX users_real_review_idx ON users (real_name_status, updated_at DESC);
CREATE INDEX users_enterprise_review_idx ON users (enterprise_status, updated_at DESC);

CREATE TABLE admins (
  id text PRIMARY KEY, username text NOT NULL UNIQUE, salt text NOT NULL, password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'super', enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE TABLE categories (
  id text PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', icon text NOT NULL DEFAULT '',
  sort bigint NOT NULL DEFAULT 0, enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX categories_sort_idx ON categories (enabled, sort);
CREATE TABLE configs (
  id text PRIMARY KEY, key text NOT NULL UNIQUE, value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE TABLE jobs (
  id text PRIMARY KEY,
  owner_openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  category_id text NOT NULL REFERENCES categories(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  title text NOT NULL, job_type text, salary numeric(14,2) NOT NULL DEFAULT 0 CHECK (salary >= 0), salary_unit bigint,
  work_area text, work_address text, duration text, certificate_req text, age_limit text, tech_req text, other_req text,
  pay_type bigint, accommodation bigint, travel_reimburse bigint, other_benefits text,
  contact_name text, contact_phone_enc text, wechat_same boolean NOT NULL DEFAULT false,
  employer_name text, employer_avatar text, employer_verified boolean NOT NULL DEFAULT false,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90), longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  worker_count bigint CHECK (worker_count >= 0), gender_limit bigint,
  is_urgent boolean NOT NULL DEFAULT false, is_top boolean NOT NULL DEFAULT false, request_top boolean NOT NULL DEFAULT false,
  status bigint NOT NULL DEFAULT 0 CHECK (status IN (0,1,2,3,4,5)), reject_reason text,
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0), apply_count bigint NOT NULL DEFAULT 0 CHECK (apply_count >= 0),
  priority_at timestamptz, expire_at timestamptz, top_expire_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX jobs_owner_idx ON jobs (owner_openid, created_at DESC);
CREATE INDEX jobs_category_status_idx ON jobs (category_id, status, priority_at DESC);
CREATE INDEX jobs_list_idx ON jobs (status, is_top DESC, priority_at DESC);
CREATE INDEX jobs_expiry_idx ON jobs (expire_at) WHERE status = 1;
CREATE INDEX jobs_top_expiry_idx ON jobs (top_expire_at) WHERE is_top;
CREATE INDEX jobs_salary_idx ON jobs (status, salary DESC);
CREATE INDEX jobs_created_idx ON jobs (created_at DESC);

CREATE TABLE resumes (
  id text PRIMARY KEY, openid text NOT NULL UNIQUE REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  name text, avatar text, job_types text[] NOT NULL DEFAULT '{}', certificate_images text[] NOT NULL DEFAULT '{}',
  certificate_info text, work_experience text, tech_description text, expect_area text, expect_salary text, available_time text,
  contact_phone_enc text, contact_phone text, wechat text,
  status bigint NOT NULL DEFAULT 0 CHECK (status IN (0,1)), review_status bigint NOT NULL DEFAULT 0 CHECK (review_status IN (0,1,2)),
  reject_reason text, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX resumes_review_idx ON resumes (review_status, status, updated_at DESC);
CREATE INDEX resumes_job_types_idx ON resumes USING gin (job_types);
CREATE TABLE applications (
  id text PRIMARY KEY, job_id text NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  employer_openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  worker_openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  job_title text, worker_name text, worker_phone_enc text, worker_phone text, cover_letter text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE UNIQUE INDEX applications_active_unique ON applications (job_id, worker_openid) WHERE status IN ('pending','accepted');
CREATE INDEX applications_job_idx ON applications (job_id, created_at DESC);
CREATE INDEX applications_worker_idx ON applications (worker_openid, status, created_at DESC);
CREATE INDEX applications_employer_idx ON applications (employer_openid);

CREATE TABLE wallet (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  type bigint NOT NULL CHECK (type IN (1,2,3,4)), amount numeric(14,2) NOT NULL, business_type text NOT NULL,
  business_id text NOT NULL DEFAULT '', remark text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX wallet_owner_time_idx ON wallet (openid, created_at DESC);
CREATE INDEX wallet_business_idx ON wallet (openid, business_type, created_at DESC);
CREATE INDEX wallet_created_idx ON wallet (created_at DESC);
CREATE UNIQUE INDEX wallet_recharge_unique ON wallet (business_id) WHERE type = 3 AND business_type = '充值' AND business_id <> '';
CREATE TABLE orders (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  out_trade_no text NOT NULL UNIQUE, amount numeric(14,2) NOT NULL CHECK (amount > 0), fen bigint NOT NULL CHECK (fen > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','closed','failed','refunded')),
  type text NOT NULL DEFAULT 'recharge', transaction_id text, paid_at timestamptz, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX orders_owner_idx ON orders (openid, created_at DESC);
CREATE INDEX orders_status_idx ON orders (status, created_at DESC);
CREATE UNIQUE INDEX orders_transaction_unique ON orders (transaction_id) WHERE transaction_id IS NOT NULL AND transaction_id <> '';
CREATE TABLE unlocks (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object'), UNIQUE (openid, job_id)
);
CREATE INDEX unlocks_job_idx ON unlocks (job_id);
CREATE TABLE favorites (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object'), UNIQUE (openid, job_id)
);
CREATE INDEX favorites_owner_time_idx ON favorites (openid, created_at DESC);
CREATE INDEX favorites_job_idx ON favorites (job_id);
CREATE TABLE notifications (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  title text NOT NULL, content text NOT NULL DEFAULT '', type bigint NOT NULL DEFAULT 2, is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX notifications_owner_time_idx ON notifications (openid, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (openid) WHERE NOT is_read;
CREATE TABLE reviews (
  id text PRIMARY KEY,
  from_openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  to_openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  job_id text REFERENCES jobs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  from_name text, rating numeric(2,1) NOT NULL CHECK (rating BETWEEN 1 AND 5), content text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX reviews_target_idx ON reviews (to_openid, created_at DESC);
CREATE INDEX reviews_author_idx ON reviews (from_openid);
CREATE INDEX reviews_job_idx ON reviews (job_id);

CREATE TABLE blacklist (
  id text PRIMARY KEY, boss_phone_hash text NOT NULL, boss_phone_masked text NOT NULL, boss_name text,
  reporter_openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  reporter_phone text, reason_type bigint NOT NULL, reason_detail text, evidence text[] NOT NULL DEFAULT '{}',
  status bigint NOT NULL DEFAULT 0 CHECK (status IN (0,1,2)), reviewed_at timestamptz,
  reviewer_id text REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  revoked_by text REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  revoked_at timestamptz, revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE UNIQUE INDEX blacklist_active_unique ON blacklist (boss_phone_hash, reporter_openid) WHERE status IN (0,1);
CREATE INDEX blacklist_phone_idx ON blacklist (boss_phone_hash, status, created_at DESC);
CREATE INDEX blacklist_status_idx ON blacklist (status, created_at DESC);
CREATE INDEX blacklist_reporter_idx ON blacklist (reporter_openid);
CREATE INDEX blacklist_reviewer_idx ON blacklist (reviewer_id);
CREATE INDEX blacklist_revoker_idx ON blacklist (revoked_by);
CREATE TABLE reports (
  id text PRIMARY KEY, reporter_openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  job_id text REFERENCES jobs(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  boss_phone text, report_type bigint NOT NULL, reason text, evidence text[] NOT NULL DEFAULT '{}',
  status bigint NOT NULL DEFAULT 0 CHECK (status IN (0,1,2,3)), handle_remark text, handle_time timestamptz,
  handler_id text REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX reports_reporter_idx ON reports (reporter_openid);
CREATE INDEX reports_job_idx ON reports (job_id);
CREATE INDEX reports_handler_idx ON reports (handler_id);
CREATE TABLE feedback (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  type bigint NOT NULL DEFAULT 1, content text NOT NULL, contact text, images text[] NOT NULL DEFAULT '{}',
  status bigint NOT NULL DEFAULT 0 CHECK (status IN (0,1,2)), handle_remark text, handle_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX feedback_owner_idx ON feedback (openid, created_at DESC);
CREATE INDEX feedback_status_idx ON feedback (status, created_at DESC);

CREATE TABLE trainings (
  id text PRIMARY KEY, title text NOT NULL, cover text, type text, teacher text, intro text, content text,
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0), enabled boolean NOT NULL DEFAULT true,
  created_by text REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  updated_by text REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX trainings_enabled_idx ON trainings (enabled, created_at DESC);
CREATE INDEX trainings_creator_idx ON trainings (created_by);
CREATE INDEX trainings_updater_idx ON trainings (updated_by);
CREATE TABLE training_enrolls (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  training_id text NOT NULL REFERENCES trainings(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object'), UNIQUE (openid, training_id)
);
CREATE INDEX training_enrolls_training_idx ON training_enrolls (training_id);
CREATE INDEX training_enrolls_owner_idx ON training_enrolls (openid, created_at DESC);
CREATE TABLE insurances (
  id text PRIMARY KEY, name text NOT NULL, coverage text, intro text,
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0), enabled boolean NOT NULL DEFAULT true,
  created_by text REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  updated_by text REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX insurances_enabled_idx ON insurances (enabled, created_at DESC);
CREATE INDEX insurances_creator_idx ON insurances (created_by);
CREATE INDEX insurances_updater_idx ON insurances (updated_by);
CREATE TABLE user_insurances (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  insurance_id text NOT NULL REFERENCES insurances(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  name text NOT NULL, price numeric(14,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX user_insurances_owner_idx ON user_insurances (openid, created_at DESC);
CREATE INDEX user_insurances_product_idx ON user_insurances (insurance_id);
CREATE TABLE banners (
  id text PRIMARY KEY, image_url text NOT NULL, link text, title text, sort bigint NOT NULL DEFAULT 0, enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX banners_sort_idx ON banners (enabled, sort);
CREATE TABLE announcements (
  id text PRIMARY KEY, title text NOT NULL, content text NOT NULL, enabled boolean NOT NULL DEFAULT true, pinned boolean NOT NULL DEFAULT false,
  expire_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX announcements_public_idx ON announcements (enabled, pinned DESC, created_at DESC);
CREATE TABLE audit_logs (
  id text PRIMARY KEY, admin_id text NOT NULL REFERENCES admins(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  username text NOT NULL, method text NOT NULL, path text NOT NULL, target_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX audit_logs_admin_idx ON audit_logs (admin_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE TABLE uploads (
  id text PRIMARY KEY, openid text NOT NULL REFERENCES users(openid) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  filename text NOT NULL UNIQUE, mime_type text NOT NULL, size bigint NOT NULL CHECK (size >= 0), dir text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
  attrs jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(attrs) = 'object')
);
CREATE INDEX uploads_owner_idx ON uploads (openid, created_at DESC);
