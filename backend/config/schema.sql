-- ====================================================================
-- FoodBridge – Relational Database Schema (MySQL 8.0+ / 5.7+)
-- Enforces Uniqueness Constraints on Email and Phone
-- Passwords stored exclusively as bcrypt hashes (never plaintext)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS foodbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE foodbridge;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('donor', 'ngo', 'volunteer', 'admin') NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_email_verified (email_verified)
) ENGINE=InnoDB;

-- 2. NGO Profiles Table
CREATE TABLE IF NOT EXISTS ngo_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  ngo_name VARCHAR(255) NOT NULL,
  founder VARCHAR(150),
  address VARCHAR(255),
  city VARCHAR(100) DEFAULT 'Bangalore',
  phone VARCHAR(20),
  email VARCHAR(191),
  food_types VARCHAR(255) DEFAULT 'Cooked Food',
  operating_area VARCHAR(255),
  max_food_capacity DECIMAL(8,2) DEFAULT 100.00,
  is_available TINYINT(1) DEFAULT 1,
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'verified',
  lat DECIMAL(10,6),
  lng DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Volunteer Profiles Table
CREATE TABLE IF NOT EXISTS volunteer_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  phone VARCHAR(20),
  address VARCHAR(255),
  vehicle_type VARCHAR(50) DEFAULT 'motorcycle',
  service_area VARCHAR(255),
  availability VARCHAR(255),
  lat DECIMAL(10,6),
  lng DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Donations Table
CREATE TABLE IF NOT EXISTS donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  ngo_id INT DEFAULT NULL,
  volunteer_id INT DEFAULT NULL,
  food_name VARCHAR(255) NOT NULL,
  food_category VARCHAR(100) NOT NULL,
  quantity DECIMAL(8,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'kg',
  people_served INT DEFAULT NULL,
  food_type VARCHAR(50) DEFAULT 'vegetarian',
  preparation_date DATE NOT NULL,
  best_before DATETIME NOT NULL,
  pickup_address VARCHAR(255) NOT NULL,
  city VARCHAR(100) DEFAULT 'Bangalore',
  description TEXT,
  food_image VARCHAR(255) DEFAULT NULL,
  pickup_availability VARCHAR(255) DEFAULT NULL,
  status ENUM('POSTED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED', 'CANCELLED') DEFAULT 'POSTED',
  accepted_at DATETIME DEFAULT NULL,
  volunteer_assigned_at DATETIME DEFAULT NULL,
  picked_up_at DATETIME DEFAULT NULL,
  delivered_at DATETIME DEFAULT NULL,
  received_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lat DECIMAL(10,6),
  lng DECIMAL(10,6),
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ngo_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_donations_status (status),
  INDEX idx_donations_donor (donor_id),
  INDEX idx_donations_ngo (ngo_id),
  INDEX idx_donations_volunteer (volunteer_id)
) ENGINE=InnoDB;

-- 5. Email Verification Tokens Table
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
