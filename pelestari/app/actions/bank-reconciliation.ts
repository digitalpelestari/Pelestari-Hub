"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES
// ============================================================================

export interface BankAccount {
  id: number;
  coa_account_id: number | null;
  bank_name: string;
  account_number: string;
  account_name: string | null;
  currency: string;
  is_active: number;
}

export interface BankStatement {
  id: number;
  bank_account_id: number;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
  transaction_count: number;
  file_name: string | null;
  status: string;
}

export interface BankStatementTransaction {
  id: number;
  statement_id: number;
  transaction_date: string;
  value_date: string | null;
  description: string;
  reference_number: string | null;
  debit: number;
  credit: number;
  balance: number;
  is_matched: number;
  match_status: string;
}

export interface BankReconciliation {
  id: number;
  bank_account_id: number;
  statement_id: number;
  period_start: string;
  period_end: string;
  bank_ending_balance: number;
  coa_ending_balance: number;
  deposit_in_transit: number;
  outstanding_payment: number;
  bank_error: number;
  adjusted_bank_balance: number;
  difference: number;
  status: string;
  notes: string | null;
}

export interface ReconciliationMatch {
  id: number;
  reconciliation_id: number;
  bank_transaction_id: number | null;
  coa_transaction_id: number | null;
  match_type: string;
  match_score: number;
  status: string;
  notes: string | null;
  bank_transaction?: BankStatementTransaction | null;
  coa_transaction?: CoaTransaction | null;
}

export interface CoaTransaction {
  id: number;
  jurnal_id: number;
  tanggal: string;
  no_akun: string;
  nama_akun: string;
  debit: number;
  kredit: number;
  keterangan: string;
  no_registrasi: string | null;
  no_referensi: string | null;
}

export interface ReconciliationAdjustment {
  id: number;
  reconciliation_id: number;
  match_id: number | null;
  adjustment_type: string;
  description: string;
  amount: number;
  journal_id: number | null;
}

export interface MatchCandidate {
  coaTransaction: CoaTransaction;
  score: number;
  reasons: string[];
}

// ============================================================================
// 1. BANK ACCOUNT CRUD
// ============================================================================

export async function getBankAccounts() {
  try {
    const [rows]: any = await db.query(`
      SELECT b.*, a.nama_akun as coa_account_name
      FROM tb_bank_account b
      LEFT JOIN tb_akun a ON b.coa_account_id = a.id
      WHERE b.is_active = 1
      ORDER BY b.bank_name ASC, b.account_number ASC
    `);
    return rows as BankAccount[];
  } catch (error: any) {
    console.error("GET_BANK_ACCOUNTS_ERROR:", error.message);
    return [];
  }
}

