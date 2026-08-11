import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { config } from '../config/env.js';
import pool from '../db.js';
import { getActiveSmtpSettings } from './smtp-repo.js';
import { getAppRoot, getUploadSubdir } from './app-paths.js';
import { getManagedUploadUrl } from './public-paths.js';

const DEFAULT_STORE_URL = 'https://store.shadi.ps';
const EMAIL_LOGO_CID = 'shadi-store-email-logo';

export async function getSmtpSettings(options = {}) {
  return getActiveSmtpSettings(options);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  const amount = asNumber(value);
  return `₪ ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount)}`;
}

function formatOptionalMoney(value) {
  if (value == null || value === '') return 'غير محدد';
  return formatMoney(value);
}

function formatOrderDate(value) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير محدد';
  return new Intl.DateTimeFormat('ar-PS', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getOrderStatusLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const labels = {
    pending: 'بانتظار التأكيد',
    processing: 'قيد المعالجة',
    delivered: 'تم التسليم',
    paid: 'قيد التجهيز',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    pending_payment: 'بانتظار الدفع'
  };
  return labels[normalized] || String(value || 'بانتظار التأكيد').trim() || 'بانتظار التأكيد';
}

function joinAddressParts(order) {
  return [order?.address_line1, order?.address_line2, order?.city, order?.state, order?.country, order?.postal_code]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' - ');
}

function sanitizeStoreUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  try {
    const parsed = new URL(text);
    if (/^(localhost|127\.0\.0\.1|::1)$/i.test(parsed.hostname)) {
      return DEFAULT_STORE_URL;
    }
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function resolveStoreUrl(logoUrl = '') {
  const configuredBaseUrl = sanitizeStoreUrl(config.baseUrl);
  if (configuredBaseUrl) return configuredBaseUrl;

  const text = String(logoUrl || '').trim();
  if (!text) return DEFAULT_STORE_URL;

  try {
    const parsed = new URL(text);
    const origin = sanitizeStoreUrl(`${parsed.protocol}//${parsed.host}`);
    return origin || DEFAULT_STORE_URL;
  } catch {
    return DEFAULT_STORE_URL;
  }
}

function resolveAdminUrl(logoUrl = '') {
  const storeUrl = resolveStoreUrl(logoUrl);
  if (!storeUrl) return '';

  try {
    const parsed = new URL(storeUrl);
    if (/^(localhost|127\.0\.0\.1|::1)$/i.test(parsed.hostname)) {
      return `${parsed.protocol}//${parsed.hostname}:3000`;
    }
    if (/^store\.shadi\.ps$/i.test(parsed.hostname)) {
      return `${parsed.protocol}//admin.shadi.ps`;
    }
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function resolveHeroLogoUrl(logoUrl = '') {
  const cleaned = String(logoUrl || '').trim();
  if (/^cid:/i.test(cleaned)) return cleaned;
  if (cleaned) return cleaned.replace(/\/logo\.png(?:\?.*)?$/i, '/circle_logo_footer.png');
  const storeUrl = resolveStoreUrl(cleaned);
  return storeUrl ? `${storeUrl}/circle_logo_footer.png` : '';
}

async function resolveEmbeddedHeroLogo() {
  const logoPath = path.join(getAppRoot(), 'email-assets', 'circle_logo_footer.png');
  try {
    await fs.access(logoPath);
    return {
      logoUrl: `cid:${EMAIL_LOGO_CID}`,
      attachments: [{
        filename: 'circle_logo_footer.png',
        path: logoPath,
        cid: EMAIL_LOGO_CID,
        contentDisposition: 'inline'
      }]
    };
  } catch {
    return {
      logoUrl: '',
      attachments: []
    };
  }
}

async function resolvePdfFontPath() {
  const fontPath = path.join(getAppRoot(), 'email-assets', 'KoufiyaLT-Regular.ttf');
  try {
    await fs.access(fontPath);
    return fontPath;
  } catch {
    return '';
  }
}

async function resolvePdfLogoPath() {
  const logoPath = path.join(getAppRoot(), 'email-assets', 'circle_logo_footer.png');
  try {
    await fs.access(logoPath);
    return logoPath;
  } catch {
    return '';
  }
}

async function renderPhpMpdfOrderPdf({ type, order, items, payment }) {
  const scriptPath = String(process.env.PHP_MPDF_SCRIPT || '').trim()
    || path.join(getAppRoot(), 'pdf', 'generate-order-email-pdf.php');
  try {
    await fs.access(scriptPath);
  } catch {
    return null;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shadi-mpdf-'));
  const inputPath = path.join(tempDir, 'payload.json');
  const outputPath = path.join(tempDir, 'order-email.pdf');
  const logoPath = await resolvePdfLogoPath();
  const payload = {
    type: type === 'customer' ? 'customer' : 'internal',
    order: order || {},
    items: Array.isArray(items) ? items : [],
    payment: payment || null,
    logoPath,
    fontDir: path.join(getAppRoot(), 'email-assets'),
    generatedAt: new Date().toISOString()
  };

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload), 'utf8');
    const phpBinary = String(process.env.PHP_BIN || process.env.PHP_BINARY || 'php').trim() || 'php';
    await new Promise((resolve, reject) => {
      const child = spawn(phpBinary, [scriptPath, inputPath, outputPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `PHP mPDF renderer exited with code ${code}`));
      });
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function getOrderEmailPdfFileName(order, type) {
  const orderId = String(order?.id || 'new').replace(/[^a-z0-9_-]+/gi, '-');
  const normalizedType = type === 'customer' ? 'customer' : 'internal';
  return `order-${orderId}-${normalizedType}-email.pdf`;
}

export function getOrderEmailPdfUrl(order, type) {
  return getManagedUploadUrl('order-email-pdfs', getOrderEmailPdfFileName(order, type));
}

async function saveOrderEmailPdf({ type, order, pdf }) {
  if (!Buffer.isBuffer(pdf) || pdf.length === 0) return '';
  const fileName = getOrderEmailPdfFileName(order, type);
  const dir = getUploadSubdir('order-email-pdfs');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), pdf);
  return getManagedUploadUrl('order-email-pdfs', fileName);
}

function resolveMailFrom(settings) {
  const fromName = settings.from_name || 'Shadi Store';
  const fromEmail = isValidEmail(settings.from_email)
    ? String(settings.from_email).trim()
    : isValidEmail(settings.username)
      ? String(settings.username).trim()
      : 'no-reply@shadi.ps';
  return { fromName, fromEmail };
}

function createSmtpTransporter(settings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port || 587,
    secure: !!settings.secure,
    auth: {
      user: settings.username,
      pass: settings.password
    }
  });
}

