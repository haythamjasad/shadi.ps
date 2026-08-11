import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHiddenCategoryExistsExpression,
  getPublicProductVisibilityFilter
} from '../src/routes/products.js';

test('public product visibility hides products assigned to any hidden category', () => {
  const filters = getPublicProductVisibilityFilter('p');
  const sql = filters.join(' AND ');

  assert.ok(sql.includes('p.is_hidden = 0'));
  assert.ok(sql.includes('hidden_category.name = p.category'));
  assert.ok(sql.includes('JSON_VALID(p.categories)'));
  assert.ok(sql.includes('JSON_CONTAINS(p.categories, JSON_QUOTE(hidden_category.name))'));
});

test('hidden category expression can be used in product detail queries', () => {
  const sql = getHiddenCategoryExistsExpression('p');

  assert.match(sql, /EXISTS/);
  assert.ok(sql.includes('hidden_category.is_hidden = 1'));
  assert.ok(sql.includes('p.categories'));
});
