-- Add audit trail and improve data integrity

-- Add password hashing
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
UPDATE users SET password_hash = '' WHERE password_hash IS NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- Add soft delete to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Add audit columns
ALTER TABLE operations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_operations_deleted_at ON operations(deleted_at);

-- Add audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Add rate limit table (for request throttling)
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_count INT DEFAULT 1,
  window_start TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_expires_at ON rate_limits(expires_at);

-- Add payment status tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS failed_reason TEXT;

-- Add operation state transitions validation
CREATE TABLE IF NOT EXISTS operation_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id),
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX idx_operation_state_log_operation_id ON operation_state_log(operation_id);

-- Add seller & buyer verification timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(255);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS verification_documents JSONB DEFAULT '[]';
