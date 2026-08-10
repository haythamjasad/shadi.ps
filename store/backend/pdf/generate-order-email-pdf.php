<?php

declare(strict_types=1);

use Mpdf\Mpdf;
use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;

$autoload = __DIR__ . '/../vendor/autoload.php';
if (!is_file($autoload)) {
    fwrite(STDERR, "mPDF vendor/autoload.php was not found. Run composer install in backend-app.\n");
    exit(2);
}

require $autoload;

function value_text($value, string $fallback = '-'): string
{
    $text = trim((string)($value ?? ''));
    return $text !== '' ? $text : $fallback;
}

function h($value): string
{
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function money_value($value): string
{
    $amount = is_numeric($value) ? (float)$value : 0.0;
    $formatted = number_format($amount, fmod($amount, 1.0) === 0.0 ? 0 : 2, '.', ',');
    return $formatted . ' شيكل';
}

function date_value($value): string
{
    $text = trim((string)($value ?? ''));
    if ($text === '') {
        return 'غير محدد';
    }

    try {
        return (new DateTime($text))->format('Y-m-d H:i');
    } catch (Throwable $e) {
        return 'غير محدد';
    }
}

function address_value(array $order): string
{
    $parts = [];
    foreach (['address_line1', 'address_line2', 'city', 'state', 'country', 'postal_code'] as $key) {
        $part = trim((string)($order[$key] ?? ''));
        if ($part !== '') {
            $parts[] = $part;
        }
    }
    return $parts ? implode(' - ', $parts) : 'غير متوفر';
}

function status_label($value): string
{
    $labels = [
        'pending' => 'بانتظار التأكيد',
        'processing' => 'قيد المعالجة',
        'delivered' => 'تم التسليم',
        'paid' => 'قيد التجهيز',
        'completed' => 'مكتمل',
        'cancelled' => 'ملغي',
        'pending_payment' => 'بانتظار الدفع',
    ];
    $key = strtolower(trim((string)($value ?? '')));
    return $labels[$key] ?? value_text($value, 'بانتظار التأكيد');
}

function product_name(array $item): string
{
    $name = value_text($item['product_name'] ?? '', '-');
    $color = trim((string)($item['color_name'] ?? ''));
    if ($color === '') {
        return h($name);
    }
    return h($name) . '<br><span class="muted small">' . h($color) . '</span>';
}

function badge(string $label, $value): string
{
    return '<td class="badge"><span>' . h($label) . '</span><strong>' . h(value_text($value)) . '</strong></td>';
}

function pill_badge(string $label, $value): string
{
    $safeLabel = h($label);
    $safeValue = h(value_text($value));
    return '<span style="display:inline-block; margin:6px 0 0 8px; padding:9px 12px; border-radius:999px; background:#fff7ed; border:1px solid #fdba74; color:#111827; font-size:12px; font-weight:700; white-space:nowrap;"><span style="color:#c2410c;">' . $safeLabel . ':</span> ' . $safeValue . '</span>';
}

function badge_cell(string $label, $value, int $colspan = 1): string
{
    $span = $colspan > 1 ? ' colspan="' . $colspan . '"' : '';
    return '<td' . $span . ' class="badge-cell"><span>' . h($label) . ':</span> ' . h(value_text($value)) . '</td>';
}

function badges_table(array $badges): string
{
    $html = '<table class="badges-table" dir="rtl" width="100%" cellpadding="0" cellspacing="8">';
    foreach ($badges as $row) {
        $html .= '<tr>';
        foreach ($row as $badge) {
            $html .= badge_cell($badge['label'], $badge['value'], (int)($badge['colspan'] ?? 1));
        }
        $html .= '</tr>';
    }
    return $html . '</table>';
}

function items_rows(array $items): string
{
    if (!$items) {
        return '<tr><td class="empty" colspan="3">لا توجد عناصر مرفقة في هذا الطلب.</td></tr>';
    }

    $html = '';
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $lineTotal = $item['line_total'] ?? $item['total'] ?? $item['unit_price'] ?? 0;
        $html .= '<tr>';
        $html .= '<td class="product">' . product_name($item) . '</td>';
        $html .= '<td class="qty">' . h($item['quantity'] ?? 0) . '</td>';
        $html .= '<td class="total">' . h(money_value($lineTotal)) . '</td>';
        $html .= '</tr>';
    }

    return $html !== '' ? $html : '<tr><td class="empty" colspan="3">لا توجد عناصر مرفقة في هذا الطلب.</td></tr>';
}