function textValue(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function orderPdfLine(label, value) {
  return `${label}: ${textValue(value)}`;
}

function normalizePdfText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function visualRtl(value) {
  const text = normalizePdfText(value);
  if (!text) return '';
  return text.split(' ').reverse().join(' ');
}

export async function buildInternalOrderPdf({ order, items, payment }) {
  const fontPath = await resolvePdfFontPath();
  const logoPath = await resolvePdfLogoPath();
  const chunks = [];
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `Order #${order?.id || ''}` } });

  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (fontPath) {
    doc.font(fontPath);
  }

  const page = { width: 595.28, height: 841.89 };
  const margin = 38;
  const width = page.width - (margin * 2);
  const orange = '#f99d1c';
  const burnt = '#b45309';
  const ink = '#111827';
  const muted = '#374151';
  const line = '#e5e7eb';
  let y = 28;

  const ensureSpace = (height = 80) => {
    if (y + height <= page.height - 44) return;
    doc.addPage({ size: 'A4', margin: 0 });
    y = 42;
  };

  const writeText = (text, x, textY, options = {}) => {
    doc.fillColor(options.color || '#1f2937').fontSize(options.size || 11);
    const pdfText = normalizePdfText(text);
    const textOptions = {
      width: options.width || width,
      align: options.align || 'right',
      lineGap: options.lineGap ?? 3
    };
    doc.text(pdfText, x, textY, textOptions);
    const nextY = doc.y;
    if (options.bold !== false) {
      doc.text(pdfText, x + 0.22, textY, textOptions);
      doc.y = nextY;
    }
    return nextY;
  };

  const writeRtl = (text, x, textY, options = {}) => writeText(visualRtl(text), x, textY, options);
  const drawBadge = (label, value, x, badgeY, badgeWidth) => {
    doc.roundedRect(x, badgeY, badgeWidth, 26, 13).fillAndStroke('#fffaf3', '#fed7aa');
    writeText(`${textValue(value)} :${visualRtl(label)}`, x + 8, badgeY + 7, { width: badgeWidth - 16, size: 9.5, color: '#111827', align: 'center' });
  };
  const drawSectionHeading = (heading) => {
    ensureSpace(42);
    writeRtl(heading, margin, y, { width, size: 17, color: burnt, align: 'right' });
    y += 28;
  };
  const drawNotice = (message) => {
    ensureSpace(76);
    doc.rect(margin + 18, y, width - 36, 58).fillAndStroke('#fffaf3', '#fed7aa');
    writeRtl(message, margin + 36, y + 20, { width: width - 72, size: 15, color: '#9a3412', align: 'right' });
    y += 76;
  };

  const headerHeight = 250;
  doc.roundedRect(margin, y, width, headerHeight, 16).fillAndStroke('#fff3e4', '#fed7aa');
  doc.rect(margin, y + headerHeight - 1, width, 1).fill('#fed7aa');

  const logoSize = 150;
  if (logoPath) {
    try {
      doc.image(logoPath, margin + width - logoSize - 30, y + 38, { width: logoSize });
    } catch {
      // logo optional
    }
  }

  const textX = margin + 30;
  const textW = width - logoSize - 86;
  doc.roundedRect(textX + textW - 86, y + 24, 86, 24, 12).fillAndStroke('#ffffff', '#fdba74');
  writeRtl('بريد الإدارة', textX + textW - 78, y + 31, { width: 70, size: 10, color: burnt, align: 'center' });
  writeRtl('إشعار فوري بوجود طلب جديد', textX, y + 72, { width: textW, size: 25, color: ink, align: 'right' });

  const orderDate = formatOrderDate(order?.created_at || order?.createdAt);
  const badgeGap = 8;
  const badgeW = (textW - badgeGap) / 2;
  drawBadge('العميل', order?.customer_name || '-', textX + badgeW + badgeGap, y + 142, badgeW);
  drawBadge('الطلب', order?.id || '-', textX, y + 142, badgeW);
  drawBadge('التاريخ', orderDate, textX + badgeW + badgeGap, y + 174, badgeW);
  drawBadge('الهاتف', order?.customer_phone || '-', textX, y + 174, badgeW);
  drawBadge('العنوان', joinAddressParts(order) || 'غير متوفر', textX, y + 206, textW);
  y += headerHeight + 26;

  drawNotice('طلب جديد يحتاج إلى المتابعة والتجهيز.');

  const drawItemsTable = () => {
    const itemRows = Array.isArray(items) && items.length > 0 ? items : [];
    const rowH = 42;
    const headerH = 36;
    const tableH = headerH + (Math.max(1, itemRows.length) * rowH);
    ensureSpace(tableH + 26);
    const x = margin + 18;
    const tableW = width - 36;
    const totalW = 92;
    const qtyW = 70;
    const productW = tableW - totalW - qtyW;
    doc.rect(x, y, tableW, headerH).fillAndStroke('#fff7ed', line);
    writeRtl('المنتج', x + totalW + qtyW + 12, y + 12, { width: productW - 24, size: 10.5, color: burnt, align: 'right' });
    writeRtl('الكمية', x + totalW, y + 12, { width: qtyW, size: 10.5, color: burnt, align: 'center' });
    writeRtl('الإجمالي', x, y + 12, { width: totalW, size: 10.5, color: burnt, align: 'center' });
    y += headerH;

    if (!itemRows.length) {
      doc.rect(x, y, tableW, rowH).fillAndStroke('#ffffff', line);
      writeRtl('لا توجد عناصر مرفقة في هذا الطلب.', x + 16, y + 14, { width: tableW - 32, size: 10.5, color: muted, align: 'center' });
      y += rowH;
      return;
    }

    itemRows.forEach((item) => {
      const optionText = [item?.color_name, item?.size_name].map((value) => String(value || '').trim()).filter(Boolean).join(' / ');
      const product = `${textValue(item?.product_name)}${optionText ? ` - ${optionText}` : ''}`;
      doc.rect(x, y, tableW, rowH).fillAndStroke('#ffffff', line);
      writeText(normalizePdfText(product), x + totalW + qtyW + 12, y + 14, { width: productW - 24, size: 10.5, color: ink, align: 'right' });
      writeText(textValue(item?.quantity, '0'), x + totalW, y + 14, { width: qtyW, size: 10.5, color: ink, align: 'center' });
      writeText(formatMoney(item?.line_total ?? item?.unit_price), x, y + 14, { width: totalW, size: 10.5, color: ink, align: 'center' });
      y += rowH;
    });
    y += 20;
  };

  drawItemsTable();

  ensureSpace(78);
  doc.rect(margin + 18, y, width - 36, 58).fillAndStroke('#fffaf3', line);
  writeRtl('إجمالي الطلب', margin + width - 190, y + 18, { width: 150, size: 17, color: burnt, align: 'right' });
  writeText(formatMoney(order?.total), margin + 38, y + 18, { width: 160, size: 18, color: ink, align: 'left' });
  y += 78;

  ensureSpace(104);
  doc.roundedRect(margin + 18, y, width - 36, 86, 10).fillAndStroke('#ffffff', line);
  writeRtl('ملاحظة العميل', margin + 36, y + 18, { width: width - 72, size: 16, color: burnt, align: 'right' });
  writeRtl(String(order?.notes || '').trim() || 'لا توجد ملاحظات. يمكن البدء بمتابعة الطلب مباشرة من لوحة الإدارة.', margin + 36, y + 48, { width: width - 72, size: 11, color: muted, align: 'right' });

  const paymentDetails = extractPaymentDetails(payment);
  if (paymentDetails) {
    y += 106;
    ensureSpace(90);
    drawSectionHeading('تفاصيل الدفع');
    drawBadge('رقم الحركة', paymentDetails.reference, margin + width / 2, y, width / 2 - 8);
    drawBadge('نوع البطاقة', paymentDetails.cardType, margin + 8, y, width / 2 - 16);
    y += 44;
  }

  doc.end();
  return done;
}

