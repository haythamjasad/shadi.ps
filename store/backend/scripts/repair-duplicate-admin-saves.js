import pool from '../src/db.js';

function hasArg(name) {
  return process.argv.includes(name);
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

async function hasTableColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

function supplierBalanceDeltaForDelete(entry) {
  const amount = parseMoney(entry.amount);
  return String(entry.transaction_type || '').trim() === 'credit' ? -amount : amount;
}

function clientBalanceDeltaForDelete(entry) {
  const amount = parseMoney(entry.amount);
  return String(entry.transaction_type || '').trim() === 'debit' ? -amount : amount;
}

async function findDuplicateJournalGroups(tableName, accountColumn, sinceDays) {
  const hasVoucherType = await hasTableColumn(tableName, 'voucher_type');
  const voucherSelect = hasVoucherType ? 'COALESCE(voucher_type, \'\') AS voucher_type,' : '\'\' AS voucher_type,';
  const voucherGroup = hasVoucherType ? 'COALESCE(voucher_type, \'\'),' : '';
  const sinceCondition = sinceDays
    ? 'AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)'
    : '';
  const params = sinceDays ? [sinceDays] : [];
  const [groups] = await pool.query(
    `SELECT ${accountColumn} AS account_id,
            COALESCE(order_id, 0) AS order_id,
            transaction_type,
            ${voucherSelect}
            amount,
            COALESCE(reference_doc, '') AS reference_doc,
            COALESCE(note, '') AS note,
            date,
            COUNT(*) AS duplicate_count,
            MIN(id) AS keep_id,
            GROUP_CONCAT(id ORDER BY id ASC) AS ids
       FROM ${tableName}
      WHERE 1 = 1
        ${sinceCondition}
      GROUP BY ${accountColumn},
               COALESCE(order_id, 0),
               transaction_type,
               ${voucherGroup}
               amount,
               COALESCE(reference_doc, ''),
               COALESCE(note, ''),
               date
     HAVING COUNT(*) > 1
      ORDER BY MAX(created_at) DESC, keep_id ASC`,
    params
  );
  return groups.map((group) => {
    const ids = String(group.ids || '')
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return {
      ...group,
      ids,
      delete_ids: ids.filter((id) => id !== Number(group.keep_id))
    };
  });
}

async function repairJournalDuplicates({ apply, tableName, accountTable, accountColumn, balanceDeltaForDelete, sinceDays }) {
  const groups = await findDuplicateJournalGroups(tableName, accountColumn, sinceDays);
  const deleted = [];

  if (!apply || groups.length === 0) {
    return { table: tableName, duplicate_groups: groups.length, groups, deleted };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const group of groups) {
      if (group.delete_ids.length === 0) continue;
      const [entries] = await conn.query(
        `SELECT id, ${accountColumn} AS account_id, transaction_type, amount
           FROM ${tableName}
          WHERE id IN (${group.delete_ids.map(() => '?').join(',')})
          FOR UPDATE`,
        group.delete_ids
      );
      for (const entry of entries) {
        const delta = balanceDeltaForDelete(entry);
        if (delta !== 0) {
          await conn.query(`UPDATE ${accountTable} SET account_balance = account_balance + ? WHERE id = ?`, [delta, entry.account_id]);
        }
        await conn.query(`DELETE FROM ${tableName} WHERE id = ?`, [entry.id]);
        deleted.push({
          id: entry.id,
          account_id: entry.account_id,
          transaction_type: entry.transaction_type,
          amount: parseMoney(entry.amount),
          balance_delta: delta
        });
      }
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return { table: tableName, duplicate_groups: groups.length, groups, deleted };
}

async function findDuplicateOrderCandidates(sinceDays) {
  const sinceCondition = sinceDays
    ? 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)'
    : '';
  const params = sinceDays ? [sinceDays] : [];
  const [rows] = await pool.query(
    `SELECT o.id,
            o.customer_name,
            o.customer_phone,
            o.customer_email,
            o.total,
            o.status,
            o.created_at,
            COUNT(oi.id) AS item_count,
            GROUP_CONCAT(
              CONCAT_WS(':',
                COALESCE(oi.product_name, ''),
                COALESCE(oi.color_name, ''),
                COALESCE(oi.size_name, ''),
                oi.quantity,
                oi.unit_price,
                oi.line_total
              )
              ORDER BY oi.product_name, oi.color_name, oi.size_name, oi.quantity, oi.unit_price, oi.line_total
              SEPARATOR '|'
            ) AS item_signature
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE 1 = 1
        ${sinceCondition}
      GROUP BY o.id
      ORDER BY o.created_at DESC, o.id DESC`,
    params
  );

  const buckets = new Map();
  for (const row of rows) {
    const minuteBucket = row.created_at
      ? new Date(row.created_at).toISOString().slice(0, 16)
      : '';
    const signature = [
      String(row.customer_name || '').trim().toLowerCase(),
      String(row.customer_phone || '').replace(/\s+/g, ''),
      String(row.customer_email || '').trim().toLowerCase(),
      parseMoney(row.total).toFixed(2),
      String(row.status || '').trim(),
      row.item_count,
      row.item_signature || '',
      minuteBucket
    ].join('||');
    const bucket = buckets.get(signature) || [];
    bucket.push(row);
    buckets.set(signature, bucket);
  }

  return Array.from(buckets.values())
    .filter((bucket) => bucket.length > 1)
    .map((bucket) => ({
      keep_id: Math.min(...bucket.map((row) => Number(row.id))),
      candidate_delete_ids: bucket.map((row) => Number(row.id)).sort((a, b) => a - b).slice(1),
      orders: bucket.map((row) => ({
        id: row.id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        total: parseMoney(row.total),
        status: row.status,
        created_at: row.created_at,
        item_count: Number(row.item_count || 0)
      }))
    }));
}

async function main() {
  const apply = hasArg('--apply');
  const sinceDays = parsePositiveInt(getArgValue('--since-days'), 14);

  const [supplierJournals, clientJournals, duplicateOrderCandidates] = await Promise.all([
    repairJournalDuplicates({
      apply,
      tableName: 'journal_entries',
      accountTable: 'suppliers',
      accountColumn: 'supplier_id',
      balanceDeltaForDelete: supplierBalanceDeltaForDelete,
      sinceDays
    }),
    repairJournalDuplicates({
      apply,
      tableName: 'client_journal_entries',
      accountTable: 'clients',
      accountColumn: 'client_id',
      balanceDeltaForDelete: clientBalanceDeltaForDelete,
      sinceDays
    }),
    findDuplicateOrderCandidates(sinceDays)
  ]);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    since_days: sinceDays,
    note: 'Exact duplicate journal entries are repaired with --apply. Duplicate-looking orders are reported only and are not deleted automatically.',
    supplier_journal_entries: supplierJournals,
    client_journal_entries: clientJournals,
    duplicate_order_candidates: duplicateOrderCandidates
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
