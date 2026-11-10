-- ========================================================
-- Esquema de Base de Datos para C5i Walkie-Talkie
-- Base de Datos: if0_42687378_walkt
-- Compatible con InfinityFree (MySQL / phpMyAdmin)
-- ========================================================

CREATE DATABASE IF NOT EXISTS `if0_42687378_walkt` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `if0_42687378_walkt`;

-- 1. Tabla de Usuarios y Oficiales C5i
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `phone_number` VARCHAR(20) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `correo` VARCHAR(120) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_url` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('online', 'offline', 'transmitting') DEFAULT 'online',
  `callsign` VARCHAR(50) DEFAULT NULL,
  `unit` VARCHAR(100) DEFAULT 'Sector Operativo Hidalgo',
  `role` VARCHAR(50) DEFAULT 'Elemento Táctico',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_phone` (`phone_number`),
  KEY `idx_users_callsign` (`callsign`),
  KEY `idx_users_correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Canales Tácticos
CREATE TABLE IF NOT EXISTS `channels` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `is_private` TINYINT(1) DEFAULT 0,
  `access_code` VARCHAR(20) DEFAULT NULL,
  `created_by` VARCHAR(64) DEFAULT NULL,
  `category` VARCHAR(50) DEFAULT 'operativo',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Miembros en Canales
CREATE TABLE IF NOT EXISTS `channel_members` (
  `id` VARCHAR(64) NOT NULL,
  `channel_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cm_channel` (`channel_id`),
  KEY `idx_cm_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de Mensajes y Transmisiones PTT
CREATE TABLE IF NOT EXISTS `voice_messages` (
  `id` VARCHAR(64) NOT NULL,
  `sender_id` VARCHAR(64) NOT NULL,
  `channel_id` VARCHAR(64) DEFAULT NULL,
  `receiver_id` VARCHAR(64) DEFAULT NULL,
  `audio_url` TEXT NOT NULL,
  `duration_seconds` INT(11) DEFAULT 0,
  `text_content` TEXT DEFAULT NULL,
  `is_emergency` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vm_channel` (`channel_id`),
  KEY `idx_vm_sender` (`sender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de Códigos de Verificación SMS (OTP)
CREATE TABLE IF NOT EXISTS `sms_otps` (
  `phone_number` VARCHAR(20) NOT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Las cuentas se crean únicamente desde el registro. No se insertan usuarios demo.