async function buildOrderEmailTemplateFallbackPdf({ type = 'internal', order, items, payment }) {
  const normalizedType = type === 'customer' ? 'customer' : 'internal';
  const fontPath = await resolvePdfFontPath();
  const logoPath = await resolvePdfLogoPath();
  const chunks = [];
  const title = normalizedType === 'customer'
    ? `Customer order email #${order?.id || ''}`
    : `Internal order email #${order?.id || ''}`;
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: title } });

  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  if (fontPath) doc.font(fontPath);

  const page = { width: 595.28, height: 841.89 };
  const margin = 40;
  const width = page.width - (margin * 2);
  const orange = '#f99d1c';
  const orangeLight = '#fff7ed';
  const border = '#fed7aa';
  const ink = '#111827';
  const muted = '#4b5563';
  let y = 32;

  const ensureSpace = (height = 80) => {
    if (y + height <= page.height - 48) return;
    doc.addPage({ size: 'A4', margin: 0 });
    y = 44;
  };

  const write = (text, x, textY, options = {}) => {
    doc.fillColor(options.color || ink).fontSize(options.size || 11);
    const pdfText = normalizePdfText(text);
    const textOptions = {
      width: options.width || width,
      align: options.align || 'right',
      lineGap: options.lineGap ?? 4
    };
    doc.text(pdfText, x, textY, textOptions);
    const nextY = doc.y;
    if (options.bold !== false) {
      doc.text(pdfText, x + 0.22, textY, textOptions);
      doc.y = nextY;
    }
    return nextY;
  };
  const writeRtl = (text, x, textY, options = {}) => write(visualRtl(text), x, textY, options);

  const badge = (label, value, x, badgeY, badgeWidth) => {
    doc.roundedRect(x, badgeY, badgeWidth, 28, 14).fillAndStroke('#ffffff', border);
    write(`${textValue(value)} :${visualRtl(label)}`, x + 8, badgeY + 8, { width: badgeWidth - 16, size: 9.5, color: ink, align: 'center' });
  };

  doc.roundedRect(margin, y, width, 214, 24).fillAndStroke('#ffedd5', border);
  if (logoPath) {
    try {
      doc.image(logoPath, margin + width - 142, y + 34, { width: 112 });
    } catch {
      // logo optional
    }
  }

  const textX = margin + 26;
  const textW = width - 188;
  const chip = normalizedType === 'customer' ? 'بريد العميل' : 'بريد الإدارة';
  const heading = normalizedType === 'customer'
    ? 'تم استلام طلبك وسنبدأ المتابعة فورًا'
    : 'إشعار فوري بوجود طلب جديد';
  const subtitle = normalizedType === 'customer'
    ? `أهلًا ${String(order?.customer_name || '').trim() || 'عميلنا العزيز'}، هذه نسخة PDF من بريد الطلب المرسل إليك.`
    : 'هذه نسخة PDF من بريد التجهيز المرسل إلى الإدارة.';

  doc.roundedRect(textX + textW - 92, y + 24, 92, 25, 12).fillAndStroke('#ffffff', border);
  writeRtl(chip, textX + textW - 84, y + 32, { width: 76, size: 10, color: '#b45309', align: 'center' });
  writeRtl(heading, textX, y + 72, { width: textW, size: normalizedType === 'customer' ? 22 : 24, color: ink, align: 'right' });
  writeRtl(subtitle, textX, y + 124, { width: textW, size: 11, color: muted, align: 'right' });
  y += 234;

  const orderDate = formatOrderDate(order?.created_at || order?.createdAt);
  const address = joinAddressParts(order) || 'غير متوفر';
  const badgeW = (width - 16) / 2;
  badge('رقم الطلب', order?.id || '-', margin + badgeW + 16, y, badgeW);
  badge('الحالة', getOrderStatusLabel(order?.status), margin, y, badgeW);
  y += 38;
  badge('العميل', order?.customer_name || '-', margin + badgeW + 16, y, badgeW);
  badge('الهاتف', order?.customer_phone || '-', margin, y, badgeW);
  y += 38;
  badge('التاريخ', orderDate, margin + badgeW + 16, y, badgeW);
  badge('البريد', order?.customer_email || 'غير متوفر', margin, y, badgeW);
  y += 38;
  badge('العنوان', address, margin, y, width);
  y += 52;

  ensureSpace(88);
  doc.roundedRect(margin, y, width, 66, 16).fillAndStroke(orangeLight, border);
  const hero = normalizedType === 'customer'
    ? `رقم الطلب #${order?.id || '-'} - إجمالي مبدئي ${formatMoney(order?.total)}`
    : 'طلب جديد يحتاج إلى المتابعة والتجهيز.';
  writeRtl(hero, margin + 24, y + 22, { width: width - 48, size: 15, color: '#9a3412', align: 'right' });
  y += 86;

  ensureSpace(116);
  writeRtl('المنتجات', margin, y, { width, size: 17, color: '#b45309', align: 'right' });
  y += 28;
  const rowH = 40;
  const tableX = margin;
  const totalW = 98;
  const qtyW = 66;
  const productW = width - totalW - qtyW;
  doc.rect(tableX, y, width, 34).fillAndStroke('#fff7ed', '#e5e7eb');
  writeRtl('المنتج', tableX + totalW + qtyW + 10, y + 11, { width: productW - 20, size: 10, color: '#9a3412' });
  writeRtl('الكمية', tableX + totalW, y + 11, { width: qtyW, size: 10, color: '#9a3412', align: 'center' });
  writeRtl('الإجمالي', tableX, y + 11, { width: totalW, size: 10, color: '#9a3412', align: 'center' });
  y += 34;

  const itemRows = Array.isArray(items) && items.length ? items : [];
  if (!itemRows.length) {
    doc.rect(tableX, y, width, rowH).fillAndStroke('#ffffff', '#e5e7eb');
    writeRtl('لا توجد عناصر مرفقة في هذا الطلب.', tableX + 12, y + 13, { width: width - 24, size: 10.5, color: muted, align: 'center' });
    y += rowH;
  } else {
    for (const item of itemRows) {
      ensureSpace(rowH + 20);
      const optionText = [item?.color_name, item?.size_name].map((value) => String(value || '').trim()).filter(Boolean).join(' / ');
      const product = `${textValue(item?.product_name)}${optionText ? ` - ${optionText}` : ''}`;
      doc.rect(tableX, y, width, rowH).fillAndStroke('#ffffff', '#e5e7eb');
      write(product, tableX + totalW + qtyW + 10, y + 13, { width: productW - 20, size: 10.5, color: ink, align: 'right' });
      write(textValue(item?.quantity, '0'), tableX + totalW, y + 13, { width: qtyW, size: 10.5, color: ink, align: 'center' });
      write(formatMoney(item?.line_total ?? item?.unit_price), tableX, y + 13, { width: totalW, size: 10.5, color: ink, align: 'center' });
      y += rowH;
    }
  }
  y += 18;

  ensureSpace(96);
  doc.roundedRect(margin, y, width, 74, 16).fillAndStroke('#fffaf3', '#e5e7eb');
  writeRtl('إجمالي الطلب', margin + width - 190, y + 24, { width: 150, size: 16, color: '#b45309', align: 'right' });
  write(formatMoney(order?.total), margin + 28, y + 23, { width: 160, size: 17, color: ink, align: 'left' });
  y += 94;

  const notes = String(order?.notes || '').trim();
  ensureSpace(86);
  doc.roundedRect(margin, y, width, 66, 12).fillAndStroke('#ffffff', '#e5e7eb');
  writeRtl('ملاحظة العميل', margin + 22, y + 16, { width: width - 44, size: 14, color: '#b45309', align: 'right' });
  writeRtl(notes || 'لا توجد ملاحظات.', margin + 22, y + 40, { width: width - 44, size: 10.5, color: muted, align: 'right' });
  y += 84;

  const paymentDetails = extractPaymentDetails(payment);
  if (paymentDetails) {
    ensureSpace(110);
    writeRtl('تفاصيل الدفع', margin, y, { width, size: 16, color: '#b45309', align: 'right' });
    y += 28;
    badge('رقم الحركة', paymentDetails.reference, margin + badgeW + 16, y, badgeW);
    badge('نوع البطاقة', paymentDetails.cardType, margin, y, badgeW);
    y += 38;
  }

  doc.rect(margin, page.height - 44, width, 1).fill('#e5e7eb');
  writeRtl('شادي شري للهندسة والاستشارات', margin, page.height - 34, { width, size: 9.5, color: '#6b7280', align: 'center' });

  doc.end();
  return done;
}