export async function createBankAccount(data: {
  bank_name: string;
  account_number: string;
  account_name?: string;
  coa_account_id?: number;
  currency?: string;
}) {
  try {
    const query = `
      INSERT INTO tb_bank_account (bank_name, account_number, account_name, coa_account_id, currency)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result]: any = await db.query(query, [
      data.bank_name,
      data.account_number,
      data.account_name || null,
      data.coa_account_id || null,
      data.currency || "IDR",
    ]);
    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true, id: result.insertId };
  } catch (error: any) {
    console.error("CREATE_BANK_ACCOUNT_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function updateBankAccount(
  id: number,
  data: {
    bank_name?: string;
    account_number?: string;
    account_name?: string;
    coa_account_id?: number;
    currency?: string;
    is_active?: number;
  }
) {
  try {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.bank_name !== undefined) { sets.push("bank_name = ?"); values.push(data.bank_name); }
    if (data.account_number !== undefined) { sets.push("account_number = ?"); values.push(data.account_number); }
    if (data.account_name !== undefined) { sets.push("account_name = ?"); values.push(data.account_name || null); }
    if (data.coa_account_id !== undefined) { sets.push("coa_account_id = ?"); values.push(data.coa_account_id || null); }
    if (data.currency !== undefined) { sets.push("currency = ?"); values.push(data.currency); }
    if (data.is_active !== undefined) { sets.push("is_active = ?"); values.push(data.is_active); }

    if (sets.length === 0) return { success: false, message: "Tidak ada data yang diubah" };

    values.push(id);
    await db.query(`UPDATE tb_bank_account SET ${sets.join(", ")} WHERE id = ?`, values);
    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true };
  } catch (error: any) {
    console.error("UPDATE_BANK_ACCOUNT_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function deleteBankAccount(id: number) {
  try {
    await db.query("DELETE FROM tb_bank_account WHERE id = ?", [id]);
    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true };
  } catch (error: any) {
    console.error("DELETE_BANK_ACCOUNT_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

// ============================================================================
// 2. BANK STATEMENT CRUD
// ============================================================================

export async function getBankStatements(bankAccountId?: number) {
  try {
    let query = `
      SELECT s.*, b.bank_name, b.account_number
      FROM tb_bank_statement s
      LEFT JOIN tb_bank_account b ON s.bank_account_id = b.id
    `;
    const params: any[] = [];

    if (bankAccountId) {
      query += " WHERE s.bank_account_id = ?";
      params.push(bankAccountId);
    }

    query += " ORDER BY s.period_start DESC";

    const [rows]: any = await db.query(query, params);
    return rows as BankStatement[];
  } catch (error: any) {
    console.error("GET_BANK_STATEMENTS_ERROR:", error.message);
    return [];
  }
}

export async function createBankStatement(data: {
  bank_account_id: number;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_debit?: number;
  total_credit?: number;
  transaction_count?: number;
  file_name?: string;
}) {
  try {
    const query = `
      INSERT INTO tb_bank_statement 
        (bank_account_id, period_start, period_end, opening_balance, closing_balance, total_debit, total_credit, transaction_count, file_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IMPORTED')
    `;
    const [result]: any = await db.query(query, [
      data.bank_account_id,
      data.period_start,
      data.period_end,
      data.opening_balance,
      data.closing_balance,
      data.total_debit || 0,
      data.total_credit || 0,
      data.transaction_count || 0,
      data.file_name || null,
    ]);
    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true, id: result.insertId };
  } catch (error: any) {
    console.error("CREATE_BANK_STATEMENT_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function importBankStatementTransactions(
  statementId: number,
  transactions: Array<{
    transaction_date: string;
    value_date?: string;
    description: string;
    reference_number?: string;
    debit: number;
    credit: number;
    balance: number;
  }>
) {
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Clear existing transactions for this statement
      await connection.query("DELETE FROM tb_bank_statement_transaction WHERE statement_id = ?", [statementId]);

      const insertQuery = `
        INSERT INTO tb_bank_statement_transaction 
          (statement_id, transaction_date, value_date, description, reference_number, debit, credit, balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const tx of transactions) {
        await connection.query(insertQuery, [
          statementId,
          tx.transaction_date,
          tx.value_date || null,
          tx.description,
          tx.reference_number || null,
          tx.debit || 0,
          tx.credit || 0,
          tx.balance || 0,
        ]);
      }

      // Update transaction count
      const [countRow]: any = await connection.query(
        "SELECT COUNT(*) as cnt FROM tb_bank_statement_transaction WHERE statement_id = ?",
        [statementId]
      );
      await connection.query(
        "UPDATE tb_bank_statement SET transaction_count = ? WHERE id = ?",
        [countRow.cnt, statementId]
      );

      await connection.commit();
      return { success: true, count: transactions.length };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("IMPORT_BANK_STATEMENT_TRANSACTIONS_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function getBankStatementTransactions(statementId: number) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_bank_statement_transaction WHERE statement_id = ? ORDER BY transaction_date ASC, id ASC",
      [statementId]
    );
    return rows as BankStatementTransaction[];
  } catch (error: any) {
    console.error("GET_BANK_STATEMENT_TRANSACTIONS_ERROR:", error.message);
    return [];
  }
}

// ============================================================================
// 3. COA TRANSACTIONS (from Jurnal)
// ============================================================================

export async function getCoaTransactions(
  coaAccountId: number,
  startDate: string,
  endDate: string
): Promise<CoaTransaction[]> {
  try {
    // First get the COA account code
    const [coaRows]: any = await db.query(
      "SELECT no_akun FROM tb_akun WHERE id = ?",
      [coaAccountId]
    );

    if (!coaRows || coaRows.length === 0) return [];

    const coaCode = String(coaRows[0].no_akun);

    const [rows]: any = await db.query(
      `
      SELECT 
        i.id,
        i.jurnal_id,
        j.tanggal,
        i.no_akun,
        a.nama_akun,
        i.debit,
        i.kredit,
        i.keterangan,
        j.no_registrasi,
        j.no_referensi
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
      LEFT JOIN tb_akun a ON i.no_akun = a.no_akun
      WHERE i.no_akun = ?
        AND DATE(j.tanggal) >= ?
        AND DATE(j.tanggal) <= ?
      ORDER BY j.tanggal ASC, j.id ASC, i.id ASC
      `,
      [coaCode, startDate, endDate]
    );

    return rows.map((row: any) => ({
      id: row.id,
      jurnal_id: row.jurnal_id,
      tanggal: String(row.tanggal).split("T")[0],
      no_akun: String(row.no_akun),
      nama_akun: row.nama_akun || "-",
      debit: Number(row.debit) || 0,
      kredit: Number(row.kredit) || 0,
      keterangan: row.keterangan || "",
      no_registrasi: row.no_registrasi || null,
      no_referensi: row.no_referensi || null,
    }));
  } catch (error: any) {
    console.error("GET_COA_TRANSACTIONS_ERROR:", error.message);
    return [];
  }
}

export async function getCoaTransactionsByCodes(
  coaCodes: string[],
  startDate: string,
  endDate: string
): Promise<CoaTransaction[]> {
  try {
    if (coaCodes.length === 0) return [];

    const placeholders = coaCodes.map(() => "?").join(",");
    const [rows]: any = await db.query(
      `
      SELECT 
        i.id,
        i.jurnal_id,
        j.tanggal,
        i.no_akun,
        a.nama_akun,
        i.debit,
        i.kredit,
        i.keterangan,
        j.no_registrasi,
        j.no_referensi
      FROM tb_jurnal_item i
      INNER JOIN tb_jurnal j ON i.jurnal_id = j.id
      LEFT JOIN tb_akun a ON i.no_akun = a.no_akun
      WHERE i.no_akun IN (${placeholders})
        AND DATE(j.tanggal) >= ?
        AND DATE(j.tanggal) <= ?
      ORDER BY j.tanggal ASC, j.id ASC, i.id ASC
      `,
      [...coaCodes, startDate, endDate]
    );

    return rows.map((row: any) => ({
      id: row.id,
      jurnal_id: row.jurnal_id,
      tanggal: String(row.tanggal).split("T")[0],
      no_akun: String(row.no_akun),
      nama_akun: row.nama_akun || "-",
      debit: Number(row.debit) || 0,
      kredit: Number(row.kredit) || 0,
      keterangan: row.keterangan || "",
      no_registrasi: row.no_registrasi || null,
      no_referensi: row.no_referensi || null,
    }));
  } catch (error: any) {
    console.error("GET_COA_TRANSACTIONS_BY_CODES_ERROR:", error.message);
    return [];
  }
}

// ============================================================================
// 4. AUTO MATCHING
// ============================================================================

function calculateMatchScore(
  bankTx: BankStatementTransaction,
  coaTx: CoaTransaction
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Amount match (50%)
  const bankAmount = bankTx.debit || bankTx.credit;
  const coaAmount = coaTx.debit || coaTx.kredit;
  if (Math.abs(bankAmount - coaAmount) < 0.01) {
    score += 50;
    reasons.push("Nominal sama");
  } else if (Math.abs(bankAmount - coaAmount) / Math.max(bankAmount, 1) < 0.05) {
    score += 25;
    reasons.push("Nominal mendekati");
  }

  // Date match (25%)
  const bankDate = bankTx.transaction_date;
  const coaDate = coaTx.tanggal;
  if (bankDate === coaDate) {
    score += 25;
    reasons.push("Tanggal sama");
  } else {
    const diffDays = Math.abs(
      new Date(bankDate).getTime() - new Date(coaDate).getTime()
    ) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) {
      score += 20;
      reasons.push("Tanggal beda 1 hari");
    } else if (diffDays <= 3) {
      score += 10;
      reasons.push("Tanggal beda 2-3 hari");
    }
  }

  // Reference number match (15%)
  if (bankTx.reference_number && coaTx.no_referensi) {
    if (
      bankTx.reference_number.toLowerCase() === coaTx.no_referensi.toLowerCase() ||
      bankTx.reference_number.toLowerCase().includes(coaTx.no_referensi.toLowerCase()) ||
      coaTx.no_referensi.toLowerCase().includes(bankTx.reference_number.toLowerCase())
    ) {
      score += 15;
      reasons.push("Referensi sama");
    }
  }

  // Description similarity (10%)
  const bankDesc = bankTx.description.toLowerCase();
  const coaDesc = coaTx.keterangan.toLowerCase();
  if (bankDesc && coaDesc) {
    const bankWords = new Set(bankDesc.split(/\s+/));
    const coaWords = new Set(coaDesc.split(/\s+/));
    let common = 0;
    bankWords.forEach((w) => {
      if (coaWords.has(w) && w.length > 3) common++;
    });
    if (common >= 2) {
      score += 10;
      reasons.push("Deskripsi mirip");
    } else if (common >= 1) {
      score += 5;
      reasons.push("Deskripsi sedikit mirip");
    }
  }

  return { score, reasons };
}

