import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';
import pool from '../db.js';
import { getActiveSmtpSettings } from './smtp-repo.js';
import { getAppRoot } from './app-paths.js';

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
    shipped: 'تم الشحن',
    delivered: 'تم التسليم',
    paid: 'قيد المتابعة',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    packed: 'تم التجهيز',
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

function renderProductName(item) {
  const baseName = String(item?.product_name || '').trim();
  const colorName = String(item?.color_name || '').trim();
  if (!colorName) return escapeHtml(baseName);
  return `${escapeHtml(baseName)} <span style="color:#f89c1c; font-size:12px;">- ${escapeHtml(colorName)}</span>`;
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

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:18px; border-radius:22px; overflow:hidden; border:1px solid #e5e7eb; background:#fffaf3;">
      ${showSubtotal ? `<tr>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#6b7280; font-size:14px;">المجموع الفرعي</td>
        <td style="padding:16px 18px; border-bottom:1px solid #e5e7eb; color:#111827; font-size:14px; text-align:left;">${escapeHtml(formatOptionalMoney(order?.subtotal))}</td>
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
  const orderDate = formatOrderDate(order?.created_at || order?.createdAt);
  const orderStatus = getOrderStatusLabel(order?.status);

  return renderTemplateShell({
    chip: 'بريد العميل',
    title: 'تم استلام طلبك وسنبدأ المتابعة فورًا',
    subtitle: `أهلًا ${escapeHtml(customerName)}، هذه الرسالة لتأكيد أن طلبك وصل إلى النظام. سنراجع العناصر المطلوبة ثم نتواصل معك لإتمام الطلب بأسرع وقت.`,
    heroText: `رقم الطلب ${orderId} - إجمالي مبدئي ${escapeHtml(formatMoney(order?.total))}`,
    logoUrl: heroLogoUrl,
    storeUrl,
    panelsHtml: renderPanel(
      'تفاصيل التوصيل',
      `${deliveryAddress}<br>الهاتف: ${phone}`
    ) + renderPaymentDetailsPanel(payment),
    metaBadges: [
      { label: 'رقم الطلب', value: String(order?.id || '-') },
      { label: 'تاريخ الطلب', value: orderDate },
      { label: 'الحالة', value: orderStatus }
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
      { label: 'البريد', value: customerEmail }
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
  return {
    html: renderCustomerEmail({
      order,
      logoUrl: embeddedLogo.logoUrl || resolveHeroLogoUrl(logoUrl),
      items,
      payment
    }),
    attachments: embeddedLogo.attachments
  };
}

export async function buildInternalEmailContent({ order, logoUrl, items, payment }) {
  const embeddedLogo = await resolveEmbeddedHeroLogo();
  return {
    html: renderInternalEmail({
      order,
      logoUrl: embeddedLogo.logoUrl || resolveHeroLogoUrl(logoUrl),
      items,
      payment
    }),
    attachments: embeddedLogo.attachments
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

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port || 587,
    secure: !!settings.secure,
    auth: {
      user: settings.username,
      pass: settings.password
    }
  });

  const fromName = settings.from_name || 'Shadi Store';
  const fromEmail = isValidEmail(settings.from_email)
    ? String(settings.from_email).trim()
    : isValidEmail(settings.username)
      ? String(settings.username).trim()
      : 'no-reply@shadi.ps';
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

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port || 587,
    secure: !!settings.secure,
    auth: {
      user: settings.username,
      pass: settings.password
    }
  });

  const fromName = settings.from_name || 'Shadi Store';
  const fromEmail = isValidEmail(settings.from_email)
    ? String(settings.from_email).trim()
    : isValidEmail(settings.username)
      ? String(settings.username).trim()
      : 'no-reply@shadi.ps';
  const logoUrl = config.baseUrl ? `${config.baseUrl.replace(/\/+$/, '')}/logo.png` : '';
  const subject = `طلب جديد للتجهيز #${order.id}`;
  const resolvedPayment = await resolvePaymentForEmail(order, payment);
  const { html, attachments } = await buildInternalEmailContent({ order, logoUrl, items, payment: resolvedPayment });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments
  });

  return { sent: true };
}
