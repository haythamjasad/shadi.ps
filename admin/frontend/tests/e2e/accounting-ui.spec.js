import { expect, test } from '@playwright/test';

const admin = {
  id: 1,
  email: 'admin@example.test',
  is_super_admin: true,
  permissions: {}
};

const suppliers = [
  { id: 1, name: 'مورد بيست براس', contact_info: '0562815825', product_count: 20, account_balance: 70 }
];

const clients = [
  { id: 5, name: 'بسام نزال', phone: '0595471476', email: 'bassam@example.test', source: 'manual', account_balance: 1350 }
];

const supplierReport = {
  summary: {},
  rows: [{
    supplier_id: 1,
    supplier_name: 'مورد بيست براس',
    contact_info: '0562815825',
    products_count: 20,
    total_sales: 480,
    purchase_total: 300,
    total_purchases: 300,
    net_profit: 180,
    total_payments: 50,
    net_movement: 70,
    current_outstanding_balance: 70,
    product_names: 'Pegoland Flex',
    order_refs: 'طلب #501'
  }]
};

const clientReport = {
  summary: {},
  rows: [{
    client_id: 5,
    client_name: 'بسام نزال',
    phone: '0595471476',
    email: 'bassam@example.test',
    source: 'manual',
    orders_count: 1,
    total_sales: 1350,
    total_receipts: 200,
    net_movement: 1150,
    net_profit: 254,
    purchase_total: 896,
    current_outstanding_balance: 1350,
    last_order_at: '2026-08-01T10:00:00.000Z',
    product_names: 'Pegoland Flex',
    order_refs: 'طلب #501'
  }]
};

const customerReport = {
  summary: {},
  rows: [{
    customer_key: 'store-osama',
    customer_name: 'Osamma ahmad',
    customer_phone: '0525557164',
    customer_email: 'osama@example.test',
    orders_count: 1,
    items_quantity: 2,
    gross_sales: 600,
    discounts_total: 74.4,
    net_sales: 525.6,
    purchase_total: 300,
    net_profit: 225.6,
    last_order_at: '2026-08-03T11:00:00.000Z',
    product_names: 'Store Product',
    order_refs: 'طلب #700'
  }]
};

const supplierStatement = {
  supplier: { id: 1, name: 'مورد بيست براس', account_balance: 70 },
  rows: [
    {
      id: 10,
      supplier_id: 1,
      transaction_type: 'credit',
      voucher_type: 'purchase_invoice',
      amount: 120,
      date: '2026-08-01',
      created_at: '2026-08-01T08:30:00.000Z',
      running_balance: 120,
      reference_doc: 'فاتورة #10',
      product_names: 'Pegoland Flex',
      note: 'فاتورة شراء',
      items: [{ product_name: 'Pegoland Flex', quantity: 3, unit_price: 160, purchase_price: 100, profit_total: 180, purchase_total: 300 }]
    },
    {
      id: 11,
      supplier_id: 1,
      transaction_type: 'debit',
      voucher_type: 'supplier_payment',
      amount: 50,
      date: '2026-08-02',
      created_at: '2026-08-02T09:00:00.000Z',
      running_balance: 70,
      reference_doc: 'دفعة #11',
      note: 'دفعة للمورد',
      items: []
    }
  ]
};

const clientStatement = {
  client: { id: 5, name: 'بسام نزال', account_balance: 1350 },
  rows: [
    {
      id: 30,
      client_id: 5,
      order_id: 501,
      transaction_type: 'debit',
      voucher_type: 'sales_invoice',
      amount: 1350,
      date: '2026-08-01',
      created_at: '2026-08-01T10:00:00.000Z',
      running_balance: 1350,
      reference_doc: 'طلب #501',
      product_names: 'Pegoland Flex',
      note: 'فاتورة بيع',
      items: []
    },
    {
      id: 31,
      client_id: 5,
      transaction_type: 'credit',
      voucher_type: 'client_receipt',
      amount: 200,
      date: '2026-08-02',
      created_at: '2026-08-02T10:00:00.000Z',
      running_balance: 1150,
      reference_doc: 'قبض #31',
      note: 'دفعة',
      items: []
    }
  ]
};

