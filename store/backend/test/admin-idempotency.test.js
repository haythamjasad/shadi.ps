import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/db.js';
import { __resetAdminIdempotencyForTests, adminIdempotency } from '../src/routes/admin.js';

function makeReq({ key, method = 'POST', body = {}, params = {}, query = {}, admin = { id: 7 } } = {}) {
  return {
    method,
    body,
    params,
    query,
    admin,
    get(name) {
      return String(name).toLowerCase() === 'idempotency-key' ? key : undefined;
    }
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
  return res;
}

function installPoolQueryStub(handler) {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql: String(sql), params });
    return handler(String(sql), params, calls);
  };
  return {
    calls,
    restore() {
      pool.query = originalQuery;
      __resetAdminIdempotencyForTests();
    }
  };
}

async function runMiddleware(req, res, routeKey, next) {
  await adminIdempotency(routeKey)(req, res, next);
}

test('admin idempotency returns cached response for same key, method, route, and body with one side effect', async () => {
  const stored = new Map();
  let sideEffects = 0;
  const stub = installPoolQueryStub(async (sql, params) => {
    if (sql.includes('CREATE TABLE IF NOT EXISTS admin_idempotency_keys')) return [{}];
    if (sql.includes('INSERT IGNORE INTO admin_idempotency_keys')) {
      const recordKey = `${params[0]}:${params[1]}`;
      if (stored.has(recordKey)) return [{ affectedRows: 0 }];
      stored.set(recordKey, { request_hash: params[4], status_code: null, response_json: null });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT request_hash, status_code, response_json')) {
      return [[stored.get(`${params[0]}:${params[1]}`)]];
    }
    if (sql.includes('UPDATE admin_idempotency_keys')) {
      const record = stored.get(`${params[2]}:${params[3]}`);
      Object.assign(record, { status_code: params[0], response_json: params[1] });
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  try {
    const firstReq = makeReq({ key: 'order-create-1', body: { customer: 'Bassem', total: 100 } });
    const firstRes = makeRes();
    await runMiddleware(firstReq, firstRes, 'POST /admin/orders', async () => {
      sideEffects += 1;
      firstRes.status(201).json({ order: { id: 501 } });
    });
    await new Promise((resolve) => setImmediate(resolve));

    const secondReq = makeReq({ key: 'order-create-1', body: { total: 100, customer: 'Bassem' } });
    const secondRes = makeRes();
    await runMiddleware(secondReq, secondRes, 'POST /admin/orders', async () => {
      sideEffects += 1;
      secondRes.status(201).json({ order: { id: 999 } });
    });

    assert.equal(sideEffects, 1);
    assert.equal(secondRes.statusCode, 201);
    assert.deepEqual(secondRes.body, { order: { id: 501 } });
  } finally {
    stub.restore();
  }
});

test('admin idempotency rejects same key with different request body', async () => {
  const requestHash = 'existing-request-hash';
  const stub = installPoolQueryStub(async (sql) => {
    if (sql.includes('CREATE TABLE IF NOT EXISTS admin_idempotency_keys')) return [{}];
    if (sql.includes('INSERT IGNORE INTO admin_idempotency_keys')) return [{ affectedRows: 0 }];
    if (sql.includes('SELECT request_hash, status_code, response_json')) {
      return [[{ request_hash: requestHash, status_code: 200, response_json: '{"ok":true}' }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  try {
    const res = makeRes();
    await runMiddleware(makeReq({ key: 'discount-1', body: { amount: 20 } }), res, 'PUT /admin/orders/:id/discount', async () => {
      throw new Error('next should not run');
    });

    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /different request data/);
  } finally {
    stub.restore();
  }
});

test('admin idempotency rejects duplicate while original request is still processing', async () => {
  const hashByKey = new Map();
  const stub = installPoolQueryStub(async (sql, params) => {
    if (sql.includes('CREATE TABLE IF NOT EXISTS admin_idempotency_keys')) return [{}];
    if (sql.includes('INSERT IGNORE INTO admin_idempotency_keys')) {
      hashByKey.set(`${params[0]}:${params[1]}`, params[4]);
      return [{ affectedRows: 0 }];
    }
    if (sql.includes('SELECT request_hash, status_code, response_json')) {
      return [[{ request_hash: hashByKey.get(`${params[0]}:${params[1]}`), status_code: null, response_json: null }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  try {
    const res = makeRes();
    await runMiddleware(makeReq({ key: 'journal-1', body: { amount: 40 } }), res, 'POST /admin/journal-entries', async () => {
      throw new Error('next should not run');
    });

    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /already processing/);
  } finally {
    stub.restore();
  }
});

test('admin idempotency skips storage and preserves normal behavior when key is missing', async () => {
  const stub = installPoolQueryStub(async (sql) => {
    throw new Error(`Storage should not be touched: ${sql}`);
  });

  try {
    let sideEffects = 0;
    const res = makeRes();
    await runMiddleware(makeReq({ body: { amount: 10 } }), res, 'POST /admin/client-journal-entries', async () => {
      sideEffects += 1;
      res.json({ ok: true });
    });

    assert.equal(sideEffects, 1);
    assert.deepEqual(res.body, { ok: true });
  } finally {
    stub.restore();
  }
});

test('admin idempotency logs response persistence failure without reporting a cached success', async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  const stub = installPoolQueryStub(async (sql) => {
    if (sql.includes('CREATE TABLE IF NOT EXISTS admin_idempotency_keys')) return [{}];
    if (sql.includes('INSERT IGNORE INTO admin_idempotency_keys')) return [{ affectedRows: 1 }];
    if (sql.includes('UPDATE admin_idempotency_keys')) throw new Error('write failed');
    throw new Error(`Unexpected query: ${sql}`);
  });

  try {
    const res = makeRes();
    await runMiddleware(makeReq({ key: 'delivery-1', body: { amount: 25 } }), res, 'PUT /admin/orders/:id/delivery', async () => {
      res.json({ ok: true });
    });
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(res.body, { ok: true });
    assert.equal(errors.length, 1);
    assert.match(String(errors[0][0]), /Failed to persist admin idempotency response/);
  } finally {
    console.error = originalError;
    stub.restore();
  }
});
