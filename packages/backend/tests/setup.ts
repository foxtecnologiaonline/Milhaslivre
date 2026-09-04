// Ensures config validation passes in tests without requiring a real .env file.
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/milhaslivre_test';
process.env.JWT_SECRET ||= 'test-secret-key-minimum-32-characters-long';
process.env.JWT_EXPIRY ||= '24h';
process.env.ENVIRONMENT ||= 'development';
process.env.LOG_LEVEL ||= 'error';