const customerOrders = {
  customer_key: 'store-osama',
  summary: { orders_count: 1, items_quantity: 2, gross_sales: 600, subtotal: 600, discount_amount: 74.4, total: 525.6 },
  rows: [{
    order_id: 700,
    created_at: '2026-08-03T11:00:00.000Z',
    status: 'delivered',
    product_name: 'Store Product',
    quantity: 2,
    unit_price: 300,
    purchase_price: 150,
    line_total: 600,
    purchase_total: 300,
    discount_amount: 74.4,
    total: 525.6,
    profit_total: 225.6
  }]
};

const order501 = {
  order: { id: 501, status: 'delivered', subtotal: 1350, discount_amount: 0, total: 1350 },
  items: [{ id: 1, product_name: 'Pegoland Flex', quantity: 3, unit_price: 450, purchase_price: 300, profit_total: 450 }]
};

const order700 = {
  order: { id: 700, status: 'delivered', subtotal: 600, discount_amount: 74.4, total: 525.6 },
  items: [{ id: 2, product_name: 'Store Product', quantity: 2, unit_price: 300, purchase_price: 150, profit_total: 225.6 }]
};

const supplierInvoice = {
  invoice: { id: 10, supplier_id: 1, supplier_name: 'مورد بيست براس', reference_doc: 'فاتورة #10', amount: 120 },
  rows: [{ order_item_id: 1, order_id: 501, product_name: 'Pegoland Flex', customer_name: 'بسام نزال', quantity: 3, unit_price: 160, purchase_price: 100, profit_total: 180, purchase_total: 300, created_at: '2026-08-01T08:30:00.000Z' }]
};

const supplierJournal = supplierStatement.rows.map((row) => ({
  ...row,
  supplier_name: 'مورد بيست براس',
  voucherScope: 'supplier'
}));

const clientJournal = clientStatement.rows.map((row) => ({
  ...row,
  client_name: 'بسام نزال',
  voucherScope: 'client'
}));

async function setupAccountingMocks(page) {
  await page.addInitScript(() => {
    localStorage.setItem('admin_token', 'mock-token');
    localStorage.setItem('admin_session_started_at', String(Date.now()));
  });

  await page.route('**/api/v01/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v01', '');
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/admin/me') return json({ ...admin, token: 'mock-token' });
    if (path === '/admin/suppliers') return json(suppliers);
    if (path === '/admin/clients') return json(clients);
    if (path === '/admin/purchasing/orders') return json([]);
    if (path === '/admin/journal-entries') return json(supplierJournal);
    if (path === '/admin/client-journal-entries') return json(clientJournal);
    if (path === '/admin/purchasing/reports/suppliers') return json(supplierReport);
    if (path === '/admin/purchasing/reports/clients') return json(clientReport);
    if (path === '/admin/purchasing/reports/customers') return json(customerReport);
    if (path === '/admin/purchasing/reports/suppliers/1/statement') return json(supplierStatement);
    if (path === '/admin/purchasing/reports/clients/5/statement') return json(clientStatement);
    if (path === '/admin/purchasing/reports/customers/store-osama/orders') return json(customerOrders);
    if (path === '/admin/orders/501') return json(order501);
    if (path === '/admin/orders/700') return json(order700);
    if (path === '/admin/suppliers/1/purchase-invoices/10') return json(supplierInvoice);
    if (path.endsWith('/export')) {
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="mock-report.xlsx"'
        },
        body: 'mock-export'
      });
    }
    return json([]);
  });
}

async function openAccounting(page) {
  await setupAccountingMocks(page);
  await page.goto('/?tab=purchasing');
  await expect(page.getByRole('heading', { name: 'المشتريات والمحاسبة' })).toBeVisible({ timeout: 15_000 });
}

