const mysql2 = require('mysql2');
require('dotenv').config();

// Create a connection pool for better performance and connection management
const poolConfig = {
  host:             process.env.DB_HOST || 'localhost',
  port:             process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user:             process.env.DB_USER || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME || 'foodbridge',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
};

// If DB_SOCKET is set (local dev with custom MySQL path), use Unix socket
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
  delete poolConfig.host;
}

const pool = mysql2.createPool(poolConfig);

// Promisify the pool for async/await usage
const promisePool = pool.promise();

/**
 * Test the database connection on startup.
 * Logs success or a descriptive error — does NOT crash the server.
 */
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅  MySQL connected successfully to database:', process.env.DB_NAME);
    connection.release();
    await initSchema();
    await migrateSchema();
  } catch (err) {
    console.warn('⚠️  MySQL connection failed:', err.message);
    console.warn('   The server will continue running. Fix your DB config before Stage 2.');
  }
};

/**
 * Create tables if they do not already exist.
 * Safe to run on every startup (idempotent).
 */
const initSchema = async () => {
  try {
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(150)  NOT NULL,
        email       VARCHAR(255)  NOT NULL UNIQUE,
        phone       VARCHAR(20),
        password    VARCHAR(255)  NOT NULL,
        role        ENUM('donor','ngo','volunteer','admin') NOT NULL DEFAULT 'donor',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS ngo_profiles (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        user_id              INT          NOT NULL UNIQUE,
        ngo_name             VARCHAR(200) NOT NULL,
        founder              VARCHAR(150),
        address              TEXT,
        city                 VARCHAR(100),
        phone                VARCHAR(20),
        email                VARCHAR(255),
        food_types           TEXT,
        operating_area       TEXT,
        max_food_capacity    DECIMAL(10,2),
        is_available         TINYINT(1)   NOT NULL DEFAULT 1,
        verification_status  ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS donations (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        donor_id              INT NOT NULL,
        ngo_id                INT,
        volunteer_id          INT,
        food_name             VARCHAR(200) NOT NULL,
        food_category         ENUM('Cooked Food','Packaged Food','Dry Ration','Fruits','Vegetables','Bakery Items','Dairy','Other') NOT NULL,
        quantity              DECIMAL(10,2) NOT NULL,
        unit                  ENUM('kg','g','liters','ml','pieces','servings','boxes','packets') NOT NULL DEFAULT 'kg',
        people_served         INT,
        food_type             ENUM('vegetarian','non-vegetarian') NOT NULL DEFAULT 'vegetarian',
        preparation_date      DATE NOT NULL,
        best_before           DATETIME NOT NULL,
        pickup_address        TEXT NOT NULL,
        city                  VARCHAR(100) NOT NULL,
        description           TEXT,
        food_image            VARCHAR(500),
        pickup_availability   TEXT,
        status                ENUM('POSTED','ACCEPTED','VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'POSTED',
        accepted_at           TIMESTAMP NULL,
        received_at           TIMESTAMP NULL,
        volunteer_assigned_at TIMESTAMP NULL,
        picked_up_at          TIMESTAMP NULL,
        delivered_at          TIMESTAMP NULL,
        reject_reason         TEXT,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (donor_id)     REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (ngo_id)       REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS volunteer_profiles (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT NOT NULL UNIQUE,
        phone         VARCHAR(20),
        address       TEXT,
        vehicle_type  ENUM('bicycle','motorcycle','car','van','truck','other') NOT NULL DEFAULT 'motorcycle',
        availability  TEXT,
        service_area  VARCHAR(200),
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅  Database schema initialised (users, ngo_profiles, donations, volunteer_profiles)');
  } catch (err) {
    console.error('❌  Schema initialisation failed:', err.message);
  }
};

/**
 * Safely migrate existing tables by adding new columns if they don't exist.
 * Uses a helper that ignores "Duplicate column name" errors (errno 1060).
 */
const migrateSchema = async () => {
  const safeAlter = async (sql) => {
    try { await promisePool.query(sql); } catch (e) {
      if (e.errno !== 1060 && e.errno !== 1061) throw e; // ignore duplicate column/key
    }
  };

  // ngo_profiles — new fields
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN city VARCHAR(100) AFTER address`);
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN phone VARCHAR(20) AFTER city`);
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN email VARCHAR(255) AFTER phone`);
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN operating_area TEXT AFTER food_types`);
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN max_food_capacity DECIMAL(10,2) AFTER operating_area`);
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1 AFTER max_food_capacity`);
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN verification_status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending' AFTER is_available`);
  // Location coordinates (nullable — populated when Google Maps API is configured)
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN lat DECIMAL(10,7) NULL AFTER verification_status`);
  await safeAlter(`ALTER TABLE ngo_profiles ADD COLUMN lng DECIMAL(10,7) NULL AFTER lat`);

  // donations — new fields
  await safeAlter(`ALTER TABLE donations ADD COLUMN ngo_id INT AFTER donor_id`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN volunteer_id INT AFTER ngo_id`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN accepted_at TIMESTAMP NULL AFTER status`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN received_at TIMESTAMP NULL AFTER accepted_at`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN volunteer_assigned_at TIMESTAMP NULL AFTER received_at`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN picked_up_at TIMESTAMP NULL AFTER volunteer_assigned_at`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN delivered_at TIMESTAMP NULL AFTER picked_up_at`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN reject_reason TEXT AFTER delivered_at`);
  // Pickup coordinates (nullable — populated via geocoding when donor submits an address)
  await safeAlter(`ALTER TABLE donations ADD COLUMN lat DECIMAL(10,7) NULL AFTER reject_reason`);
  await safeAlter(`ALTER TABLE donations ADD COLUMN lng DECIMAL(10,7) NULL AFTER lat`);

  // volunteer_profiles — location coordinates
  await safeAlter(`ALTER TABLE volunteer_profiles ADD COLUMN lat DECIMAL(10,7) NULL AFTER service_area`);
  await safeAlter(`ALTER TABLE volunteer_profiles ADD COLUMN lng DECIMAL(10,7) NULL AFTER lat`);

  // Add FKs if not exists
  try {
    await promisePool.query(`ALTER TABLE donations ADD CONSTRAINT fk_donations_ngo FOREIGN KEY (ngo_id) REFERENCES users(id) ON DELETE SET NULL`);
  } catch (e) { /* ignore if already exists */ }
  try {
    await promisePool.query(`ALTER TABLE donations ADD CONSTRAINT fk_donations_volunteer FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE SET NULL`);
  } catch (e) { /* ignore if already exists */ }

  console.log('✅  Database migrations applied (includes lat/lng coordinate columns)');
};

module.exports = { pool: promisePool, testConnection };