export async function buildOrderEmailTemplatePdf({ type = 'internal', order, items, payment }) {
  const normalizedType = type === 'customer' ? 'customer' : 'internal';
  let pdf = null;
  try {
    const mpdfPdf = await renderPhpMpdfOrderPdf({ type: normalizedType, order, items, payment });
    if (mpdfPdf) pdf = mpdfPdf;
  } catch (err) {
    console.warn('PHP mPDF email PDF renderer failed; using PDFKit fallback:', err?.message || err);
  }

  if (!pdf) {
    pdf = await buildOrderEmailTemplateFallbackPdf({ type: normalizedType, order, items, payment });
  }
  await saveOrderEmailPdf({ type: normalizedType, order, pdf });
  return pdf;
}

export async function sendOrderPdfEmail({ to, type = 'internal', order, items, payment }) {
  if (!isValidEmail(to)) {
    throw new Error('Recipient email is invalid');
  }

  const settings = await getSmtpSettings();
  if (!settings || !settings.host || !settings.username || !settings.password) {
    return { skipped: true };
  }

  const normalizedType = type === 'customer' ? 'customer' : 'internal';
  const transporter = createSmtpTransporter(settings);
  const { fromName, fromEmail } = resolveMailFrom(settings);
  const subject = normalizedType === 'customer'
    ? `PDF طلب العميل #${order.id}`
    : `PDF طلب التجهيز #${order.id}`;
  const pdf = await buildOrderEmailTemplatePdf({ type: normalizedType, order, items, payment });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: `PDF الطلب #${order.id} مرفق مع هذه الرسالة.`,
    attachments: [{
      filename: getOrderEmailPdfFileName(order, normalizedType),
      content: pdf,
      contentType: 'application/pdf'
    }]
  });

  return { sent: true };
}

