import {
  Transaction,
  Status,
  Location,
  ServiceType,
} from "../entities/Transaction";

export class EmailTemplate {
  /**
   * Generate transaction confirmation email HTML
   * @param transaction - The transaction object with all details
   * @returns HTML string for the email
   */
  static generateTransactionConfirmationEmail(
    transaction: Transaction
  ): string {
    const formattedDate = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(transaction.createdAt));

    const transactionDateFormatted = transaction.transactionDate
        ? new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
            .format(new Date(transaction.transactionDate))
            .replace(",", "")
        : "-";
    const statusColor = this.getStatusColor(transaction.status);

    return `
      <!DOCTYPE html>
      <html lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>شادي شري للهندسة والاستشارات</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #364049;
            background: linear-gradient(135deg, #F6F6F8 0%, #E4E4E9 100%);
            padding: 12px;
          }
          .container {
            max-width: 700px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 6px 24px rgba(58, 55, 65, 0.12);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #3A3741 0%, #2D2A34 100%);
            color: white;
            text-align: center;
            padding: 24px 16px;
            border-bottom: 3px solid #f99d1c;
          }
          .header h1 {
            font-size: 26px;
            font-weight: 600;
            margin-bottom: 6px;
            color: #f99d1c;
          }
          .transaction-id {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 18px;
            font-weight: 600;
            font-size: 12px;
            background-color: ${statusColor};
            border: 1px solid #f99d1c;
            color: #f99d1c;
          }
          .content {
            padding: 20px;
            text-align: right;
          }
          .section {
            margin-bottom: 16px;
          }
          .section-title {
            color: #3A3741;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f99d1c;
            display: block;
            text-align: right;
          }
          .icon {
            width: 24px;
            height: 24px;
          }
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .details-grid.full-width {
            grid-template-columns: 1fr;
          }
          .detail-item {
            background: linear-gradient(135deg, #F6F6F8 0%, #E4E4E9 100%);
            padding: 12px;
            border-radius: 8px;
            border-right: 3px solid #f99d1c;
            margin-bottom: 10px;
          }
          .detail-label {
            color: #5B6B7C;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
            text-align: right;
          }
          .detail-value {
            color: #1A1A1A;
            font-size: 14px;
            font-weight: 500;
            word-break: break-word;
            text-align: right;
          }
          .cost-section {
            background: linear-gradient(135deg, #3A3741 0%, #2D2A34 100%);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            color: white;
            box-shadow: 0 4px 12px rgba(58, 55, 65, 0.25);
          }
          .cost-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
            font-weight: 500;
          }
          .cost-amount {
            font-size: 32px;
            font-weight: 700;
            margin: 8px 0;
            color: #f99d1c;
          }
          .currency {
            font-size: 20px;
            margin-right: 4px;
          }
          .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #ddd, transparent);
            margin: 16px 0;
          }
          .payment-section {
            background: linear-gradient(135deg, #F6F6F8 0%, #E4E4E9 100%);
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #f99d1c;
            text-align: right;
          }
          .payment-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid rgba(58, 55, 65, 0.1);
            width: 100%;
          }
          .payment-row:last-child {
            border-bottom: none;
          }
          .payment-label {
            color: #5B6B7C;
            font-weight: 600;
            font-size: 13px;
            text-align: right;
            max-width: 80px !important;
            width: 80px !important;
          }
          .payment-value {
            color: #1a1a1a;
            font-weight: 600;
            font-size: 14px;
            text-align: right;
          }
          .notes-box {
            background: linear-gradient(135deg, #fff9e6 0%, #ffe8b6 100%);
            border-right: 5px solid #f99d1c;
            padding: 15px;
            border-radius: 8px;
            color: #856404;
            font-size: 14px;
            line-height: 1.6;
            text-align: right;
          }
          .footer {
            background: #F6F6F8;
            padding: 25px;
            text-align: center;
            color: #5B6B7C;
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
          }
          .footer p {
            margin-bottom: 8px;
          }
          .footer-link {
            color: #3A3741;
            text-decoration: none;
            font-weight: 600;
          }
          .footer-link:hover {
            text-decoration: underline;
            color: #f99d1c;
          }
          @media (max-width: 600px) {
            .details-grid {
              grid-template-columns: 1fr;
            }
            .header h1 {
              font-size: 24px;
            }
            .cost-amount {
              font-size: 36px;
            }
            .content {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>شادي شري للهندسة والاستشارات</h1>
            <div style="font-size: 18px; margin: 8px 0">اشعار دفع</div>
            <div class="transaction-id">رقم الطلب: ${transaction.id}</div>
          </div>

          <div class="content">
            <!-- معلومات العميل -->
            <div class="section">
              <div class="section-title">معلومات الزبون 👤</div>
              <div class="payment-section">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid rgba(58, 55, 65, 0.1);">
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${
                      transaction.name
                    }</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">الاسم:</td>
                  </tr>
                  <tr>
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${
                      transaction.phone
                    }</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">رقم الهاتف:</td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- تفاصيل الطلب -->
            <div class="section">
              <div class="section-title">تفاصيل الطلب 📋</div>
              <div class="payment-section">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid rgba(58, 55, 65, 0.1);">
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${transaction.serviceType
                      .map((st) => this.getServiceTypeText(st as ServiceType))
                      .join(", ")}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">نوع الخدمة:</td>
                  </tr>
                  <tr style="border-bottom: 1px solid rgba(58, 55, 65, 0.1);">
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${this.getLocationText(
                      transaction.location
                    )}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">الموقع:</td>
                  </tr>
                  <tr>
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${formattedDate}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">تاريخ الطلب:</td>
                  </tr>
                  ${
                    transaction.notes
                      ? `
                  <tr>
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${transaction.notes}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">معلومات إضافية:</td>
                  </tr>
                  `
                      : ""
                  }
                </table>
              </div>
            </div>

            <div class="divider"></div>

            <!-- تفاصيل الدفع -->
            ${
              transaction.transactionNO
                ? `
            <div class="section">
              <div class="section-title">تفاصيل الدفع 💳</div>
              <div class="payment-section">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid rgba(58, 55, 65, 0.1);">
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${transaction.transactionNO}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">رقم الحركة:</td>
                  </tr>
                  <tr style="border-bottom: 1px solid rgba(58, 55, 65, 0.1);">
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${transaction.cardNo}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">رقم البطاقة:</td>
                  </tr>
                  <tr style="border-bottom: 1px solid rgba(58, 55, 65, 0.1);">
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${transaction.cardType}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">نوع البطاقة:</td>
                  </tr>
                  <tr style="border-bottom: 1px solid rgba(58, 55, 65, 0.1);">
                    <td class="payment-value" style="padding: 8px 0; text-align: right;">${transactionDateFormatted}</td>
                    <td class="payment-label" style="padding: 8px 0; direction: rtl; text-align: right;">تاريخ الحركة:</td>
                  </tr>
                </table>
              </div>
            </div>

