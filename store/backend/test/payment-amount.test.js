import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentAmount, toMinorUnits } from '../src/routes/payments.js';
import { normalizeSupplierDeliveryRows } from '../src/routes/admin.js';

test('Lahza amount conversion sends order totals in minor units', () => {
  assert.equal(toMinorUnits(2400), 240000);
  assert.equal(toMinorUnits('2400.00'), 240000);
  assert.equal(toMinorUnits(2.4), 240);
});

test('payment amount includes delivery fee only when customer pays it', () => {
  assert.equal(calculatePaymentAmount({ total: 255, delivery_fee_amount: 20, delivery_payer: 'customer' }), 275);
  assert.equal(calculatePaymentAmount({ total: 255, delivery_fee_amount: 20, delivery_payer: 'store' }), 255);
  assert.equal(calculatePaymentAmount({ total: 255, delivery_fee_amount: 20, delivery_payer: 'supplier' }), 255);
});

test('supplier delivery rows validate against order suppliers and sum amounts', () => {
  const result = normalizeSupplierDeliveryRows([
    { supplier_id: 1, amount: 10, note: 'A' },
    { supplier_id: 2, amount: '15.50', note: 'B' }
  ], [1, 2, 3]);

  assert.equal(result.totalAmount, 25.5);
  assert.deepEqual(result.rows, [
    { supplier_id: 1, amount: 10, note: 'A' },
    { supplier_id: 2, amount: 15.5, note: 'B' }
  ]);
});

test('supplier delivery rows reject suppliers outside the order', () => {
  assert.throws(
    () => normalizeSupplierDeliveryRows([{ supplier_id: 99, amount: 10 }], [1, 2]),
    /supplier_id must belong to this order/
  );
});

test('supplier delivery rows reject duplicate suppliers', () => {
  assert.throws(
    () => normalizeSupplierDeliveryRows([{ supplier_id: 1, amount: 10 }, { supplier_id: 1, amount: 5 }], [1]),
    /supplier_id must be unique/
  );
});