function renderProductName(item) {
  const baseName = String(item?.product_name || '').trim();
  const optionText = [item?.color_name, item?.size_name].map((value) => String(value || '').trim()).filter(Boolean).join(' / ');
  if (!optionText) return escapeHtml(baseName);
  return `${escapeHtml(baseName)} <span style="color:#f89c1c; font-size:12px;">- ${escapeHtml(optionText)}</span>`;
}

function renderItemsRows(items, totalLabel = 'الإجمالي') {
  if (!Array.isArray(items) || items.length === 0) {
    return `
      <tr>
        <td colspan="3" style="padding:16px; color:#6b7280; text-align:center; background:#ffffff;">لا توجد عناصر مرفقة في هذا الطلب.</td>
      </tr>
    `;
  }

  return items.map((item) => `
    <tr>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:14px; line-height:1.7; background:#ffffff;">${renderProductName(item)}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:14px; text-align:center; white-space:nowrap; background:#ffffff;">${escapeHtml(item?.quantity ?? 0)}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:14px; white-space:nowrap; background:#ffffff;">${escapeHtml(totalLabel === 'السعر' ? formatMoney(item?.unit_price) : formatMoney(item?.line_total ?? item?.unit_price))}</td>
    </tr>
  `).join('');
}

function renderTotals(order, options = {}) {
  const showNotes = options.showNotes === true;
  const showSubtotal = options.showSubtotal !== false;
  const notes = String(order?.notes || '').trim();
  const discountAmount = Number(order?.discount_amount || 0);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:18px; border-radius:22px; overflow:hidden; border:1px solid #e5e7eb; background:#fffaf3;">
      ${showSubtotal ? `<tr>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#6b7280; font-size:14px;">المجموع الفرعي</td>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:14px; text-align:left;">${escapeHtml(formatOptionalMoney(order?.subtotal))}</td>
      </tr>` : ''}
      ${discountAmount > 0 ? `<tr>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#15803d; font-size:14px;">الخصم</td>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#15803d; font-size:14px; font-weight:700; text-align:left;">-${escapeHtml(formatMoney(discountAmount))}</td>
      </tr>` : ''}
      ${showNotes ? `
      <tr>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#6b7280; font-size:14px;">ملاحظات العميل</td>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:14px; text-align:left;">${escapeHtml(notes || 'لا توجد ملاحظات')}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:18px; color:#b45309; font-size:18px; font-weight:800;">إجمالي الطلب</td>
        <td style="padding:18px; color:#111827; font-size:22px; font-weight:800; text-align:left;">${escapeHtml(formatMoney(order?.total))}</td>
      </tr>
    </table>
  `;
}

function renderPanel(title, body) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border-radius:20px; overflow:hidden; border:1px solid #e5e7eb; background:#ffffff; box-shadow:0 8px 24px rgba(17,24,39,0.06);">
      <tr>
        <td style="padding:16px 18px 10px; color:#b45309; font-size:17px; font-weight:700;">${escapeHtml(title)}</td>
      </tr>
      <tr>
        <td style="padding:0 18px 18px; color:#374151; font-size:14px; line-height:1.9;">${body}</td>
      </tr>
    </table>
  `;
}

function renderDualPanels(firstTitle, firstBody, secondTitle, secondBody) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:16px;">
      <tr>
        <td style="padding:0 0 14px;">
          ${renderPanel(firstTitle, firstBody)}
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          ${renderPanel(secondTitle, secondBody)}
        </td>
      </tr>
    </table>
  `;
}