            <div class="divider"></div>
            `
                : ""
            }

            <!-- الملخص المالي -->
            <div class="section">
              <div class="cost-section">
                <div class="cost-label">المبلغ الإجمالي للطلب</div>
                <div class="cost-amount">
                  <span class="currency">\$</span>${transaction.cost}
                </div>
              </div>
            </div>

            <!-- التذييل -->
            <div class="footer">
              <p style="font-weight: 600; color: #1a1a1a; margin-bottom: 15px;">شكراً لك على اختيارك خدماتنا 🙏</p>
              <p>إذا كان لديك أي استفسارات أو تحتاج إلى المساعدة، يرجى عدم التردد في <a href="https://shadi.ps" target="_blank" class="footer-link">التواصل معنا</a></p>
              <p style="margin-top: 15px; opacity: 0.8;">&copy; 2026 خدمات شادي. جميع الحقوق محفوظة.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get color code based on transaction status
   * @param status - Transaction status
   * @returns Hex color code
   */
  private static getStatusColor(status: Status): string {
    const statusColors: Record<Status, string> = {
      [Status.NEW]: "#E3F2FD",
      [Status.PENDING]: "#FFF8E1",
      [Status.PAUSED]: "#FFE0B2",
      [Status.FINISHED]: "#C8E6C9",
      [Status.CANCELLED]: "#FFCDD2",
    };

    return statusColors[status] || "#F5F5F5";
  }

  /**
   * Get readable status text
   * @param status - Transaction status
   * @returns Readable status text
   */
  static getStatusText(status: Status): string {
    const statusTexts: Record<Status, string> = {
      [Status.NEW]: "طلب جديد",
      [Status.PENDING]: "قيد الانتظار",
      [Status.PAUSED]: "موقوف",
      [Status.FINISHED]: "مكتمل",
      [Status.CANCELLED]: "ملغي",
    };

    return statusTexts[status] || status;
  }

  /**
   * Get readable service type text
   * @param serviceType - Service type
   * @returns Readable service type text
   */
  static getServiceTypeText(serviceType: ServiceType): string {
    const serviceTexts: Record<ServiceType, string> = {
      [ServiceType.MECHANIC]: "ميكانيك",
      [ServiceType.ELECTRIC]: "كهرباء",
      [ServiceType.CIVIL]: "مدني",
      [ServiceType.ARCHITECTURAL]: "معماري",
      [ServiceType.CHARGES]: "رسوم",
    };

    return serviceTexts[serviceType] || serviceType;
  }

  /**
   * Get readable location text
   * @param location - Location enum
   * @returns Readable location text
   */
  static getLocationText(location: Location | null | undefined): string {
    if (!location) return "غير محدد";

    const locationTexts: Record<Location, string> = {
      [Location.RAMMALLAH]: "رام الله",
      [Location.NABLUS]: "نابلس",
      [Location.SALFIT]: "سلفيت",
      [Location.BETHLEHEM]: "بيت لحم",
      [Location.TULKAREM]: "طولكرم",
      [Location.ZOOM]: "لقاء اونلاين",
    };

    return locationTexts[location] || location;
  }
}

// util usage example:
// import { EmailTemplate } from '../utils/EmailTemplete';

// Inside your transaction service
// const emailHTML = EmailTemplate.generateTransactionConfirmationEmail(transaction);
// await EmailService.sendTransactionEmail(customer.email, emailHTML);
