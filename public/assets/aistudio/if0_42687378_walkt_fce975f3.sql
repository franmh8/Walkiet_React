-- phpMyAdmin SQL Dump
-- version 4.9.0.1
-- https://www.phpmyadmin.net/
--
-- Servidor: sql206.infinityfree.com
-- Tiempo de generación: 29-10-2026 a las 13:31:18
-- Versión del servidor: 11.4.13-MariaDB
-- Versión de PHP: 7.2.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `if0_42687378_walkt`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `anti_replay_nonces`
--

CREATE TABLE `anti_replay_nonces` (
  `nonce` varchar(64) NOT NULL,
  `transmitter_id` varchar(64) NOT NULL,
  `timestamp_sent` bigint(20) NOT NULL,
  `received_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `channels`
--

CREATE TABLE `channels` (
  `id` varchar(64) NOT NULL,
  `name` varchar(100) NOT NULL,
  `is_private` tinyint(1) NOT NULL DEFAULT 0,
  `access_code` varchar(255) DEFAULT NULL COMMENT 'Código de acceso cifrado',
  `created_by` varchar(64) NOT NULL,
  `category` enum('general','emergencia','tactico','vialidad','inteligencia') NOT NULL DEFAULT 'general',
  `clearance_level` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=Abierto, 2=Policial, 3=Mando Táctico',
  `is_encrypted` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Cifrado AES-256-GCM Activo',
  `encryption_cipher` varchar(30) NOT NULL DEFAULT 'AES-256-GCM',
  `member_count` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `channel_members`
--

CREATE TABLE `channel_members` (
  `id` varchar(64) NOT NULL,
  `channel_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `role_in_channel` enum('owner','admin','member','listener') NOT NULL DEFAULT 'member',
  `is_muted` tinyint(1) NOT NULL DEFAULT 0,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` varchar(64) NOT NULL,
  `sender_id` varchar(64) NOT NULL,
  `sender_name` varchar(120) NOT NULL,
  `sender_callsign` varchar(50) DEFAULT NULL,
  `sender_avatar` text DEFAULT NULL,
  `channel_id` varchar(64) DEFAULT NULL,
  `receiver_id` varchar(64) DEFAULT NULL,
  `type` enum('text','audio','image','video','location','alert','emergency') NOT NULL DEFAULT 'text',
  `content` text NOT NULL,
  `media_url` mediumtext DEFAULT NULL,
  `media_name` varchar(255) DEFAULT NULL,
  `media_size_bytes` int(11) DEFAULT NULL,
  `duration_seconds` decimal(5,2) DEFAULT NULL,
  `location_data` longtext DEFAULT NULL COMMENT 'Coordenadas JSON {latitude, longitude, accuracy}',
  `status` enum('sending','sent','delivered','read') NOT NULL DEFAULT 'delivered',
  `is_emergency` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `contacts`
--

CREATE TABLE `contacts` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `contact_user_id` varchar(64) NOT NULL,
  `alias` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `emergency_alerts`
--

CREATE TABLE `emergency_alerts` (
  `id` varchar(64) NOT NULL,
  `officer_id` varchar(64) NOT NULL,
  `officer_name` varchar(120) NOT NULL,
  `officer_callsign` varchar(50) NOT NULL,
  `channel_id` varchar(64) DEFAULT NULL,
  `latitude` decimal(10,7) NOT NULL COMMENT 'Coordenada Latitud GPS satelital detectada automáticamente',
  `longitude` decimal(10,7) NOT NULL COMMENT 'Coordenada Longitud GPS satelital detectada automáticamente',
  `accuracy_meters` int(11) NOT NULL DEFAULT 10 COMMENT 'Precisión del dispositivo en metros',
  `location_name` varchar(255) NOT NULL COMMENT 'Dirección o sector de referencia despachado',
  `protocol_text` text NOT NULL COMMENT 'Protocolo SOS',
  `status` enum('active','in_progress','attended','resolved') NOT NULL DEFAULT 'active',
  `push_notified` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=Push broadcast emitido a todos los radios',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

--
-- Volcado de datos para la tabla `emergency_alerts`
--

INSERT INTO `emergency_alerts` (`id`, `officer_id`, `officer_name`, `officer_callsign`, `channel_id`, `latitude`, `longitude`, `accuracy_meters`, `location_name`, `protocol_text`, `status`, `push_notified`, `created_at`) VALUES
('sos-seed-1', 'u-6a7ded071b7b3', 'Juan Perez', 'PATRULLA-ESTATAL-302', 'c-1', '20.1227400', '-98.7363100', 8, 'Bulevar Felipe Ángeles, Pachuca Centro, Hidalgo', 'Al activar la alerta se emitira una sirena sonora en todos los radios disponibles en la zona y se asignara prioridad absoluta a tu frecuencia', 'attended', 1, '2026-09-25 16:30:00'),
('sos-seed-2', 'u-2', 'Ana Mendoza', 'ENLACE-911-HGO', 'c-2', '20.1011500', '-98.7591200', 5, 'Centro de Atención de Llamadas 911, Pachuca de Soto, Hidalgo', 'Al activar la alerta se emitira una sirena sonora en todos los radios disponibles en la zona y se asignara prioridad absoluta a tu frecuencia', 'resolved', 1, '2026-09-25 17:15:22');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `security_audit_log`
--

CREATE TABLE `security_audit_log` (
  `id` bigint(20) NOT NULL,
  `event_type` enum('LOGIN_SUCCESS','LOGIN_FAILED','RATE_LIMIT_BLOCKED','PTT_BURST_VERIFIED','REPLAY_ATTACK_PREVENTED','INVALID_HMAC','SESSION_EXPIRED') NOT NULL,
  `user_id` varchar(64) DEFAULT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `severity` enum('INFO','WARNING','CRITICAL') NOT NULL DEFAULT 'INFO',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` varchar(64) NOT NULL,
  `phone_number` varchar(20) NOT NULL,
  `name` varchar(120) NOT NULL,
  `correo` varchar(120) DEFAULT NULL,
  `callsign` varchar(50) NOT NULL COMMENT 'Indicativo de radio (ej. PATRULLA-302)',
  `unit` varchar(120) DEFAULT 'Sector Operativo Hidalgo',
  `role` varchar(60) NOT NULL DEFAULT 'Oficial Operativo',
  `id_rol` int(11) NOT NULL DEFAULT 3 COMMENT '1=Comandante C5i, 2=Despachador 911, 3=Oficial, 4=Paramédico',
  `password_hash` varchar(255) NOT NULL COMMENT 'Hash Argon2id o PBKDF2-SHA512',
  `salt` varchar(64) NOT NULL COMMENT 'Salt individual criptográfico de 256 bits',
  `auth_algorithm` varchar(30) NOT NULL DEFAULT 'PBKDF2-SHA512',
  `e2ee_public_key` text DEFAULT NULL COMMENT 'Clave pública ECDH para cifrado E2EE',
  `failed_login_attempts` int(11) NOT NULL DEFAULT 0 COMMENT 'Contador anti-fuerza bruta',
  `locked_until` datetime DEFAULT NULL COMMENT 'Bloqueo temporal por intentos fallidos',
  `last_login_at` datetime DEFAULT NULL,
  `last_ip` varchar(45) DEFAULT NULL,
  `avatar_url` text DEFAULT NULL,
  `status` enum('online','offline','transmitting','busy','emergency') NOT NULL DEFAULT 'offline',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `phone_number`, `name`, `correo`, `callsign`, `unit`, `role`, `id_rol`, `password_hash`, `salt`, `auth_algorithm`, `e2ee_public_key`, `failed_login_attempts`, `locked_until`, `last_login_at`, `last_ip`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES
('u-1', '7710000001', 'Administrador C5i', 'admin@c5i.gob.mx', 'MANDO-CENTRAL', 'Centro de Control', 'Comandante C5i', 1, 'hash_demo', 'salt_demo', 'PBKDF2-SHA512', NULL, 0, NULL, NULL, NULL, NULL, 'offline', '2026-09-25 19:48:44', '2026-09-25 19:48:44'),
('u-2', '7710000002', 'Ana Mendoza', 'ana.mendoza@c5i.gob.mx', 'ENLACE-911-HGO', 'Atención 911', 'Despachador 911', 2, 'hash_demo', 'salt_demo', 'PBKDF2-SHA512', NULL, 0, NULL, NULL, NULL, NULL, 'offline', '2026-09-25 19:48:44', '2026-09-25 19:48:44'),
('u-6a7ded071b7b3', '7710000003', 'Juan Perez', 'juan.perez@c5i.gob.mx', 'PATRULLA-ESTATAL-302', 'Sector Operativo Hidalgo', 'Oficial Operativo', 3, 'hash_demo', 'salt_demo', 'PBKDF2-SHA512', NULL, 0, NULL, NULL, NULL, NULL, 'offline', '2026-09-25 19:48:44', '2026-09-25 19:48:44');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user_settings`
--

CREATE TABLE `user_settings` (
  `user_id` varchar(64) NOT NULL,
  `theme_mode` enum('light','dark','system') NOT NULL DEFAULT 'system' COMMENT 'Tema visual activo',
  `push_notifications` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Notificaciones en segundo plano',
  `channel_message_sounds` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Sonido de aviso al recibir mensaje en canal',
  `ptt_mode` enum('hold','toggle') NOT NULL DEFAULT 'hold' COMMENT 'Modo botón central: Mantener o Alternar',
  `roger_beep` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Tono Roger Beep al finalizar transmisión',
  `vibration_on_ptt` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Respuesta táctil háptica',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

--
-- Volcado de datos para la tabla `user_settings`
--

INSERT INTO `user_settings` (`user_id`, `theme_mode`, `push_notifications`, `channel_message_sounds`, `ptt_mode`, `roger_beep`, `vibration_on_ptt`, `updated_at`) VALUES
('u-1', 'system', 1, 1, 'hold', 1, 1, '2026-09-25 19:48:44'),
('u-2', 'light', 1, 1, 'hold', 0, 1, '2026-09-25 19:48:44'),
('u-6a7ded071b7b3', 'dark', 1, 1, 'toggle', 1, 1, '2026-09-25 19:48:44');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `voice_messages`
--

CREATE TABLE `voice_messages` (
  `id` varchar(64) NOT NULL,
  `sender_id` varchar(64) NOT NULL,
  `channel_id` varchar(64) DEFAULT NULL,
  `receiver_id` varchar(64) DEFAULT NULL,
  `audio_url` mediumtext NOT NULL,
  `duration_seconds` decimal(5,2) NOT NULL DEFAULT 0.00,
  `is_emergency` tinyint(1) NOT NULL DEFAULT 0,
  `is_encrypted` tinyint(1) NOT NULL DEFAULT 1,
  `encryption_cipher` varchar(30) NOT NULL DEFAULT 'AES-256-GCM',
  `nonce` varchar(64) NOT NULL COMMENT 'Nonce único para prevenir ataques de repetición',
  `hmac_signature` varchar(128) NOT NULL COMMENT 'Firma criptográfica HMAC-SHA256',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `anti_replay_nonces`
--
ALTER TABLE `anti_replay_nonces`
  ADD PRIMARY KEY (`nonce`),
  ADD KEY `idx_nonce_time` (`received_at`);

--
-- Indices de la tabla `channels`
--
ALTER TABLE `channels`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_channel_category` (`category`),
  ADD KEY `idx_channel_clearance` (`clearance_level`),
  ADD KEY `fk_channels_created_by` (`created_by`);

--
-- Indices de la tabla `channel_members`
--
ALTER TABLE `channel_members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_channel_user` (`channel_id`,`user_id`),
  ADD KEY `idx_cm_user` (`user_id`);

--
-- Indices de la tabla `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_channel` (`channel_id`,`created_at`),
  ADD KEY `idx_chat_receiver` (`receiver_id`,`created_at`),
  ADD KEY `idx_chat_sender` (`sender_id`,`created_at`);

--
-- Indices de la tabla `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_contact_pair` (`user_id`,`contact_user_id`),
  ADD KEY `fk_contacts_target` (`contact_user_id`);

--
-- Indices de la tabla `emergency_alerts`
--
ALTER TABLE `emergency_alerts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sos_officer` (`officer_id`),
  ADD KEY `idx_sos_status` (`status`),
  ADD KEY `idx_sos_created` (`created_at`);

--
-- Indices de la tabla `security_audit_log`
--
ALTER TABLE `security_audit_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_event` (`event_type`,`created_at`),
  ADD KEY `idx_audit_ip` (`ip_address`,`created_at`),
  ADD KEY `idx_audit_user` (`user_id`,`created_at`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_phone_number` (`phone_number`),
  ADD UNIQUE KEY `uk_correo` (`correo`),
  ADD KEY `idx_callsign` (`callsign`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_locked` (`locked_until`);

--
-- Indices de la tabla `user_settings`
--
ALTER TABLE `user_settings`
  ADD PRIMARY KEY (`user_id`);

--
-- Indices de la tabla `voice_messages`
--
ALTER TABLE `voice_messages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_transmission_nonce` (`nonce`),
  ADD KEY `idx_vm_channel` (`channel_id`,`created_at`),
  ADD KEY `idx_vm_receiver` (`receiver_id`,`created_at`),
  ADD KEY `idx_vm_sender` (`sender_id`,`created_at`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `security_audit_log`
--
ALTER TABLE `security_audit_log`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `channels`
--
ALTER TABLE `channels`
  ADD CONSTRAINT `fk_channels_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `channel_members`
--
ALTER TABLE `channel_members`
  ADD CONSTRAINT `fk_cm_channel` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD CONSTRAINT `fk_chat_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `contacts`
--
ALTER TABLE `contacts`
  ADD CONSTRAINT `fk_contacts_target` FOREIGN KEY (`contact_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_contacts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `emergency_alerts`
--
ALTER TABLE `emergency_alerts`
  ADD CONSTRAINT `fk_sos_officer` FOREIGN KEY (`officer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `user_settings`
--
ALTER TABLE `user_settings`
  ADD CONSTRAINT `fk_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `voice_messages`
--
ALTER TABLE `voice_messages`
  ADD CONSTRAINT `fk_vm_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