function extractPaymentDetails(payment) {
  if (!payment) return null;

  let raw = null;
  if (payment.raw_response && typeof payment.raw_response === 'object') {
    raw = payment.raw_response;
  } else {
    try {
      raw = payment.raw_response ? JSON.parse(payment.raw_response) : null;
    } catch {
      raw = null;
    }
  }

  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
  const authorization = data?.authorization && typeof data.authorization === 'object'
    ? data.authorization
    : raw?.authorization && typeof raw.authorization === 'object'
      ? raw.authorization
      : null;

  const firstNonEmpty = (...values) => {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) return normalized;
    }
    return '';
  };

  const reference = firstNonEmpty(
    data?.id,
    raw?.id,
    data?.transaction_id,
    raw?.transaction_id,
    data?.transactionId,
    raw?.transactionId,
    data?.reference,
    raw?.reference,
    data?.trxref,
    raw?.trxref,
    payment.transaction_id
  );

  const last4 = firstNonEmpty(
    authorization?.last4,
    authorization?.last_4,
    data?.last4,
    data?.last_4,
    data?.card_last4,
    data?.cardLast4,
    raw?.last4,
    raw?.last_4
  );

  const brand = firstNonEmpty(
    authorization?.brand,
    authorization?.card_type,
    authorization?.cardType,
    data?.brand,
    data?.card_type,
    data?.cardType,
    data?.channel,
    raw?.brand,
    raw?.card_type,
    raw?.cardType,
    raw?.channel
  );

  const paidAt = data?.paid_at
    || data?.paidAt
    || raw?.paid_at
    || raw?.paidAt
    || data?.transaction_date
    || raw?.transaction_date
    || data?.created_at
    || raw?.created_at
    || payment.created_at
    || null;

  if (!reference && !last4 && !brand && !paidAt) return null;

  return {
    reference: reference || 'غير متوفر',
    cardNumber: last4 ? `**** **** **** ${last4}` : 'غير متوفر',
    cardType: brand || 'غير متوفر',
    transactionDate: formatOrderDate(paidAt)
  };
}

