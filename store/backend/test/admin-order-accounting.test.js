import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/db.js';
import {
  createDeliveredOrderAccounting,
  ensureStoreOrderClientForAccounting,
  reverseOrderAccounting,
  syncClientDeliveryVoucherForOrder,
  syncSupplierDeliveryVouchersForOrder
} from '../src/routes/admin.js';

function stubSchemaColumns() {
  const originalQuery = pool.query;
  pool.query = async (sql) => {
    if (String(sql).includes('INFORMATION_SCHEMA.COLUMNS')) {
      return [[{ ok: 1 }]];
    }
    return originalQuery.call(pool, sql);
  };
  return () => {
    pool.query = originalQuery;
  };
}

test('ensureStoreOrderClientForAccounting creates and links a client for store orders', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (String(sql).includes('FROM orders')) {
        return [[{
          id: 41,
          client_id: null,
          supplier_buyer_id: null,
          customer_name: 'Store Customer',
          customer_phone: '0599000000',
          customer_email: 'customer@example.com',
          address_line1: 'Main street',
          city: 'Ramallah',
          state: '',
          country: 'فلسطين'
        }]];
      }
      if (String(sql).includes('FROM payments')) return [[]];
      if (String(sql).includes('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ?')) return [[]];
      if (String(sql).includes('SELECT id, name, email, phone FROM clients WHERE phone = ?')) return [[]];
      if (String(sql).includes('SELECT id, name, email, phone FROM clients WHERE email = ?')) return [[]];
      if (String(sql).includes('INSERT INTO clients')) return [{ insertId: 77 }];
      if (String(sql).includes('UPDATE orders SET client_id')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  try {
    const clientId = await ensureStoreOrderClientForAccounting(conn, 41);

    assert.equal(clientId, 77);
    assert.ok(calls.some((call) => String(call.sql).includes('INSERT INTO clients')));
    assert.ok(calls.some((call) => String(call.sql).includes('UPDATE orders SET client_id = ? WHERE id = ?')));
  } finally {
    restorePool();
  }
});

test('ensureStoreOrderClientForAccounting recreates and relinks when saved client_id is missing', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);
      if (statement.includes('FROM orders')) {
        return [[{
          id: 42,
          client_id: 12,
          supplier_buyer_id: null,
          customer_name: 'Relink Customer',
          customer_phone: '0599222222',
          customer_email: 'relink@example.com',
          address_line1: 'Second street',
          city: 'Hebron',
          state: '',
          country: 'فلسطين'
        }]];
      }
      if (statement.includes('FROM payments')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE id = ?')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ?')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE phone = ?')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE email = ?')) return [[]];
      if (statement.includes('INSERT INTO clients')) return [{ insertId: 78 }];
      if (statement.includes('UPDATE orders SET client_id')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  try {
    const clientId = await ensureStoreOrderClientForAccounting(conn, 42);

    assert.equal(clientId, 78);
    assert.ok(calls.some((call) => String(call.sql).includes('SELECT id, name, email, phone FROM clients WHERE id = ? LIMIT 1 FOR UPDATE')));
    assert.ok(calls.some((call) => String(call.sql).includes('INSERT INTO clients')));
    assert.ok(calls.some((call) => String(call.sql).includes('UPDATE orders SET client_id = ? WHERE id = ?')));
  } finally {
    restorePool();
  }
});

test('ensureStoreOrderClientForAccounting relinks when saved client belongs to another customer', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);
      if (statement.includes('FROM orders')) {
        return [[{
          id: 188,
          client_id: 6,
          supplier_buyer_id: null,
          customer_name: 'بسام نزال',
          customer_phone: '0595471476',
          customer_email: 'nill@nill.com',
          address_line1: 'رام الله',
          city: 'رام الله',
          state: '',
          country: 'فلسطين'
        }]];
      }
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE id = ?')) {
        return [[{
          id: 6,
          name: 'محمد مجاهد كفرعقب',
          phone: '0543376474',
          email: 'nill@nill.com'
        }]];
      }
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ?')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE phone = ?')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE email = ?')) {
        throw new Error('placeholder email should not be used for customer lookup');
      }
      if (statement.includes('FROM payments')) return [[]];
      if (statement.includes('INSERT INTO clients')) return [{ insertId: 209 }];
      if (statement.includes('UPDATE orders SET client_id')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  try {
    const clientId = await ensureStoreOrderClientForAccounting(conn, 188);

    assert.equal(clientId, 209);
    assert.ok(calls.some((call) => String(call.sql).includes('SELECT id, name, email, phone FROM clients WHERE id = ? LIMIT 1 FOR UPDATE')));
    assert.ok(calls.some((call) => String(call.sql).includes('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ? ORDER BY id ASC LIMIT 1 FOR UPDATE')));
    assert.ok(calls.some((call) => String(call.sql).includes('INSERT INTO clients')));
    assert.ok(calls.some((call) => String(call.sql).includes('UPDATE orders SET client_id = ? WHERE id = ?')));
  } finally {
    restorePool();
  }
});