test('renders compact accounting lists and opens supplier statement view', async ({ page }) => {
  await openAccounting(page);

  await expect(page.getByRole('columnheader', { name: 'المورد' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'صافي الحركة' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'الرصيد' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'صافي الربح' })).toHaveCount(0);

  const supplierRow = page.locator('tbody tr', { hasText: 'مورد بيست براس' }).first();
  await supplierRow.getByRole('button', { name: 'عرض الكشف' }).click();
  await expect(page.getByRole('heading', { name: 'كشف حساب المورد: مورد بيست براس' })).toBeVisible();
  await expect(page.locator('.accounting-statement-view table')).toHaveCount(0);
  await expect(page.getByText('إجمالي البيع')).toBeVisible();
  await expect(page.locator('.accounting-statement-view').getByText('مدين').first()).toBeVisible();
  await expect(page.locator('.accounting-statement-view').getByText('دائن').first()).toBeVisible();
  await expect(page.locator('.accounting-statement-view').getByText('70.00').first()).toBeVisible();

  await page.getByRole('button', { name: 'التفاصيل' }).first().click();
  await expect(page.getByRole('heading', { name: 'تفاصيل الحركة' })).toBeVisible();
  await expect(page.locator('.accounting-detail-modal').getByText('Pegoland Flex').first()).toBeVisible();
  await expect(page.locator('.accounting-detail-modal').getByText('سعر الشراء').first()).toBeVisible();
});

test('opens customer statement, preserves list state, and keeps export available', async ({ page }) => {
  await openAccounting(page);
  await page.getByRole('button', { name: 'العملاء' }).click();
  const filterToggle = page.getByRole('button', { name: /البحث والفلاتر/ });
  if (await filterToggle.isVisible()) await filterToggle.click();
  await page.getByPlaceholder('بحث عن عميل أو فاتورة أو صنف منتج').fill('بسام');

  const customerRow = page.locator('tbody tr', { hasText: 'بسام نزال' }).first();
  await expect(customerRow).toBeVisible();
  await customerRow.getByRole('button', { name: 'عرض الكشف' }).click();

  await expect(page.getByRole('heading', { name: 'كشف حساب العميل: بسام نزال' })).toBeVisible();
  await expect(page.getByText('الصافي المستحق')).toBeVisible();
  await expect(page.getByText('1,150.00').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'تصدير الكشف Excel' })).toBeVisible();

  await page.getByRole('button', { name: 'التفاصيل' }).first().click();
  await expect(page.getByRole('heading', { name: 'تفاصيل الحركة' })).toBeVisible();
  const customerModal = page.locator('.accounting-detail-modal');
  await expect(customerModal.getByText('رقم الطلب')).toBeVisible();
  await expect(customerModal.getByText('#501').first()).toBeVisible();
  await expect(customerModal.getByText('Pegoland Flex').first()).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق' }).click();

  await page.getByRole('button', { name: 'رجوع للقائمة' }).click();
  await expect(page.getByPlaceholder('بحث عن عميل أو فاتورة أو صنف منتج')).toHaveValue('بسام');
  await expect(customerRow).toBeVisible();
});

test('uses a modal for voucher details instead of inline rows', async ({ page }) => {
  await openAccounting(page);
  await page.getByRole('button', { name: 'السندات' }).click();
  await expect(page.getByRole('columnheader', { name: 'المرجع' })).toBeVisible();
  await expect(page.locator('.responsive-detail-cell')).toHaveCount(0);

  await page.locator('tbody tr', { hasText: 'فاتورة #10' }).first().getByRole('button', { name: 'التفاصيل' }).click();
  await expect(page.getByRole('heading', { name: 'تفاصيل فاتورة الشراء' })).toBeVisible();
  const modal = page.locator('.accounting-detail-modal');
  await expect(modal.getByText('مورد بيست براس').first()).toBeVisible();
  await expect(modal.getByText('Pegoland Flex').first()).toBeVisible();
});

test('mobile statement layout uses labelled cards without nested statement tables', async ({ page }) => {
  await openAccounting(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('tbody tr', { hasText: 'مورد بيست براس' }).first().getByRole('button', { name: 'عرض الكشف' }).click();

  await expect(page.getByRole('heading', { name: 'كشف حساب المورد: مورد بيست براس' })).toBeVisible();
  await expect(page.locator('.accounting-statement-view table')).toHaveCount(0);
  await expect(page.locator('.statement-ledger-entry').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'رجوع للقائمة' })).toBeVisible();
});
