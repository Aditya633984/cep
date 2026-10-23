-- ====================================================================
-- FoodBridge Migration: 001_add_email_verification.sql
-- Adds email verification status to users and creates verification_tokens table
-- Preserves existing data without table drops
-- ====================================================================

-- 1. Add email_verified and email_verified_at columns to users table if they don't already exist
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_users_email_verified (email_verified);

-- 2. Create verification_tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_verification_tokens_user (user_id),
  INDEX idx_verification_tokens_hash (token_hash)
) ENGINE=InnoDB;