test('createDeliveredOrderAccounting links a store order client before creating the invoice', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  let linkedClientId = null;

  const deliveredOrder = {
    id: 52,
    client_id: null,
    supplier_buyer_id: null,
    customer_name: 'Delivered Customer',
    customer_phone: '0599111111',
    customer_email: 'delivered@example.com',
    address_line1: 'Market road',
    city: 'Nablus',
    state: '',
    country: 'فلسطين',
    total: 120,
    delivery_fee_amount: 0,
    delivery_payer: null,
    status: 'delivered',
    created_at: '2026-07-01 10:00:00'
  };

  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);

      if (statement.includes('FROM orders') && statement.includes("status = 'delivered'")) {
        return [[{ ...deliveredOrder, client_id: linkedClientId }]];
      }
      if (statement.includes('FROM order_items')) return [[]];
      if (statement.includes('FROM payments')) return [[]];
      if (statement.includes('FROM orders')) {
        return [[{ ...deliveredOrder, client_id: linkedClientId }]];
      }
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ?')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE phone = ?')) return [[]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE email = ?')) return [[]];
      if (statement.includes('INSERT INTO clients')) {
        linkedClientId = 88;
        return [{ insertId: linkedClientId }];
      }
      if (statement.includes('UPDATE orders SET client_id')) {
        linkedClientId = params[0];
        return [{ affectedRows: 1 }];
      }
      if (statement.includes('FROM client_journal_entries')) return [[]];
      if (statement.includes('SELECT id, name FROM clients')) return [[{ id: linkedClientId, name: 'Delivered Customer' }]];
      if (statement.includes('INSERT INTO client_journal_entries')) return [{ insertId: 301 }];
      if (statement.includes('UPDATE clients SET account_balance')) return [{ affectedRows: 1 }];
      if (statement.includes('FROM journal_entries')) return [[]];
      if (statement.includes('FROM order_supplier_deliveries')) return [[]];
      throw new Error(`Unexpected query: ${statement}`);
    }
  };

  try {
    const result = await createDeliveredOrderAccounting(conn, 52, '2026-07-01');

    const linkIndex = calls.findIndex((call) => String(call.sql).includes('UPDATE orders SET client_id'));
    const invoiceIndex = calls.findIndex((call) => String(call.sql).includes('INSERT INTO client_journal_entries'));
    assert.ok(linkIndex >= 0);
    assert.ok(invoiceIndex > linkIndex);
    assert.equal(result.client.created.client_id, 88);
  } finally {
    restorePool();
  }
});

test('createDeliveredOrderAccounting creates a client payment for already-paid store orders', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  let linkedClientId = null;

  const deliveredOrder = {
    id: 71,
    client_id: null,
    supplier_buyer_id: null,
    source: 'store',
    customer_name: 'Paid Store Customer',
    customer_phone: '0599333333',
    customer_email: 'paid@example.com',
    address_line1: 'Store street',
    city: 'Ramallah',
    state: '',
    country: 'فلسطين',
    total: 520,
    delivery_fee_amount: 0,
    delivery_payer: null,
    status: 'delivered',
    created_at: '2026-07-01 10:00:00'
  };

  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);

      if (statement.includes('FROM orders') && statement.includes("status = 'delivered'")) {
        return [[{ ...deliveredOrder, client_id: linkedClientId }]];
      }
      if (statement.includes('FROM order_items')) return [[]];
      if (statement.includes('FROM orders')) return [[{ ...deliveredOrder, client_id: linkedClientId }]];
      if (statement.includes('FROM payments')) return [[{ id: 401 }]];
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ?')) return [[]];
      if (statement.includes('INSERT INTO clients')) {
        linkedClientId = 91;
        return [{ insertId: linkedClientId }];
      }
      if (statement.includes('UPDATE orders SET client_id')) {
        linkedClientId = params[0];
        return [{ affectedRows: 1 }];
      }
      if (statement.includes('FROM client_journal_entries')) return [[]];
      if (statement.includes('SELECT id, name FROM clients')) return [[{ id: linkedClientId, name: 'Paid Store Customer' }]];
      if (statement.includes('INSERT INTO client_journal_entries')) return [{ insertId: params[2] === 'credit' ? 402 : 401 }];
      if (statement.includes('UPDATE clients SET account_balance')) return [{ affectedRows: 1 }];
      if (statement.includes('FROM journal_entries')) return [[]];
      if (statement.includes('FROM order_supplier_deliveries')) return [[]];
      throw new Error(`Unexpected query: ${statement}`);
    }
  };

  try {
    const result = await createDeliveredOrderAccounting(conn, 71, '2026-08-02');

    assert.equal(result.client.created.client_id, 91);
    assert.equal(result.clientPayment.created.client_id, 91);
    assert.equal(result.clientPayment.created.transaction_type, 'credit');
    assert.equal(result.clientPayment.created.amount, 520);
    assert.ok(calls.some((call) => String(call.sql).includes('FROM payments')));
  } finally {
    restorePool();
  }
});

