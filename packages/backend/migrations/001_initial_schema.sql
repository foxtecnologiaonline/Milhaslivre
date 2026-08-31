-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL CHECK (role IN ('seller', 'buyer', 'admin')),
  password_hash VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create buyers table
CREATE TABLE buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  cnpj VARCHAR(18) UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create operations table
CREATE TABLE operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID REFERENCES users(id),
  program VARCHAR(100) NOT NULL,
  amount BIGINT NOT NULL,
  price_per_thousand DECIMAL(10, 2) NOT NULL,
  commission_percentage DECIMAL(5, 2) NOT NULL,
  total_price DECIMAL(12, 2) GENERATED ALWAYS AS (
    (amount::DECIMAL / 1000) * price_per_thousand
  ) STORED,
  commission_amount DECIMAL(12, 2) GENERATED ALWAYS AS (
    ((amount::DECIMAL / 1000) * price_per_thousand) * (commission_percentage / 100)
  ) STORED,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'completed', 'cancelled')
  ),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id),
  amount DECIMAL(12, 2) NOT NULL,
  commission_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'completed', 'failed', 'refunded')
  ),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create quotations table (cache layer)
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program VARCHAR(100) NOT NULL,
  amount BIGINT NOT NULL,
  price_per_thousand DECIMAL(10, 2) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_buyers_user_id ON buyers(user_id);
CREATE INDEX idx_buyers_verified ON buyers(verified);
CREATE INDEX idx_operations_seller_id ON operations(seller_id);
CREATE INDEX idx_operations_buyer_id ON operations(buyer_id);
CREATE INDEX idx_operations_status ON operations(status);
CREATE INDEX idx_operations_created_at ON operations(created_at);
CREATE INDEX idx_transactions_operation_id ON transactions(operation_id);
CREATE INDEX idx_quotations_expires_at ON quotations(expires_at);
