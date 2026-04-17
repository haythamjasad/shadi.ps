import pool from '../src/db.js';
import { cleanupCreatedProductDocs, persistProductDocs } from '../src/utils/product-docs.js';

function printUsage() {
  console.log('Usage: node scripts/migrate-legacy-product-docs.js [--apply] [--product=ID] [--limit=N]');
  console.log('');
  console.log('Options:');
  console.log('  --apply       Persist converted docs to the database');
  console.log('  --product=ID  Only process one product id');
  console.log('  --limit=N     Process at most N matching products');
  console.log('  --help        Show this message');
}

function parseArgs(argv) {
  const options = {
    apply: false,
    productId: null,
    limit: null,
    help: false
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg.startsWith('--product=')) {
      const value = Number(arg.slice('--product='.length));
      if (Number.isInteger(value) && value > 0) {
        options.productId = value;
        continue;
      }
      throw new Error(`Invalid --product value: ${arg}`);
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (Number.isInteger(value) && value > 0) {
        options.limit = value;
        continue;
      }
      throw new Error(`Invalid --limit value: ${arg}`);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseJsonField(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asDocsArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function getDocUrl(entry) {
  if (typeof entry === 'string') return entry.trim();
  if (!entry || typeof entry !== 'object') return '';
  return String(entry.url || entry.href || entry.path || entry.dataUrl || '').trim();
}

function isLegacyPdfDoc(entry) {
  return /^data:application\/pdf(?:;[^,]*)?,/i.test(getDocUrl(entry));
}

async function loadProducts({ productId, limit }) {
  const clauses = ['docs IS NOT NULL'];
  const params = [];

  if (productId) {
    clauses.push('id = ?');
    params.push(productId);
  }

  let sql = `SELECT id, name, docs FROM products WHERE ${clauses.join(' AND ')} ORDER BY id ASC`;
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const [rows] = await pool.query(sql, params);
  return rows;
}

async function migrateProduct(row, apply) {
  const docs = asDocsArray(parseJsonField(row.docs));
  const legacyCount = docs.filter(isLegacyPdfDoc).length;

  if (legacyCount === 0) {
    return { productId: row.id, migrated: false, legacyCount: 0 };
  }

  const { docs: normalizedDocs, createdUrls } = await persistProductDocs(docs);

  if (!apply) {
    await cleanupCreatedProductDocs(createdUrls);
    return {
      productId: row.id,
      migrated: false,
      legacyCount,
      convertedCount: legacyCount,
      dryRun: true
    };
  }

  try {
    await pool.query('UPDATE products SET docs = ? WHERE id = ?', [
      normalizedDocs.length ? JSON.stringify(normalizedDocs) : null,
      row.id
    ]);

    return {
      productId: row.id,
      migrated: true,
      legacyCount,
      convertedCount: legacyCount
    };
  } catch (error) {
    await cleanupCreatedProductDocs(createdUrls);
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const rows = await loadProducts(options);
  let checked = 0;
  let matched = 0;
  let migrated = 0;
  let convertedDocs = 0;

  console.log(options.apply
    ? 'Applying legacy PDF migration for product docs...'
    : 'Dry run: scanning legacy PDF docs without saving changes...');

  for (const row of rows) {
    checked += 1;
    const result = await migrateProduct(row, options.apply);
    if (!result.legacyCount) continue;

    matched += 1;
    convertedDocs += result.convertedCount || 0;
    if (result.migrated) migrated += 1;

    console.log(`- product #${row.id} (${row.name || 'Unnamed'}): ${result.legacyCount} legacy PDF(s)${result.migrated ? ' migrated' : ' found'}`);
  }

  console.log('');
  console.log(`Checked products: ${checked}`);
  console.log(`Products with legacy PDFs: ${matched}`);
  console.log(`Legacy PDFs converted: ${convertedDocs}`);
  console.log(options.apply ? `Products updated: ${migrated}` : 'No database changes were written');
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