test('createDeliveredOrderAccounting moves existing wrong client journals to the name-matched client', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  let linkedClientId = 6;

  const deliveredOrder = {
    id: 188,
    client_id: linkedClientId,
    supplier_buyer_id: null,
    customer_name: 'بسام نزال',
    customer_phone: '0595471476',
    customer_email: 'nill@nill.com',
    address_line1: 'رام الله',
    city: 'رام الله',
    state: '',
    country: 'فلسطين',
    total: 1280,
    delivery_fee_amount: 70,
    delivery_payer: 'customer',
    delivery_note: null,
    status: 'delivered',
    created_at: '2026-07-22 09:01:17'
  };

  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);

      if (statement.includes('FROM orders') && statement.includes("status = 'delivered'")) {
        return [[{ ...deliveredOrder, client_id: linkedClientId }]];
      }
      if (statement.includes('FROM order_items')) return [[]];
      if (statement.includes('FROM payments')) return [[]];
      if (statement.includes('FROM orders')) {
        return [[{ ...deliveredOrder, client_id: linkedClientId }]];
      }
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE id = ?')) {
        return [[{ id: 6, name: 'محمد مجاهد كفرعقب', email: 'nill@nill.com', phone: '0543376474' }]];
      }
      if (statement.includes('SELECT id, name, email, phone FROM clients WHERE LOWER(TRIM(name)) = ?')) {
        return [[{ id: 28, name: 'بسام نزال', email: 'nill@nill.com', phone: '0595471476' }]];
      }
      if (statement.includes('UPDATE orders SET client_id')) {
        linkedClientId = params[0];
        return [{ affectedRows: 1 }];
      }
      if (statement.includes('SELECT id, client_id, transaction_type, amount') && statement.includes('FROM client_journal_entries')) {
        return [[
          { id: 97, client_id: 6, transaction_type: 'debit', amount: 1280 },
          { id: 98, client_id: 6, transaction_type: 'debit', amount: 70 }
        ]];
      }
      if (statement.includes('UPDATE client_journal_entries SET client_id')) return [{ affectedRows: 1 }];
      if (statement.includes('UPDATE client_journal_entries') && statement.includes('SET amount = ?')) return [{ affectedRows: 1 }];
      if (statement.includes('UPDATE clients SET account_balance')) return [{ affectedRows: 1 }];
      if (statement.includes('UPDATE clients') && statement.includes('SET source')) return [{ affectedRows: 1 }];
      if (statement.includes('FROM client_journal_entries')) {
        const referenceDoc = params[2];
        return [[{
          id: String(referenceDoc || '').includes('توصيل') ? 98 : 97,
          amount: String(referenceDoc || '').includes('توصيل') ? 70 : 1280
        }]];
      }
      if (statement.includes('SELECT id, name FROM clients')) return [[{ id: 28, name: 'بسام نزال' }]];
      if (statement.includes('FROM journal_entries')) return [[]];
      if (statement.includes('FROM order_supplier_deliveries')) return [[]];
      throw new Error(`Unexpected query: ${statement}`);
    }
  };

  try {
    const result = await createDeliveredOrderAccounting(conn, 188, '2026-08-02');

    assert.equal(linkedClientId, 28);
    assert.equal(result.movedClientEntries.length, 2);
    assert.deepEqual(result.movedClientEntries.map((entry) => entry.entry_id), [97, 98]);
    assert.ok(calls.some((call) => String(call.sql).includes('UPDATE client_journal_entries SET client_id = ? WHERE id = ?')));
    assert.equal(result.client.skipped.client_id, 28);
    assert.equal(result.clientDelivery.skipped.client_id, 28);
  } finally {
    restorePool();
  }
});