function renderPaymentDetailsPanel(payment) {
  const details = extractPaymentDetails(payment);
  if (!details) return '';

  const rows = [
    ['رقم الحركة', details.reference],
    ['رقم البطاقة', details.cardNumber],
    ['نوع البطاقة', details.cardType],
    ['تاريخ الحركة', details.transactionDate]
  ].map(([label, value]) => `
    <tr>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#6b7280; font-size:14px; width:150px;">${escapeHtml(label)}:</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:14px; font-weight:700; text-align:left; direction:ltr;">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:16px; border-radius:20px; overflow:hidden; border:1px solid #e5e7eb; background:#ffffff; box-shadow:0 8px 24px rgba(17,24,39,0.06);">
      <tr>
        <td style="padding:16px 18px 10px; color:#b45309; font-size:18px; font-weight:800;">تفاصيل الدفع 💳</td>
      </tr>
      <tr>
        <td style="padding:0 18px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #f3f4f6; border-radius:14px; overflow:hidden; background:#fffaf3;">
          ${rows}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function renderTemplateShell({ chip, title, subtitle, titleSize = 32, mobileTitleSize = 28, heroText, logoUrl, storeUrl, ctaUrl, ctaLabel = 'زيارة المتجر', panelsHtml, itemsLabel = 'القيمة', items, footLeft, footRight, totalsHtml, metaBadges = [] }) {
  const finalCtaUrl = String(ctaUrl || storeUrl || '').trim();
  const safeCtaUrl = escapeHtml(finalCtaUrl || '#');
  const safeLogoUrl = String(logoUrl || '').trim();
  const logoMarkup = safeLogoUrl
    ? `<img src="${escapeHtml(safeLogoUrl)}" alt="شعار شادي شرّي" width="220" style="display:block; width:220px; max-width:220px; height:auto; border:0; margin:0;">`
    : '';
  const badgesMarkup = metaBadges
    .filter((badge) => badge && badge.label && badge.value)
    .map((badge) => `<span style="display:inline-block; margin:6px 0 0 8px; padding:9px 12px; border-radius:999px; background:#fff7ed; border:1px solid #fdba74; color:#111827; font-size:12px; font-weight:700;"><span style="color:#c2410c;">${escapeHtml(badge.label)}:</span> ${escapeHtml(badge.value)}</span>`)
    .join('');

  return `
  <!doctype html>
  <html lang="ar" dir="rtl">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(title)}</title>
      <style>
        @media screen and (max-width: 640px) {
          .container { width: 100% !important; }
          .stack { display: block !important; width: 100% !important; }
          .stack img { width: 160px !important; max-width: 160px !important; }
          .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
          .mobile-title { font-size: ${mobileTitleSize}px !important; }
        }
      </style>
    </head>
    <body dir="rtl" style="margin:0; padding:0; background-color:#f4f4f5; direction:rtl; text-align:right; font-family:Tahoma, Arial, sans-serif;">
      <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; direction:rtl; text-align:right; background:linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%);">
        <tr>
          <td align="center" style="padding:26px 12px;">
            <table role="presentation" dir="rtl" width="680" cellpadding="0" cellspacing="0" class="container" style="border-collapse:collapse; width:680px; max-width:680px; direction:rtl; text-align:right; background:#ffffff; border:1px solid #e5e7eb; border-radius:30px; overflow:hidden; box-shadow:0 18px 48px rgba(15,23,42,0.12);">
              <tr>
                <td style="padding:30px 28px 24px; background:linear-gradient(135deg, #fff7ed, #ffedd5); border-bottom:1px solid #fed7aa;" class="mobile-padding">
                  <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; direction:rtl; text-align:right;">
                    <tr>
                      <td valign="top" align="right" class="stack" style="width:220px; padding:0 0 0 22px; text-align:right; direction:rtl;">
                        ${logoMarkup}
                      </td>
                      <td valign="top" class="stack" style="padding:0; text-align:right; direction:rtl;">
                        <span style="display:inline-block; padding:7px 12px; border-radius:999px; background:#ffffff; color:#c2410c; font-size:12px; font-weight:800; border:1px solid #fdba74;">${escapeHtml(chip)}</span>
                        <div class="mobile-title" style="margin:14px 0 10px; color:#111827; font-size:${titleSize}px; line-height:1.35; font-weight:800;">${escapeHtml(title)}</div>
                        ${subtitle ? `<div style="color:#4b5563; font-size:15px; line-height:1.9;">${escapeHtml(subtitle)}</div>` : ''}
                        ${badgesMarkup ? `<div style="margin-top:12px;">${badgesMarkup}</div>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:28px;" class="mobile-padding">
                  <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; direction:rtl; text-align:right; border-radius:22px; overflow:hidden; border:1px solid #fdba74; background:linear-gradient(135deg, #fff7ed, #fffbeb); margin-bottom:16px;">
                    <tr>
                      <td style="padding:18px 20px; color:#9a3412; font-size:18px; line-height:1.8; font-weight:700; direction:rtl; text-align:right;">${heroText}</td>
                    </tr>
                  </table>

                  ${panelsHtml}

                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:16px; border-radius:22px; overflow:hidden; border:1px solid #e5e7eb; background:#ffffff;">
                    <tr>
                      <td colspan="3" style="padding:0;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%;">
                          <thead>
                            <tr>
                              <th style="padding:14px 16px; text-align:right; background:#fff7ed; color:#9a3412; font-size:13px; border-bottom:1px solid #e5e7eb;">المنتج</th>
                              <th style="padding:14px 16px; text-align:center; background:#fff7ed; color:#9a3412; font-size:13px; border-bottom:1px solid #e5e7eb;">الكمية</th>
                              <th style="padding:14px 16px; text-align:right; background:#fff7ed; color:#9a3412; font-size:13px; border-bottom:1px solid #e5e7eb;">${escapeHtml(itemsLabel)}</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${renderItemsRows(items)}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </table>

                  ${totalsHtml}

                   ${footLeft || footRight ? `
                   <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:18px; direction:rtl; text-align:right;">
                     <tr>
                       <td style="color:#6b7280; font-size:14px; line-height:1.8; direction:rtl; text-align:right;">${footLeft}</td>
                       <td align="left" style="color:#111827; font-size:22px; font-weight:800; text-align:left;">${footRight}</td>
                     </tr>
                   </table>` : ''}

                   ${finalCtaUrl ? `
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:18px;">
                    <tr>
                      <td align="center">
                        <a href="${safeCtaUrl}" style="display:inline-block; padding:12px 22px; border-radius:999px; background:#f89c1c; color:#111827; text-decoration:none; font-size:14px; font-weight:800;">${escapeHtml(ctaLabel)}</a>
                      </td>
                    </tr>
                  </table>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

export function renderCustomerEmail({ order, logoUrl, items, payment }) {
  const customerName = String(order?.customer_name || '').trim() || 'عميلنا العزيز';
  const orderId = `#${escapeHtml(order?.id || '')}`;
  const storeUrl = resolveStoreUrl(logoUrl);
  const heroLogoUrl = resolveHeroLogoUrl(logoUrl);
  const deliveryAddress = escapeHtml(joinAddressParts(order) || 'سيتم تأكيد عنوان التوصيل معك عند التواصل');
  const phone = escapeHtml(String(order?.customer_phone || '').trim() || 'غير متوفر');
  const customerEmail = escapeHtml(String(order?.customer_email || '').trim() || 'غير متوفر');
  const orderDate = formatOrderDate(order?.created_at || order?.createdAt);
  const orderStatus = getOrderStatusLabel(order?.status);

  return renderTemplateShell({
    chip: 'بريد العميل',
    title: 'تم استلام طلبك وسنبدأ المتابعة فورًا',
    subtitle: `أهلًا ${escapeHtml(customerName)}، هذه الرسالة لتأكيد أن طلبك وصل إلى النظام. سنراجع العناصر المطلوبة ثم نتواصل معك لإتمام الطلب بأسرع وقت.`,
    heroText: `رقم الطلب ${orderId} - إجمالي مبدئي ${escapeHtml(formatMoney(order?.total))}`,
    logoUrl: heroLogoUrl,
    storeUrl,
    panelsHtml: renderPaymentDetailsPanel(payment),
    metaBadges: [
      { label: 'رقم الطلب', value: String(order?.id || '-') },
      { label: 'تاريخ الطلب', value: orderDate },
      { label: 'الحالة', value: orderStatus },
      { label: 'الهاتف', value: phone },
      { label: 'البريد', value: customerEmail },
      { label: 'العنوان', value: deliveryAddress }
    ],
    itemsLabel: 'القيمة',
    items,
    totalsHtml: renderTotals(order, { showSubtotal: false }),
    footLeft: '',
    footRight: ''
  });
}

export function renderInternalEmail({ order, logoUrl, items, payment }) {
  const customerName = escapeHtml(String(order?.customer_name || '').trim() || 'غير معروف');
  const customerEmail = String(order?.customer_email || '').trim() || 'غير متوفر';
  const customerPhone = String(order?.customer_phone || '').trim() || 'غير متوفر';
  const deliveryAddress = escapeHtml(joinAddressParts(order) || 'غير متوفر');
  const notes = escapeHtml(String(order?.notes || '').trim() || 'لا توجد ملاحظات');
  const storeUrl = resolveStoreUrl(logoUrl);
  const adminUrl = resolveAdminUrl(logoUrl);
  const heroLogoUrl = resolveHeroLogoUrl(logoUrl);
  const orderDate = formatOrderDate(order?.created_at || order?.createdAt);

  return renderTemplateShell({
    chip: 'بريد الإدارة',
    title: 'إشعار فوري بوجود طلب جديد',
    subtitle: '',
    titleSize: 28,
    mobileTitleSize: 24,
    heroText: 'طلب جديد يحتاج إلى المتابعة والتجهيز.',
    logoUrl: heroLogoUrl,
    storeUrl,
    ctaUrl: adminUrl,
    ctaLabel: 'الذهاب إلى لوحة الإدارة',
    panelsHtml: '',
    metaBadges: [
      { label: 'العميل', value: String(order?.customer_name || '-').trim() || '-' },
      { label: 'الطلب', value: String(order?.id || '-') },
      { label: 'التاريخ', value: orderDate },
      { label: 'الهاتف', value: customerPhone },
      { label: 'البريد', value: customerEmail },
      { label: 'العنوان', value: deliveryAddress }
    ],
    itemsLabel: 'الإجمالي',
    items,
    totalsHtml: renderTotals(order, { showNotes: false, showSubtotal: false }) + renderPanel(
      'ملاحظة العميل',
      `${notes}${String(order?.notes || '').trim() ? '' : '<br>يمكن البدء بمتابعة الطلب مباشرة من لوحة الإدارة.'}`
    ),
    footLeft: '',
    footRight: ''
  });
}

export async function buildCustomerEmailContent({ order, logoUrl, items, payment }) {
  const embeddedLogo = await resolveEmbeddedHeroLogo();
  const pdf = await buildOrderEmailTemplatePdf({ type: 'customer', order, items, payment });
  return {
    html: renderCustomerEmail({
      order,
      logoUrl: embeddedLogo.logoUrl || resolveHeroLogoUrl(logoUrl),
      items,
      payment
    }),
    attachments: [
      ...embeddedLogo.attachments,
      {
        filename: getOrderEmailPdfFileName(order, 'customer'),
        content: pdf,
        contentType: 'application/pdf'
      }
    ]
  };
}

export async function buildInternalEmailContent({ order, logoUrl, items, payment }) {
  const embeddedLogo = await resolveEmbeddedHeroLogo();
  const pdf = await buildOrderEmailTemplatePdf({ type: 'internal', order, items, payment });
  return {
    html: renderInternalEmail({
      order,
      logoUrl: embeddedLogo.logoUrl || resolveHeroLogoUrl(logoUrl),
      items,
      payment
    }),
    attachments: [
      ...embeddedLogo.attachments,
      {
        filename: getOrderEmailPdfFileName(order, 'internal'),
        content: pdf,
        contentType: 'application/pdf'
      }
    ]
  };
}

async function resolvePaymentForEmail(order, payment) {
  if (payment) return payment;
  const orderId = Number(order?.id);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;

  try {
    const [rows] = await pool.query(
      'SELECT id, order_id, transaction_id, raw_response, created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
      [orderId]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function sendOrderEmail({ to, order, items, payment }) {
  const settings = await getSmtpSettings();
  if (!settings || !settings.host || !settings.username || !settings.password) {
    return { skipped: true };
  }

  const transporter = createSmtpTransporter(settings);
  const { fromName, fromEmail } = resolveMailFrom(settings);
  const logoUrl = config.baseUrl ? `${config.baseUrl.replace(/\/+$/, '')}/logo.png` : '';
  const subject = `تأكيد الطلب #${order.id}`;
  const resolvedPayment = await resolvePaymentForEmail(order, payment);
  const { html, attachments } = await buildCustomerEmailContent({ order, logoUrl, items, payment: resolvedPayment });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments
  });

  return { sent: true };
}

export async function sendInternalOrderEmail({ to, order, items, payment }) {
  const settings = await getSmtpSettings();
  if (!settings || !settings.host || !settings.username || !settings.password) {
    return { skipped: true };
  }

  const transporter = createSmtpTransporter(settings);
  const { fromName, fromEmail } = resolveMailFrom(settings);
  const logoUrl = config.baseUrl ? `${config.baseUrl.replace(/\/+$/, '')}/logo.png` : '';
  const subject = `طلب جديد للتجهيز #${order.id}`;
  const resolvedPayment = await resolvePaymentForEmail(order, payment);
  const { html, attachments } = await buildInternalEmailContent({ order, logoUrl, items, payment: resolvedPayment });
  const replyTo = isValidEmail(order?.customer_email) ? String(order.customer_email).trim() : undefined;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    attachments
  });

  return { sent: true };
}
