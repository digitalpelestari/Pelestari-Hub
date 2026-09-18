-- ============================================================================
-- BANK RECONCILIATION MODULE
-- ============================================================================

-- 1. BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS `tb_bank_account` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `coa_account_id` INT NULL,
  `bank_name` VARCHAR(100) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `account_name` VARCHAR(100) NULL,
  `currency` VARCHAR(10) DEFAULT 'IDR',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_coa_account_id` (`coa_account_id`),
  INDEX `idx_bank_name` (`bank_name`),
  INDEX `idx_account_number` (`account_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BANK STATEMENTS (Header)
CREATE TABLE IF NOT EXISTS `tb_bank_statement` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bank_account_id` INT NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `opening_balance` DECIMAL(18,2) DEFAULT 0,
  `closing_balance` DECIMAL(18,2) DEFAULT 0,
  `total_debit` DECIMAL(18,2) DEFAULT 0,
  `total_credit` DECIMAL(18,2) DEFAULT 0,
  `transaction_count` INT DEFAULT 0,
  `file_name` VARCHAR(255) NULL,
  `status` ENUM('DRAFT', 'IMPORTED', 'RECONCILED', 'CLOSED') DEFAULT 'DRAFT',
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bank_account_id` (`bank_account_id`),
  INDEX `idx_period` (`period_start`, `period_end`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`bank_account_id`) REFERENCES `tb_bank_account`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BANK STATEMENT TRANSACTIONS (Detail)
CREATE TABLE IF NOT EXISTS `tb_bank_statement_transaction` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `statement_id` INT NOT NULL,
  `transaction_date` DATE NOT NULL,
  `value_date` DATE NULL,
  `description` TEXT NOT NULL,
  `reference_number` VARCHAR(100) NULL,
  `debit` DECIMAL(18,2) DEFAULT 0,
  `credit` DECIMAL(18,2) DEFAULT 0,
  `balance` DECIMAL(18,2) DEFAULT 0,
  `is_matched` TINYINT(1) DEFAULT 0,
  `match_status` ENUM('UNMATCHED', 'MATCHED', 'PARTIAL', 'BANK_ONLY', 'COA_ONLY', 'OUTSTANDING', 'ADJUSTED') DEFAULT 'UNMATCHED',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_statement_id` (`statement_id`),
  INDEX `idx_transaction_date` (`transaction_date`),
  INDEX `idx_is_matched` (`is_matched`),
  INDEX `idx_match_status` (`match_status`),
  FOREIGN KEY (`statement_id`) REFERENCES `tb_bank_statement`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BANK RECONCILIATIONS (Header)
CREATE TABLE IF NOT EXISTS `tb_bank_reconciliation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bank_account_id` INT NOT NULL,
  `statement_id` INT NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `bank_ending_balance` DECIMAL(18,2) NOT NULL,
  `coa_ending_balance` DECIMAL(18,2) NOT NULL,
  `deposit_in_transit` DECIMAL(18,2) DEFAULT 0,
  `outstanding_payment` DECIMAL(18,2) DEFAULT 0,
  `bank_error` DECIMAL(18,2) DEFAULT 0,
  `adjusted_bank_balance` DECIMAL(18,2) DEFAULT 0,
  `difference` DECIMAL(18,2) DEFAULT 0,
  `status` ENUM('DRAFT', 'IN_PROGRESS', 'REVIEW', 'RECONCILED', 'CLOSED') DEFAULT 'DRAFT',
  `notes` TEXT NULL,
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bank_account_id` (`bank_account_id`),
  INDEX `idx_statement_id` (`statement_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_period` (`period_start`, `period_end`),
  FOREIGN KEY (`bank_account_id`) REFERENCES `tb_bank_account`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`statement_id`) REFERENCES `tb_bank_statement`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BANK RECONCILIATION MATCHES
CREATE TABLE IF NOT EXISTS `tb_bank_reconciliation_match` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reconciliation_id` INT NOT NULL,
  `bank_transaction_id` INT NULL,
  `coa_transaction_id` INT NULL,
  `match_type` ENUM('AUTO', 'MANUAL', 'SUGGESTED') DEFAULT 'AUTO',
  `match_score` INT DEFAULT 0,
  `status` ENUM('MATCHED', 'UNMATCHED', 'OUTSTANDING', 'BANK_ONLY', 'COA_ONLY', 'ADJUSTED') DEFAULT 'UNMATCHED',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_reconciliation_id` (`reconciliation_id`),
  INDEX `idx_bank_transaction_id` (`bank_transaction_id`),
  INDEX `idx_coa_transaction_id` (`coa_transaction_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`reconciliation_id`) REFERENCES `tb_bank_reconciliation`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`bank_transaction_id`) REFERENCES `tb_bank_statement_transaction`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BANK RECONCILIATION ADJUSTMENTS
CREATE TABLE IF NOT EXISTS `tb_bank_reconciliation_adjustment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reconciliation_id` INT NOT NULL,
  `match_id` INT NULL,
  `adjustment_type` ENUM('BANK_ONLY', 'COA_ONLY', 'OUTSTANDING', 'ERROR') NOT NULL,
  `description` TEXT NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `journal_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_reconciliation_id` (`reconciliation_id`),
  INDEX `idx_match_id` (`match_id`),
  FOREIGN KEY (`reconciliation_id`) REFERENCES `tb_bank_reconciliation`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