test('syncClientDeliveryVoucherForOrder updates existing delivery voucher and applies only balance delta', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  const order = {
    id: 301,
    client_id: 44,
    supplier_buyer_id: null,
    status: 'delivered',
    delivery_fee_amount: 95,
    delivery_payer: 'customer',
    delivery_note: 'توصيل للزبون'
  };

  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);
      if (statement.includes('FROM orders')) return [[order]];
      if (statement.includes('FROM client_journal_entries') && statement.includes('LIMIT 1')) {
        return [[{ id: 7001, amount: 75 }]];
      }
      if (statement.includes('UPDATE client_journal_entries')) return [{ affectedRows: 1 }];
      if (statement.includes('UPDATE clients SET account_balance')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${statement}`);
    }
  };

  try {
    const result = await syncClientDeliveryVoucherForOrder(conn, 301, '2026-08-10');

    assert.equal(result.created, null);
    assert.equal(result.skipped.existing_entry_id, 7001);
    assert.equal(calls.filter((call) => String(call.sql).includes('INSERT INTO client_journal_entries')).length, 0);
    assert.deepEqual(
      calls.find((call) => String(call.sql).includes('UPDATE clients SET account_balance'))?.params,
      [20, 44]
    );
  } finally {
    restorePool();
  }
});

test('syncSupplierDeliveryVouchersForOrder reverses old supplier delivery voucher before creating current one', async () => {
  const restorePool = stubSchemaColumns();
  const calls = [];
  const order = {
    id: 302,
    status: 'delivered',
    delivery_fee_amount: 40,
    delivery_payer: 'supplier',
    delivery_note: ''
  };

  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);
      if (statement.includes('FROM orders')) return [[order]];
      if (statement.includes('FROM journal_entries') && statement.includes('FOR UPDATE')) {
        return [[{ id: 801, supplier_id: 9, amount: 10 }]];
      }
      if (statement.includes('DELETE FROM journal_entries')) return [{ affectedRows: 1 }];
      if (statement.includes('FROM order_supplier_deliveries')) {
        return [[{ id: 1, order_id: 302, supplier_id: 9, supplier_name: 'مورد', amount: 40, note: 'نقل' }]];
      }
      if (statement.includes('SELECT id, name FROM suppliers')) return [[{ id: 9, name: 'مورد' }]];
      if (statement.includes('INSERT INTO journal_entries')) return [{ insertId: 802 }];
      if (statement.includes('UPDATE suppliers SET account_balance')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${statement}`);
    }
  };

  try {
    const result = await syncSupplierDeliveryVouchersForOrder(conn, 302, '2026-08-10');

    assert.equal(result.reversed, 1);
    assert.equal(result.created.length, 1);
    assert.equal(calls.filter((call) => String(call.sql).includes('INSERT INTO journal_entries')).length, 1);
    assert.deepEqual(
      calls.filter((call) => String(call.sql).includes('UPDATE suppliers SET account_balance')).map((call) => call.params),
      [[10, 9], [40, 9]]
    );
  } finally {
    restorePool();
  }
});

test('reverseOrderAccounting restores supplier and client balances without deleting manual client credits', async () => {
  const calls = [];
  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      const statement = String(sql);
      if (statement.includes('FROM journal_entries')) {
        return [[
          { id: 1, supplier_id: 5, transaction_type: 'credit', amount: 160 },
          { id: 2, supplier_id: 6, transaction_type: 'debit', amount: 25 }
        ]];
      }
      if (statement.includes('FROM client_journal_entries')) {
        return [[
          { id: 3, client_id: 8, transaction_type: 'debit', amount: 300, note: 'فاتورة بيع طلب مسلم' },
          { id: 4, client_id: 8, transaction_type: 'credit', amount: 300, note: 'دفعة تلقائية عند التسليم والدفع' },
          { id: 5, client_id: 8, transaction_type: 'credit', amount: 50, note: 'دفعة يدوية' }
        ]];
      }
      if (statement.includes('UPDATE suppliers SET account_balance')) return [{ affectedRows: 1 }];
      if (statement.includes('UPDATE clients SET account_balance')) return [{ affectedRows: 1 }];
      if (statement.includes('DELETE FROM journal_entries')) return [{ affectedRows: 2 }];
      if (statement.includes('DELETE FROM client_journal_entries')) return [{ affectedRows: 1 }];
      if (statement.includes('UPDATE client_journal_entries SET order_id = NULL')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${statement}`);
    }
  };

  const result = await reverseOrderAccounting(conn, 303);

  assert.deepEqual(result, { supplier_entries: 2, client_entries: 3 });
  assert.deepEqual(
    calls.filter((call) => String(call.sql).includes('UPDATE suppliers SET account_balance')).map((call) => call.params),
    [[-160, 5], [25, 6]]
  );
  assert.deepEqual(
    calls.filter((call) => String(call.sql).includes('UPDATE clients SET account_balance')).map((call) => call.params),
    [[300, 8], [300, 8]]
  );
  assert.ok(calls.some((call) => String(call.sql).includes('UPDATE client_journal_entries SET order_id = NULL')));
});
