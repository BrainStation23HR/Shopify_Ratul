import nodemailer from "nodemailer";

export interface DeliveryConfirmationParams {
  customerEmail: string;
  customerName: string;
  orderId: string;
  deliveryDate: string;
  timeSlot: string;
  shippingAddress: {
    first_name: string;
    last_name: string;
    address1: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
}

export interface DeliveryBookingFailureParams {
  customerEmail: string;
  orderId: string;
  reason: string;
}

export interface DeliveryCancellationParams {
  customerEmail: string;
  customerName: string;
  orderId: string;
  orderNumber: string; // Added for better email display
  deliveryDate: string;
  timeSlot: string;
  zoneName: string;
  cancelReason?: string;
  refundAmount?: string;
  currency?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Send delivery confirmation email
   */
  async sendDeliveryConfirmation(params: DeliveryConfirmationParams): Promise<void> {
    try {
      const formattedDate = this.formatDate(params.deliveryDate);

      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@yourstore.com',
        to: params.customerEmail,
        subject: `Delivery Scheduled for Order #${params.orderId}`,
        html: this.generateDeliveryConfirmationHTML(params, formattedDate),
        text: this.generateDeliveryConfirmationText(params, formattedDate)
      });

      console.log(`Delivery confirmation email sent to ${params.customerEmail}`);

    } catch (error) {
      console.error('Failed to send delivery confirmation email:', error);
      throw error;
    }
  }

  /**
   * Send delivery booking failure notification
   */
  async sendDeliveryBookingFailure(params: DeliveryBookingFailureParams): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@yourstore.com',
        to: params.customerEmail,
        subject: `Delivery Booking Issue - Order #${params.orderId}`,
        html: this.generateBookingFailureHTML(params),
        text: this.generateBookingFailureText(params)
      });

      console.log(`Delivery booking failure email sent to ${params.customerEmail}`);

    } catch (error) {
      console.error('Failed to send booking failure email:', error);
      throw error;
    }
  }

  /**
   * Send delivery cancellation notification
   */
  async sendDeliveryCancellation(params: DeliveryCancellationParams): Promise<void> {
    try {
      const formattedDate = this.formatDate(params.deliveryDate);

      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@yourstore.com',
        to: params.customerEmail,
        subject: `Delivery Cancelled - Order #${params.orderId}`,
        html: this.generateCancellationHTML(params, formattedDate),
        text: this.generateCancellationText(params, formattedDate)
      });

      console.log(`Delivery cancellation email sent to ${params.customerEmail}`);

    } catch (error) {
      console.error('Failed to send cancellation email:', error);
      throw error;
    }
  }

  private generateDeliveryConfirmationHTML(
    params: DeliveryConfirmationParams,
    formattedDate: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Delivery Confirmation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .delivery-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚚 Delivery Scheduled!</h1>
            </div>
            <div class="content">
              <p>Hi ${params.customerName},</p>
              <p>Great news! Your delivery has been scheduled for order #${params.orderId}.</p>

              <div class="delivery-details">
                <h3>Delivery Details:</h3>
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time Window:</strong> ${params.timeSlot}</p>
                <p><strong>Delivery Address:</strong><br>
                   ${params.shippingAddress.first_name} ${params.shippingAddress.last_name}<br>
                   ${params.shippingAddress.address1}<br>
                   ${params.shippingAddress.city}, ${params.shippingAddress.province} ${params.shippingAddress.zip}<br>
                   ${params.shippingAddress.country}
                </p>
              </div>

              <p>Please ensure someone is available to receive your delivery during the scheduled time window.</p>
              <p>If you need to make any changes to your delivery, please contact us as soon as possible.</p>

              <p>Thank you for your order!</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateDeliveryConfirmationText(
    params: DeliveryConfirmationParams,
    formattedDate: string
  ): string {
    return `
Delivery Scheduled - Order #${params.orderId}

Hi ${params.customerName},

Great news! Your delivery has been scheduled.

Delivery Details:
- Date: ${formattedDate}
- Time Window: ${params.timeSlot}
- Address: ${params.shippingAddress.first_name} ${params.shippingAddress.last_name}, ${params.shippingAddress.address1}, ${params.shippingAddress.city}, ${params.shippingAddress.province} ${params.shippingAddress.zip}, ${params.shippingAddress.country}

Please ensure someone is available to receive your delivery during the scheduled time window.

If you need to make any changes to your delivery, please contact us as soon as possible.

Thank you for your order!
    `.trim();
  }

  private generateBookingFailureHTML(params: DeliveryBookingFailureParams): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Delivery Booking Issue</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ff6b6b; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .alert { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Delivery Booking Issue</h1>
            </div>
            <div class="content">
              <p>Dear Customer,</p>
              <p>We encountered an issue while trying to schedule your delivery for order #${params.orderId}.</p>

              <div class="alert">
                <h3>Issue Details:</h3>
                <p>${params.reason}</p>
              </div>

              <p>We sincerely apologize for the inconvenience. Our team will contact you shortly to resolve this issue and reschedule your delivery.</p>
              <p>If you have any immediate concerns, please don't hesitate to contact our customer service team.</p>

              <p>Thank you for your patience and understanding.</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateBookingFailureText(params: DeliveryBookingFailureParams): string {
    return `
Delivery Booking Issue - Order #${params.orderId}

Dear Customer,

We encountered an issue while trying to schedule your delivery for order #${params.orderId}.

Issue: ${params.reason}

We sincerely apologize for the inconvenience. Our team will contact you shortly to resolve this issue and reschedule your delivery.

If you have any immediate concerns, please don't hesitate to contact our customer service team.

Thank you for your patience and understanding.
    `.trim();
  }

  private generateCancellationHTML(
    params: DeliveryCancellationParams,
    formattedDate: string
  ): string {
    // Helper to format cancel reason
    const formatCancelReason = (reason?: string): string => {
      if (!reason) return '';

      const reasonMap: Record<string, string> = {
        'customer': 'Requested by customer',
        'inventory': 'Out of stock',
        'fraud': 'Fraud detection',
        'declined': 'Payment declined',
        'other': 'Other reason'
      };

      return reasonMap[reason] || reason.charAt(0).toUpperCase() + reason.slice(1);
    };

    const refundInfo = params.refundAmount && params.currency
      ? `<p><strong>Refund Amount:</strong> ${params.refundAmount} ${params.currency}</p>`
      : '<p><strong>Refund:</strong> Processing automatically (if applicable)</p>';

    const reasonInfo = params.cancelReason
      ? `<p><strong>Cancellation Reason:</strong> ${formatCancelReason(params.cancelReason)}</p>`
      : '';

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Delivery Cancelled</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c757d; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .cancellation-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #dc3545; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .zone-badge { background: #e9ecef; padding: 4px 8px; border-radius: 12px; font-size: 12px; color: #495057; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Delivery Cancelled</h1>
          </div>
          <div class="content">
            <p>Hi ${params.customerName},</p>
            <p>We're writing to inform you that your scheduled delivery has been cancelled for order ${params.orderNumber}.</p>

            <div class="cancellation-details">
              <h3>Cancelled Delivery Details:</h3>
              <p><strong>Order:</strong> ${params.orderNumber} (ID: ${params.orderId})</p>
              <p><strong>Delivery Date:</strong> ${formattedDate}</p>
              <p><strong>Delivery Time:</strong> ${params.timeSlot}</p>
              <p><strong>Delivery Zone:</strong> <span class="zone-badge">${params.zoneName}</span></p>
              ${reasonInfo}
              ${refundInfo}
            </div>

            <p>If you have any questions about your order status, refund, or need assistance with placing a new order, please don't hesitate to contact our customer service team.</p>

            <p>Thank you for your understanding.</p>

            <p>Best regards,<br>Your Delivery Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
  }

  private generateCancellationText(
    params: DeliveryCancellationParams,
    formattedDate: string
  ): string {
    const reasonText = params.cancelReason ? `\nCancellation Reason: ${params.cancelReason}` : '';
    const refundText = params.refundAmount && params.currency
      ? `\nRefund Amount: ${params.refundAmount} ${params.currency}`
      : '\nRefund: Processing automatically (if applicable)';

    return `
Delivery Cancelled - Order ${params.orderNumber}

Hi ${params.customerName},

We're writing to inform you that your scheduled delivery has been cancelled.

Cancelled Delivery Details:
- Order: ${params.orderNumber} (ID: ${params.orderId})
- Delivery Date: ${formattedDate}
- Delivery Time: ${params.timeSlot}
- Delivery Zone: ${params.zoneName}${reasonText}${refundText}

If you have any questions about your order status, refund, or need assistance with placing a new order, please don't hesitate to contact our customer service team.

Thank you for your understanding.

Best regards,
Your Delivery Team
  `.trim();
  }
}