function order_total(array $order, array $items): string
{
    foreach (['total_amount', 'total', 'grand_total', 'amount'] as $key) {
        if (isset($order[$key]) && $order[$key] !== '') {
            return money_value($order[$key]);
        }
    }

    $total = 0.0;
    foreach ($items as $item) {
        if (is_array($item)) {
            $total += is_numeric($item['line_total'] ?? null) ? (float)$item['line_total'] : 0.0;
        }
    }
    return money_value($total);
}

function resolve_font(string $fontDir): array
{
    $candidates = [
        ['family' => 'shadiarabic', 'regular' => 'Tajawal-Regular.ttf', 'bold' => 'Tajawal-Bold.ttf'],
        ['family' => 'shadiarabic', 'regular' => 'Cairo-Regular.ttf', 'bold' => 'Cairo-Bold.ttf'],
        ['family' => 'shadiarabic', 'regular' => 'KoufiyaLT-Regular.ttf', 'bold' => 'KoufiyaLT-Regular.ttf'],
    ];

    foreach ($candidates as $candidate) {
        if (is_file($fontDir . '/' . $candidate['regular'])) {
            return $candidate;
        }
    }

    return ['family' => 'dejavusans', 'regular' => '', 'bold' => ''];
}

function build_html(array $payload): string
{
    $type = ($payload['type'] ?? 'internal') === 'customer' ? 'customer' : 'internal';
    $order = is_array($payload['order'] ?? null) ? $payload['order'] : [];
    $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $payment = is_array($payload['payment'] ?? null) ? $payload['payment'] : [];
    $logoPath = trim((string)($payload['logoPath'] ?? ''));
    $logoHtml = is_file($logoPath)
        ? '<img src="' . h($logoPath) . '" alt="شعار شادي شرّي" width="220" style="display:block; width:220px; max-width:220px; height:auto; border:0; margin:0;">'
        : '<div style="width:180px; height:150px; border:2px solid #f59e0b; border-radius:999px; color:#b45309; text-align:center; padding-top:55px; font-weight:bold; letter-spacing:1px;">SHADI<br>SHIRRI</div>';
    $title = $type === 'customer' ? 'تم استلام طلبك وسنبدأ المتابعة فورًا' : 'إشعار فوري بوجود طلب جديد';
    $customerName = value_text($order['customer_name'] ?? '', 'عميلنا العزيز');
    $subtitle = $type === 'customer'
        ? 'أهلًا ' . $customerName . '، هذه الرسالة لتأكيد أن طلبك وصل إلى النظام. سنراجع العناصر المطلوبة ثم نتواصل معك لإتمام الطلب بأسرع وقت.'
        : '';
    $tag = $type === 'customer' ? 'بريد العميل' : 'بريد الإدارة';
    $notes = value_text($order['notes'] ?? '', 'لا توجد ملاحظات.');
    $totalText = order_total($order, $items);
    $orderDate = date_value($order['created_at'] ?? $order['createdAt'] ?? '');
    $status = status_label($order['status'] ?? '');
    $notice = $type === 'customer'
        ? 'رقم الطلب #' . value_text($order['id'] ?? '') . ' - إجمالي مبدئي ' . $totalText
        : 'طلب جديد يحتاج إلى المتابعة والتجهيز.';
    $itemsLabel = $type === 'customer' ? 'القيمة' : 'الإجمالي';
    $noteHtml = $type === 'internal'
        ? '<div class="note"><strong>ملاحظة العميل</strong><br><span class="muted">' . h($notes) . '</span></div>'
        : '';

    if ($type === 'customer') {
        $badgesHtml = badges_table([
            [
                ['label' => 'رقم الطلب', 'value' => $order['id'] ?? ''],
                ['label' => 'تاريخ الطلب', 'value' => $orderDate],
                ['label' => 'الحالة', 'value' => $status],
            ],
            [
                ['label' => 'الهاتف', 'value' => $order['customer_phone'] ?? ''],
                ['label' => 'البريد', 'value' => $order['customer_email'] ?? '', 'colspan' => 2],
            ],
            [
                ['label' => 'العنوان', 'value' => address_value($order), 'colspan' => 3],
            ],
        ]);
    } else {
        $badgesHtml = badges_table([
            [
                ['label' => 'العميل', 'value' => $order['customer_name'] ?? ''],
                ['label' => 'الطلب', 'value' => $order['id'] ?? ''],
                ['label' => 'التاريخ', 'value' => $orderDate],
            ],
            [
                ['label' => 'الهاتف', 'value' => $order['customer_phone'] ?? ''],
                ['label' => 'البريد', 'value' => $order['customer_email'] ?? '', 'colspan' => 2],
            ],
            [
                ['label' => 'العنوان', 'value' => address_value($order), 'colspan' => 3],
            ],
        ]);
    }

    $paymentHtml = '';

    return '<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<style>
body { direction: rtl; font-family: shadiarabic, dejavusans, sans-serif; color: #111827; margin: 0; padding: 0; background: #f4f4f5; text-align: right; font-weight: 700; }
table, td, th, div, span { font-weight: 700; }
.outer { width: 100%; border-collapse: collapse; background: #f8fafc; }
.container { width: 100%; border-collapse: separate; border-spacing: 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 30px; overflow: hidden; }
.header { padding: 30px 28px 24px; background: #fff7ed; border-bottom: 1px solid #fed7aa; }
.tag { display: inline-block; padding: 7px 12px; border-radius: 999px; background: #ffffff; color: #c2410c; font-size: 12px; font-weight: 800; border: 1px solid #fdba74; }
.title { margin: 14px 0 10px; color: #111827; font-size: 26px; line-height: 1.35; font-weight: 800; }
.subtitle { color: #4b5563; font-size: 15px; line-height: 1.9; font-weight: 700; }
.badges-table { border-collapse: separate; border-spacing: 8px; margin-top: 10px; table-layout: fixed; }
.badge-cell { border: 1px solid #fdba74; background: #fff7ed; color: #111827; font-size: 12px; font-weight: 700; padding: 8px 12px; text-align: center; line-height: 1.5; }
.badge-cell span { color: #c2410c; font-weight: 800; }
.content { padding: 28px; }
.notice { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 22px; overflow: hidden; border: 1px solid #fdba74; background: #fff7ed; margin-bottom: 16px; }
.notice td { border-radius: 22px; padding: 18px 20px; color: #9a3412; font-size: 18px; line-height: 1.8; font-weight: 700; text-align: right; }
.items-wrap { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; border-radius: 22px; overflow: hidden; border: 1px solid #e5e7eb; background: #ffffff; }
.items { width: 100%; border-collapse: collapse; }
.items th { background: #fff7ed; color: #9a3412; font-size: 13px; padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
.items td { background: #ffffff; font-size: 13px; line-height: 1.7; padding: 14px 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-weight: 700; }
.product { text-align: right; width: 58%; }
.qty { text-align: center; width: 14%; white-space: nowrap; }
.total { text-align: right; width: 28%; white-space: nowrap; direction: rtl; }
.empty { text-align: center; color: #6b7280; }
.muted { color: #6b7280; }
.small { font-size: 11px; }
.total-card { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 18px; border-radius: 22px; overflow: hidden; border: 1px solid #e5e7eb; background: #fffaf3; }
.total-card td { padding: 20px; border-radius: 22px; }
.total-label { color: #9a3412; font-size: 16px; font-weight: 800; text-align: right; }
.total-value { color: #111827; font-size: 24px; font-weight: 900; text-align: left; direction: rtl; }
.summary { width: 100%; border-collapse: collapse; margin-top: 18px; border: 1px solid #e5e7eb; border-radius: 14px; }
.summary th { background: #fff7ed; color: #b45309; padding: 11px 14px; text-align: right; }
.summary td { padding: 10px 14px; border-top: 1px solid #e5e7eb; font-size: 13px; }
.note { margin-top: 18px; border: 1px solid #e5e7eb; border-radius: 16px; padding: 15px 18px; }
.footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; text-align: center; }
</style>
</head>
<body dir="rtl">
<table class="outer" dir="rtl" width="100%" cellpadding="0" cellspacing="0">
    <tr>
        <td style="padding:26px 12px;">
            <table class="container" dir="rtl" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td class="header">
                        <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; direction:rtl; text-align:right;">
                            <tr>
                                <td valign="top" align="right" style="width:220px; padding:0 0 0 22px; text-align:right; direction:rtl;">' . $logoHtml . '</td>
                                <td valign="top" style="padding:0; text-align:right; direction:rtl;">
                                    <span class="tag">' . h($tag) . '</span>
                                    <div class="title">' . h($title) . '</div>
                                    ' . ($subtitle !== '' ? '<div class="subtitle">' . h($subtitle) . '</div>' : '') . '
                                    <div style="margin-top:12px;">' . $badgesHtml . '</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td class="content">
                        <table class="notice" dir="rtl" width="100%" cellpadding="0" cellspacing="0"><tr><td>' . h($notice) . '</td></tr></table>
                        <table class="items-wrap" width="100%" cellpadding="0" cellspacing="0">
                            <tr><td style="padding:0;">
                                <table class="items" width="100%" cellpadding="0" cellspacing="0">
                                    <thead><tr><th class="product">المنتج</th><th class="qty">الكمية</th><th class="total">' . h($itemsLabel) . '</th></tr></thead>
                                    <tbody>' . items_rows($items) . '</tbody>
                                </table>
                            </td></tr>
                        </table>
                        <table class="total-card" dir="rtl" width="100%" cellpadding="0" cellspacing="0">
                            <tr><td class="total-label">إجمالي الطلب</td><td class="total-value">' . h($totalText) . '</td></tr>
                        </table>
                        ' . $noteHtml . '
                        ' . $paymentHtml . '
                        <div class="footer">شادي شري للهندسة والاستشارات</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>';
}

if ($argc < 3) {
    fwrite(STDERR, "Usage: php generate-order-email-pdf.php input.json output.pdf\n");
    exit(1);
}

$inputPath = $argv[1];
$outputPath = $argv[2];
$raw = is_file($inputPath) ? file_get_contents($inputPath) : false;
if ($raw === false) {
    fwrite(STDERR, "Unable to read input payload.\n");
    exit(1);
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    fwrite(STDERR, "Invalid JSON payload.\n");
    exit(1);
}

$fontDir = trim((string)($payload['fontDir'] ?? (__DIR__ . '/../email-assets')));
$fontDir = is_dir($fontDir) ? $fontDir : (__DIR__ . '/../email-assets');
$font = resolve_font($fontDir);

$configVariables = new ConfigVariables();
$fontVariables = new FontVariables();
$fontDirs = $configVariables->getDefaults()['fontDir'];
$fontData = $fontVariables->getDefaults()['fontdata'];
if ($font['family'] === 'shadiarabic') {
    $fontData['shadiarabic'] = [
        'R' => $font['regular'],
        'B' => is_file($fontDir . '/' . $font['bold']) ? $font['bold'] : $font['regular'],
        'useOTL' => 0xFF,
        'useKashida' => 75,
    ];
}

$mpdf = new Mpdf([
    'mode' => 'utf-8',
    'format' => 'A4',
    'margin_left' => 10,
    'margin_right' => 10,
    'margin_top' => 10,
    'margin_bottom' => 10,
    'directionality' => 'rtl',
    'autoScriptToLang' => true,
    'autoLangToFont' => true,
    'fontDir' => array_merge($fontDirs, [$fontDir]),
    'fontdata' => $fontData,
    'default_font' => $font['family'],
]);

$mpdf->SetTitle('Order Email PDF');
$mpdf->WriteHTML(build_html($payload));
$mpdf->Output($outputPath, 'F');
