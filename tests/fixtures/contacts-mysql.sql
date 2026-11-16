CREATE DATABASE IF NOT EXISTS contacts_test_php CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;
CREATE DATABASE IF NOT EXISTS contacts_test_node CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;
CREATE DATABASE IF NOT EXISTS contacts_test_fresh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE contacts_test_php;
CREATE TABLE IF NOT EXISTS users (
 id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
 name VARCHAR(120) NOT NULL, phone_number VARCHAR(20) UNIQUE NOT NULL, password_hash VARCHAR(255), salt VARCHAR(128),
 correo VARCHAR(120), callsign VARCHAR(50), unit VARCHAR(100), role VARCHAR(50), status VARCHAR(20), avatar_url VARCHAR(255)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS contactos (
 id VARCHAR(64) PRIMARY KEY, name VARCHAR(120) NOT NULL, phone_number VARCHAR(20) NOT NULL,
 callsign VARCHAR(50), correo VARCHAR(120), unit VARCHAR(100), status VARCHAR(20),
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY idx_contactos_phone(phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
USE contacts_test_node;
CREATE TABLE IF NOT EXISTS users LIKE contacts_test_php.users;
USE contacts_test_fresh;
CREATE TABLE IF NOT EXISTS users (
 id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci PRIMARY KEY,
 name VARCHAR(120) NOT NULL, phone_number VARCHAR(20) UNIQUE NOT NULL, password_hash VARCHAR(255), status VARCHAR(20)
) ENGINE=InnoDB;
