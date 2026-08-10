import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveStockForItems } from '../src/utils/order.js';

test('reserveStockForItems does not query or update stock for duplicate product rows', async () => {
  const calls = [];
  const conn = {
    async query(sql, params) {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
  };

  await reserveStockForItems(conn, [
    { productId: 1, quantity: 2 },
    { product_id: 1, quantity: 1 },
    { productId: 2, quantity: 2 }
  ]);

  assert.deepEqual(calls, []);
});

test('reserveStockForItems succeeds even when stored stock would be empty', async () => {
  let queried = false;
  const conn = {
    async query() {
      queried = true;
      throw new Error('Stock should not be checked');
    }
  };

  await reserveStockForItems(conn, [
    { productId: 9, quantity: 2 },
    { productId: 10, quantity: 3 },
    { productId: 11, quantity: 4 }
  ]);

  assert.equal(queried, false);
});
