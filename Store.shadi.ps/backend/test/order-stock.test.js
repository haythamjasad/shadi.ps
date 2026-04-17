import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveStockForItems } from '../src/utils/order.js';

test('reserveStockForItems aggregates duplicate product rows before updating stock', async () => {
  const calls = [];
  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT id, name, stock FROM products')) {
        return [[
          { id: 1, name: 'Pipe', stock: 5 },
          { id: 2, name: 'Valve', stock: 3 }
        ]];
      }
      return [{ affectedRows: 1 }];
    }
  };

  await reserveStockForItems(conn, [
    { productId: 1, quantity: 2 },
    { product_id: 1, quantity: 1 },
    { productId: 2, quantity: 2 }
  ]);

  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.deepEqual(calls[1].params, [3, 1]);
  assert.deepEqual(calls[2].params, [2, 2]);
});

test('reserveStockForItems rejects when available stock is too low', async () => {
  const conn = {
    async query(sql) {
      if (sql.includes('SELECT id, name, stock FROM products')) {
        return [[{ id: 9, name: 'Mixer', stock: 1 }]];
      }
      throw new Error('Unexpected update after stock failure');
    }
  };

  await assert.rejects(
    () => reserveStockForItems(conn, [{ productId: 9, quantity: 2 }]),
    /Insufficient stock for Mixer/
  );
});
