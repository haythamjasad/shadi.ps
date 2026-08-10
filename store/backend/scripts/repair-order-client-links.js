import pool from '../src/db.js';

const ACCOUNTING_ORDER_CUTOFF = '2026-06-22 00:00:00';

function hasArg(name) {
  return process.argv.includes(name);
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function parsePositiveId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function parseMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function journalBalanceEffect(entry) {
  const amount = parseMoney(entry.amount);
  return String(entry.transaction_type || '').trim() === 'credit' ? -amount : amount;
}

function isPlaceholderCustomerEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email === 'nill'
    || email === 'nil'
    || email === 'none'
    || email === 'noemail'
    || email === 'nill@nill.com'
    || email === 'nil@nil.com'
    || email === 'nll@nill.com'
    || email === 'nill@nll.com'
    || email === 'noemail@noemail.com'
    || email === 'none@none.com';
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

async function findDeliveredOrdersNeedingRepair(orderId = null) {
  const hasClientSource = await hasTableColumn('clients', 'source');
  const hasOrderSource = await hasTableColumn('orders', 'source');
  const clientSourceSelect = hasClientSource ? 'c.source AS client_source,' : "'manual' AS client_source,";
  const orderSourceSelect = hasOrderSource ? 'o.source AS order_source,' : 'NULL AS order_source,';
  const sourceRepairCondition = hasClientSource
    ? `OR (
        COALESCE(c.source, 'manual') = 'manual'
        AND (
          ${hasOrderSource ? "o.source = 'store' OR" : ''}
          paid_payments.order_id IS NOT NULL
        )
      )
      OR (
        c.source = 'store'
        AND EXISTS (
          SELECT 1
            FROM client_journal_entries manual_cje
           WHERE manual_cje.client_id = c.id
             AND manual_cje.order_id IS NULL
        )
      )`
    : '';
  const params = [];
  const filters = [
    'o.supplier_buyer_id IS NULL',
    "o.status = 'delivered'",
    `(o.client_id IS NULL
      OR c.id IS NULL
      OR LOWER(TRIM(o.customer_name)) <> LOWER(TRIM(COALESCE(c.name, '')))
      ${sourceRepairCondition})`
  ];

  if (orderId) {
    filters.push('o.id = ?');
    params.push(orderId);
  }

  const [rows] = await pool.query(
    `SELECT o.id,
            o.client_id,
            o.customer_name,
            o.customer_phone,
            o.customer_email,
            ${orderSourceSelect}
            o.total,
            o.status,
            o.created_at,
            ${clientSourceSelect}
            paid_payments.order_id IS NOT NULL AS has_paid_payment,
            c.name AS linked_client_name
       FROM orders o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN (
         SELECT order_id
           FROM payments
          WHERE LOWER(TRIM(status)) = 'paid'
          GROUP BY order_id
       ) paid_payments ON paid_payments.order_id = o.id
      WHERE ${filters.join(' AND ')}
      ORDER BY o.id ASC`,
    params
  );
  return rows;
}

async function markClientSourceForOrder(conn, order, targetClientId) {
  if (!(await hasTableColumn('clients', 'source'))) return null;
  const orderSource = String(order.order_source || '').trim().toLowerCase();
  const isStoreOrder = orderSource === 'store'
    || (!orderSource && order.has_paid_payment);
  const [manualRows] = await conn.query(
    `SELECT id
       FROM client_journal_entries
      WHERE client_id = ?
        AND order_id IS NULL
      LIMIT 1`,
    [targetClientId]
  );
  const hasManualActivity = manualRows.length > 0;
  const nextSource = isStoreOrder
    ? (hasManualActivity ? 'mixed' : 'store')
    : 'manual';
  await conn.query(
    `UPDATE clients
        SET source = CASE
          WHEN source = ? THEN source
          WHEN source = 'mixed' THEN 'mixed'
          ELSE ?
        END
      WHERE id = ?`,
    [nextSource, nextSource, targetClientId]
  );
  if (isStoreOrder && hasManualActivity) {
    await conn.query('UPDATE clients SET source = ? WHERE id = ?', ['mixed', targetClientId]);
  }
  return nextSource;
}

async function recalculateClientSource(conn, clientId) {
  if (!(await hasTableColumn('clients', 'source'))) return null;
  const [rows] = await conn.query(
    `SELECT
       EXISTS (
         SELECT 1
           FROM orders o
           LEFT JOIN (
             SELECT order_id
               FROM payments
              WHERE LOWER(TRIM(status)) = 'paid'
              GROUP BY order_id
           ) paid ON paid.order_id = o.id
          WHERE o.client_id = c.id
            AND o.supplier_buyer_id IS NULL
            AND (
              o.source = 'store'
              OR paid.order_id IS NOT NULL
            )
       ) AS has_store_activity,
       EXISTS (
         SELECT 1
           FROM client_journal_entries cje
          WHERE cje.client_id = c.id
            AND cje.order_id IS NULL
       ) AS has_manual_activity
      FROM clients c
      WHERE c.id = ?
      LIMIT 1`,
    [clientId]
  );
  const row = rows[0];
  if (!row) return null;
  const source = row.has_store_activity && row.has_manual_activity
    ? 'mixed'
    : row.has_store_activity
      ? 'store'
      : 'manual';
  await conn.query('UPDATE clients SET source = ? WHERE id = ?', [source, clientId]);
  return source;
}

async function ensureOrderClient(conn, orderId) {
  const [orders] = await conn.query(
    `SELECT o.id, o.client_id, o.supplier_buyer_id, o.customer_name, o.customer_phone, o.customer_email,
            o.address_line1, o.city, o.state, o.country, c.name AS linked_client_name
       FROM orders o
       LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.id = ?
      LIMIT 1
      FOR UPDATE`,
    [orderId]
  );
  const order = orders[0];
  if (!order || order.supplier_buyer_id) return parsePositiveId(order?.client_id);

  const existingClientId = parsePositiveId(order.client_id);
  if (existingClientId && normalizeName(order.linked_client_name) === normalizeName(order.customer_name)) {
    return existingClientId;
  }

  const name = String(order.customer_name || '').trim();
  let client = null;
  if (name) {
    const [clients] = await conn.query(
      'SELECT id, name FROM clients WHERE LOWER(TRIM(name)) = ? ORDER BY id ASC LIMIT 1 FOR UPDATE',
      [normalizeName(name)]
    );
    client = clients[0] || null;
  }

  if (!client) {
    const hasClientSource = await hasTableColumn('clients', 'source');
    const columns = ['name', 'contact_info', 'email', 'phone', 'address_line1', 'city', 'state', 'country', 'account_balance'];
    const values = [
      name || `عميل طلب #${orderId}`,
      String(order.customer_phone || '').trim() || String(order.customer_email || '').trim() || null,
      String(order.customer_email || '').trim() || null,
      String(order.customer_phone || '').trim() || null,
      String(order.address_line1 || '').trim() || null,
      String(order.city || '').trim() || null,
      String(order.state || '').trim() || null,
      String(order.country || '').trim() || 'فلسطين',
      0
    ];
    if (hasClientSource) {
      columns.push('source');
      values.push('store');
    }
    const [result] = await conn.query(
      `INSERT INTO clients (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
    client = { id: result.insertId };
  }

  await conn.query('UPDATE orders SET client_id = ? WHERE id = ?', [client.id, orderId]);
  return parsePositiveId(client.id);
}

async function moveOrderClientJournalEntries(conn, orderId, targetClientId) {
  const [entries] = await conn.query(
    `SELECT id, client_id, transaction_type, amount
       FROM client_journal_entries
      WHERE order_id = ?
      FOR UPDATE`,
    [orderId]
  );

  const moved = [];
  for (const entry of entries) {
    const oldClientId = parsePositiveId(entry.client_id);
    if (!oldClientId || oldClientId === targetClientId) continue;

    const effect = journalBalanceEffect(entry);
    await conn.query('UPDATE clients SET account_balance = account_balance - ? WHERE id = ?', [effect, oldClientId]);
    await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [effect, targetClientId]);
    await conn.query('UPDATE client_journal_entries SET client_id = ? WHERE id = ?', [targetClientId, entry.id]);
    moved.push({
      entry_id: entry.id,
      from_client_id: oldClientId,
      to_client_id: targetClientId,
      transaction_type: entry.transaction_type,
      amount: parseMoney(entry.amount),
      balance_effect: effect
    });
  }

  return moved;
}

async function hasPaidPaymentForOrder(conn, orderId) {
  const [rows] = await conn.query(
    `SELECT id
       FROM payments
      WHERE order_id = ?
        AND LOWER(TRIM(status)) = 'paid'
      LIMIT 1`,
    [orderId]
  );
  return rows.length > 0;
}

async function createClientJournalEntryForOrder(conn, {
  orderId,
  transactionType,
  amount,
  referenceDoc,
  note,
  date
}) {
  const normalizedAmount = parseMoney(amount);
  if (normalizedAmount <= 0) return { created: null, skipped: { reason: 'amount not positive' } };

  const [orders] = await conn.query(
    `SELECT id, client_id
       FROM orders
      WHERE id = ?
        AND client_id IS NOT NULL
        AND created_at >= ?
        AND status = 'delivered'
      LIMIT 1`,
    [orderId, ACCOUNTING_ORDER_CUTOFF]
  );
  const order = orders[0];
  const clientId = parsePositiveId(order?.client_id);
  if (!clientId) return { created: null, skipped: { reason: 'client not found' } };

  const [existing] = await conn.query(
    `SELECT id, amount
       FROM client_journal_entries
      WHERE client_id = ?
        AND order_id = ?
        AND transaction_type = ?
        AND reference_doc = ?
      LIMIT 1
      FOR UPDATE`,
    [clientId, orderId, transactionType, referenceDoc]
  );
  if (existing[0]) {
    const existingAmount = parseMoney(existing[0].amount);
    if (existingAmount !== normalizedAmount) {
      const balanceDelta = transactionType === 'credit'
        ? existingAmount - normalizedAmount
        : normalizedAmount - existingAmount;
      await conn.query('UPDATE client_journal_entries SET amount = ?, note = ?, date = ? WHERE id = ?', [normalizedAmount, note, date, existing[0].id]);
      if (balanceDelta !== 0) {
        await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [balanceDelta, clientId]);
      }
    }
    return { created: null, skipped: { client_id: clientId, total_amount: normalizedAmount, existing_entry_id: existing[0].id, reason: 'already created' } };
  }

  const [clients] = await conn.query('SELECT id, name FROM clients WHERE id = ? LIMIT 1 FOR UPDATE', [clientId]);
  if (!clients[0]) return { created: null, skipped: { client_id: clientId, total_amount: normalizedAmount, reason: 'client not found' } };

  const [result] = await conn.query(
    'INSERT INTO client_journal_entries (client_id, order_id, transaction_type, amount, reference_doc, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [clientId, orderId, transactionType, normalizedAmount, referenceDoc, note, date]
  );
  const effect = transactionType === 'credit' ? -normalizedAmount : normalizedAmount;
  await conn.query('UPDATE clients SET account_balance = account_balance + ? WHERE id = ?', [effect, clientId]);
  return {
    created: {
      id: result.insertId,
      client_id: clientId,
      client_name: clients[0].name,
      transaction_type: transactionType,
      amount: normalizedAmount,
      reference_doc: referenceDoc,
      date
    },
    skipped: null
  };
}

async function createDeliveredOrderAccounting(conn, orderId, date) {
  const [orders] = await conn.query(
    `SELECT id, total, delivery_fee_amount, delivery_payer, delivery_note
       FROM orders
      WHERE id = ?
        AND created_at >= ?
        AND status = 'delivered'
      LIMIT 1`,
    [orderId, ACCOUNTING_ORDER_CUTOFF]
  );
  const order = orders[0];
  if (!order) return { client: null, clientPayment: null, clientDelivery: null };

  const client = await createClientJournalEntryForOrder(conn, {
    orderId,
    transactionType: 'debit',
    amount: order.total,
    referenceDoc: `طلب #${orderId} / فاتورة مبيعات`,
    note: 'فاتورة بيع طلب مسلم',
    date
  });

  const clientPayment = await hasPaidPaymentForOrder(conn, orderId)
    ? await createClientJournalEntryForOrder(conn, {
      orderId,
      transactionType: 'credit',
      amount: order.total,
      referenceDoc: `طلب #${orderId} / دفعة العميل`,
      note: 'دفعة تلقائية عند التسليم والدفع',
      date
    })
    : null;

  const clientDelivery = String(order.delivery_payer || '').trim() === 'customer'
    ? await createClientJournalEntryForOrder(conn, {
      orderId,
      transactionType: 'debit',
      amount: order.delivery_fee_amount,
      referenceDoc: `طلب #${orderId} / توصيل`,
      note: String(order.delivery_note || '').trim() || 'رسوم توصيل على الزبون',
      date
    })
    : null;

  return { client, clientPayment, clientDelivery };
}

async function repairOrder(order, apply) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [lockedOrders] = await conn.query(
      `SELECT o.id, o.client_id, o.customer_name, c.name AS linked_client_name
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
        WHERE o.id = ?
        FOR UPDATE`,
      [order.id]
    );
    const before = lockedOrders[0] || order;
    const beforeClientId = parsePositiveId(before.client_id);
    const beforeName = normalizeName(before.linked_client_name);

    const targetClientId = await ensureOrderClient(conn, order.id);
    let marked_client_source = targetClientId
      ? await markClientSourceForOrder(conn, order, targetClientId)
      : null;
    const moved_journal_entries = targetClientId
      ? await moveOrderClientJournalEntries(conn, order.id, targetClientId)
      : [];
    const accounting = await createDeliveredOrderAccounting(
      conn,
      order.id,
      new Date().toISOString().slice(0, 10)
    );
    if (targetClientId) {
      marked_client_source = await recalculateClientSource(conn, targetClientId);
    }

    const [afterRows] = await conn.query(
      `SELECT o.id, o.client_id, o.customer_name, c.name AS linked_client_name
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
        WHERE o.id = ?`,
      [order.id]
    );
    const after = afterRows[0] || null;

    if (apply) await conn.commit();
    else await conn.rollback();

    return {
      order_id: order.id,
      mode: apply ? 'applied' : 'dry-run',
      before: {
        client_id: beforeClientId,
        client_name: before.linked_client_name || null,
        name_matches: !!beforeName && beforeName === normalizeName(before.customer_name)
      },
      after: after ? {
        client_id: parsePositiveId(after.client_id),
        client_name: after.linked_client_name || null,
        name_matches: normalizeName(after.linked_client_name) === normalizeName(after.customer_name)
      } : null,
      moved_journal_entries,
      marked_client_source,
      accounting: {
        client_invoice: accounting?.client || null,
        client_payment: accounting?.clientPayment || null,
        client_delivery: accounting?.clientDelivery || null
      }
    };
  } catch (error) {
    await conn.rollback();
    return {
      order_id: order.id,
      mode: apply ? 'failed' : 'dry-run-failed',
      error: error.message || String(error)
    };
  } finally {
    conn.release();
  }
}

async function main() {
  const apply = hasArg('--apply');
  const orderId = parsePositiveId(getArgValue('--order-id'));
  const candidates = await findDeliveredOrdersNeedingRepair(orderId);
  const results = [];

  for (const order of candidates) {
    results.push(await repairOrder(order, apply));
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    checked_orders: candidates.length,
    results
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
