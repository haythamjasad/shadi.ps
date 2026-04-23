import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductImportAnalysis } from '../src/routes/admin.js';

test('applyProductImportAnalysis rolls back the transaction when image persistence fails', async () => {
  let began = false;
  let committed = false;
  let rolledBack = false;
  const queries = [];

  const conn = {
    async beginTransaction() {
      began = true;
    },
    async commit() {
      committed = true;
    },
    async rollback() {
      rolledBack = true;
    },
    async query(sql, params) {
      queries.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
  };

  const analysis = {
    createdCategories: ['Pipes'],
    previewRows: [{
      row: 2,
      action: 'create',
      existingId: null,
      name: 'Copper Pipe',
      category: 'Pipes',
      categories: ['Pipes'],
      description: '',
      usage: '',
      technical_data: '',
      warnings: '',
      price: 15,
      mrp: null,
      is_available: true,
      is_hidden: false,
      show_on_home: false,
      image_url: 'data:image/png;base64,AAAA',
      embeddedImage: ''
    }]
  };

  await assert.rejects(
    () => applyProductImportAnalysis(conn, analysis, '/tmp', () => {
      throw new Error('write failed');
    }),
    /write failed/
  );

  assert.equal(began, true);
  assert.equal(committed, false);
  assert.equal(rolledBack, true);
  assert.match(queries[0].sql, /INSERT INTO categories/);
});
