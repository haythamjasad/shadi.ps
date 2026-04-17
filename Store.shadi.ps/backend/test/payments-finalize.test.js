import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizePaidPaymentTransaction } from '../src/routes/payments.js';

test('finalizePaidPaymentTransaction reserves stock and updates existing paid order state', async () => {
  const calls = [];
  let committed = false;
  let rolledBack = false;
  let reservedItems = null;

  const conn = {
    async beginTransaction() {
      calls.push('begin');
    },
    async commit() {
      committed = true;
      calls.push('commit');
    },
    async rollback() {
      rolledBack = true;
      calls.push('rollback');
    },
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM payments') && sql.includes('FOR UPDATE')) {
        return [[{
          id: 9,
          order_id: 55,
          amount: 120,
          status: 'initiated',
          transaction_id: 'ref-1',
          raw_response: null,
          order_payload: null
        }]];
      }
      if (sql.includes('FROM order_items WHERE order_id = ?')) {
        return [[{
          id: 1,
          order_id: 55,
          product_id: 7,
          product_name: 'Pipe',
          quantity: 2,
          unit_price: 60,
          line_total: 120
        }]];
      }
      return [{ affectedRows: 1 }];
    }
  };

  const result = await finalizePaidPaymentTransaction({
    conn,
    paymentId: 9,
    verified: {
      ok: true,
      amountMinor: 12000,
      currency: 'ILS',
      reference: 'ref-1',
      raw: { status: true }
    },
    fallbackReference: 'ref-1',
    lahzaSettings: { currency: 'ILS' },
    deps: {
      reserveStockForItems: async (_conn, items) => {
        reservedItems = items;
      }
    }
  });

  assert.equal(result.orderId, 55);
  assert.equal(result.shouldSendNotifications, true);
  assert.deepEqual(reservedItems, [{
    id: 1,
    order_id: 55,
    product_id: 7,
    product_name: 'Pipe',
    quantity: 2,
    unit_price: 60,
    line_total: 120
  }]);
  assert.equal(committed, true);
  assert.equal(rolledBack, false);
  assert.ok(calls.some((entry) => typeof entry === 'object' && String(entry.sql).startsWith('UPDATE orders SET status = ?')));
  assert.ok(calls.some((entry) => typeof entry === 'object' && String(entry.sql).startsWith('UPDATE payments SET status = ?')));
});