export async function findMatchesForBankTransaction(
  bankTx: BankStatementTransaction,
  coaTransactions: CoaTransaction[],
  minScore: number = 50
): Promise<MatchCandidate[]> {
  const candidates: MatchCandidate[] = [];

  for (const coaTx of coaTransactions) {
    const { score, reasons } = calculateMatchScore(bankTx, coaTx);
    if (score >= minScore) {
      candidates.push({ coaTransaction: coaTx, score, reasons });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ============================================================================
// 5. RECONCILIATION CRUD
// ============================================================================

export async function createReconciliation(data: {
  bank_account_id: number;
  statement_id: number;
  period_start: string;
  period_end: string;
  bank_ending_balance: number;
  coa_ending_balance: number;
}) {
  try {
    const adjustedBankBalance =
      data.bank_ending_balance +
      (data.deposit_in_transit || 0) -
      (data.outstanding_payment || 0) +
      (data.bank_error || 0);

    const difference = adjustedBankBalance - data.coa_ending_balance;

    const query = `
      INSERT INTO tb_bank_reconciliation 
        (bank_account_id, statement_id, period_start, period_end, bank_ending_balance, coa_ending_balance, 
         deposit_in_transit, outstanding_payment, bank_error, adjusted_bank_balance, difference, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
    `;
    const [result]: any = await db.query(query, [
      data.bank_account_id,
      data.statement_id,
      data.period_start,
      data.period_end,
      data.bank_ending_balance,
      data.coa_ending_balance,
      0,
      0,
      0,
      adjustedBankBalance,
      difference,
    ]);
    return { success: true, id: result.insertId };
  } catch (error: any) {
    console.error("CREATE_RECONCILIATION_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function getReconciliations(bankAccountId?: number) {
  try {
    let query = `
      SELECT r.*, b.bank_name, b.account_number
      FROM tb_bank_reconciliation r
      LEFT JOIN tb_bank_account b ON r.bank_account_id = b.id
    `;
    const params: any[] = [];

    if (bankAccountId) {
      query += " WHERE r.bank_account_id = ?";
      params.push(bankAccountId);
    }

    query += " ORDER BY r.period_start DESC";

    const [rows]: any = await db.query(query, params);
    return rows as BankReconciliation[];
  } catch (error: any) {
    console.error("GET_RECONCILIATIONS_ERROR:", error.message);
    return [];
  }
}

export async function getReconciliationById(id: number) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_bank_reconciliation WHERE id = ?",
      [id]
    );
    return rows[0] as BankReconciliation | undefined;
  } catch (error: any) {
    console.error("GET_RECONCILIATION_BY_ID_ERROR:", error.message);
    return undefined;
  }
}

export async function updateReconciliation(
  id: number,
  data: {
    deposit_in_transit?: number;
    outstanding_payment?: number;
    bank_error?: number;
    notes?: string;
    status?: string;
  }
) {
  try {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.deposit_in_transit !== undefined) { sets.push("deposit_in_transit = ?"); values.push(data.deposit_in_transit); }
    if (data.outstanding_payment !== undefined) { sets.push("outstanding_payment = ?"); values.push(data.outstanding_payment); }
    if (data.bank_error !== undefined) { sets.push("bank_error = ?"); values.push(data.bank_error); }
    if (data.notes !== undefined) { sets.push("notes = ?"); values.push(data.notes); }
    if (data.status !== undefined) { sets.push("status = ?"); values.push(data.status); }

    if (sets.length === 0) return { success: false, message: "Tidak ada data yang diubah" };

    // Recalculate adjusted balance and difference
    const recon = await getReconciliationById(id);
    if (recon) {
      const newDeposit = data.deposit_in_transit ?? recon.deposit_in_transit;
      const newOutstanding = data.outstanding_payment ?? recon.outstanding_payment;
      const newBankError = data.bank_error ?? recon.bank_error;
      const adjustedBankBalance = recon.bank_ending_balance + newDeposit - newOutstanding + newBankError;
      const difference = adjustedBankBalance - recon.coa_ending_balance;

      sets.push("adjusted_bank_balance = ?");
      values.push(adjustedBankBalance);
      sets.push("difference = ?");
      values.push(difference);
    }

    values.push(id);
    await db.query(`UPDATE tb_bank_reconciliation SET ${sets.join(", ")} WHERE id = ?`, values);
    return { success: true };
  } catch (error: any) {
    console.error("UPDATE_RECONCILIATION_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function finalizeReconciliation(id: number) {
  try {
    // Update all bank transactions for this reconciliation to matched
    const recon = await getReconciliationById(id);
    if (!recon) return { success: false, message: "Reconciliation tidak ditemukan" };

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Update reconciliation status
      await connection.query(
        "UPDATE tb_bank_reconciliation SET status = 'RECONCILED' WHERE id = ?",
        [id]
      );

      // Update bank statement status
      await connection.query(
        "UPDATE tb_bank_statement SET status = 'RECONCILED' WHERE id = ?",
        [recon.statement_id]
      );

      // Mark all matched bank transactions
      await connection.query(`
        UPDATE tb_bank_statement_transaction t
        INNER JOIN tb_bank_reconciliation_match m ON m.bank_transaction_id = t.id
        SET t.is_matched = 1, t.match_status = 'MATCHED'
        WHERE m.reconciliation_id = ? AND m.status = 'MATCHED'
      `, [id]);

      await connection.commit();
      revalidatePath("/dashboard/finance/rekonsiliasi-bank");
      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("FINALIZE_RECONCILIATION_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

// ============================================================================
// 6. MATCHING
// ============================================================================

export async function getReconciliationMatches(reconciliationId: number) {
  try {
    const [rows]: any = await db.query(
      `
      SELECT m.*, 
        bt.description as bank_description, bt.transaction_date as bank_date, bt.debit as bank_debit, bt.credit as bank_credit,
        ct.keterangan as coa_description, ct.tanggal as coa_date, ct.debit as coa_debit, ct.kredit as coa_kredit, ct.nama_akun as coa_account_name
      FROM tb_bank_reconciliation_match m
      LEFT JOIN tb_bank_statement_transaction bt ON m.bank_transaction_id = bt.id
      LEFT JOIN tb_jurnal_item ct ON m.coa_transaction_id = ct.id
      WHERE m.reconciliation_id = ?
      ORDER BY m.status DESC, m.match_score DESC
      `,
      [reconciliationId]
    );

    return rows.map((row: any) => ({
      id: row.id,
      reconciliation_id: row.reconciliation_id,
      bank_transaction_id: row.bank_transaction_id,
      coa_transaction_id: row.coa_transaction_id,
      match_type: row.match_type,
      match_score: row.match_score,
      status: row.status,
      notes: row.notes,
      bank_transaction: row.bank_transaction_id ? {
        id: row.bank_transaction_id,
        description: row.bank_description,
        transaction_date: row.bank_date,
        debit: row.bank_debit,
        credit: row.bank_credit,
      } : null,
      coa_transaction: row.coa_transaction_id ? {
        id: row.coa_transaction_id,
        keterangan: row.coa_description,
        tanggal: row.coa_date,
        debit: row.coa_debit,
        kredit: row.coa_kredit,
        nama_akun: row.coa_account_name,
      } : null,
    })) as ReconciliationMatch[];
  } catch (error: any) {
    console.error("GET_RECONCILIATION_MATCHES_ERROR:", error.message);
    return [];
  }
}

export async function createMatch(
  reconciliationId: number,
  data: {
    bank_transaction_id: number;
    coa_transaction_id: number;
    match_type?: string;
    match_score?: number;
    status?: string;
  }
) {
  try {
    const query = `
      INSERT INTO tb_bank_reconciliation_match 
        (reconciliation_id, bank_transaction_id, coa_transaction_id, match_type, match_score, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result]: any = await db.query(query, [
      reconciliationId,
      data.bank_transaction_id,
      data.coa_transaction_id,
      data.match_type || "MANUAL",
      data.match_score || 100,
      data.status || "MATCHED",
    ]);

    // Update bank transaction status
    await db.query(
      "UPDATE tb_bank_statement_transaction SET is_matched = 1, match_status = ? WHERE id = ?",
      [data.status || "MATCHED", data.bank_transaction_id]
    );

    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true, id: result.insertId };
  } catch (error: any) {
    console.error("CREATE_MATCH_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function updateMatch(
  matchId: number,
  data: {
    status?: string;
    notes?: string;
  }
) {
  try {
    const sets: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) { sets.push("status = ?"); values.push(data.status); }
    if (data.notes !== undefined) { sets.push("notes = ?"); values.push(data.notes); }

    if (sets.length === 0) return { success: false, message: "Tidak ada data yang diubah" };

    values.push(matchId);
    await db.query(`UPDATE tb_bank_reconciliation_match SET ${sets.join(", ")} WHERE id = ?`, values);
    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true };
  } catch (error: any) {
    console.error("UPDATE_MATCH_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function deleteMatch(matchId: number) {
  try {
    const [matchRows]: any = await db.query(
      "SELECT bank_transaction_id FROM tb_bank_reconciliation_match WHERE id = ?",
      [matchId]
    );

    await db.query("DELETE FROM tb_bank_reconciliation_match WHERE id = ?", [matchId]);

    if (matchRows.length > 0 && matchRows[0].bank_transaction_id) {
      await db.query(
        "UPDATE tb_bank_statement_transaction SET is_matched = 0, match_status = 'UNMATCHED' WHERE id = ?",
        [matchRows[0].bank_transaction_id]
      );
    }

    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true };
  } catch (error: any) {
    console.error("DELETE_MATCH_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

// ============================================================================
// 7. ADJUSTMENTS
// ============================================================================

export async function createAdjustment(data: {
  reconciliation_id: number;
  match_id: number;
  adjustment_type: string;
  description: string;
  amount: number;
}) {
  try {
    const query = `
      INSERT INTO tb_bank_reconciliation_adjustment 
        (reconciliation_id, match_id, adjustment_type, description, amount)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result]: any = await db.query(query, [
      data.reconciliation_id,
      data.match_id,
      data.adjustment_type,
      data.description,
      data.amount,
    ]);

    // Update match status
    await db.query(
      "UPDATE tb_bank_reconciliation_match SET status = 'ADJUSTED', notes = ? WHERE id = ?",
      [data.description, data.match_id]
    );

    revalidatePath("/dashboard/finance/rekonsiliasi-bank");
    return { success: true, id: result.insertId };
  } catch (error: any) {
    console.error("CREATE_ADJUSTMENT_ERROR:", error.message);
    return { success: false, message: error.message };
  }
}

export async function getAdjustments(reconciliationId: number) {
  try {
    const [rows]: any = await db.query(
      "SELECT * FROM tb_bank_reconciliation_adjustment WHERE reconciliation_id = ? ORDER BY created_at ASC",
      [reconciliationId]
    );
    return rows as ReconciliationAdjustment[];
  } catch (error: any) {
    console.error("GET_ADJUSTMENTS_ERROR:", error.message);
    return [];
  }
}

// ============================================================================
// 8. SUMMARY / DASHBOARD
// ============================================================================

export async function getReconciliationSummary(reconciliationId: number) {
  try {
    const recon = await getReconciliationById(reconciliationId);
    if (!recon) return null;

    const matches = await getReconciliationMatches(reconciliationId);
    const adjustments = await getAdjustments(reconciliationId);

    const matched = matches.filter((m) => m.status === "MATCHED").length;
    const unmatched = matches.filter((m) => m.status === "UNMATCHED").length;
    const bankOnly = matches.filter((m) => m.status === "BANK_ONLY").length;
    const coaOnly = matches.filter((m) => m.status === "COA_ONLY").length;
    const outstanding = matches.filter((m) => m.status === "OUTSTANDING").length;
    const adjusted = matches.filter((m) => m.status === "ADJUSTED").length;

    const totalMatches = matches.length;
    const matchRate = totalMatches > 0 ? Math.round((matched / totalMatches) * 100) : 0;

    return {
      reconciliation: recon,
      matches,
      adjustments,
      stats: {
        totalMatches,
        matched,
        unmatched,
        bankOnly,
        coaOnly,
        outstanding,
        adjusted,
        matchRate,
      },
    };
  } catch (error: any) {
    console.error("GET_RECONCILIATION_SUMMARY_ERROR:", error.message);
    return null;
  }
}
