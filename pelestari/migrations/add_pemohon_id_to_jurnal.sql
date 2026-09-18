-- Migration: Add pemohon_id column to tb_jurnal
-- Run this once on your database:

ALTER TABLE tb_jurnal ADD COLUMN pemohon_id INT NULL AFTER penerima_id;
