import {DeliveryService} from "./DeliveryService.server";
import db from "~/db.server";
import type {OrderStatus} from "@prisma/client";
import {type DeliveryCancellationParams, type DeliveryConfirmationParams, EmailService} from "~/Services/email.server";

const UPDATE_ORDER_MUTATION = `
  mutation orderUpdate($input: OrderInput!) {
    orderUpdate(input: $input) {
      order {
        id
        name
        note
        tags
        updatedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface ShopifyOrderCreated {
  id: number;
  shop_domain: string;
  email: string;
  total_price: string;
  shipping_address: {
    first_name?: string;
    last_name?: string;
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    phone?: string;
  };
  note_attributes?: Array<{ name: string; value: string }>;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
  }>;
}

interface ShopifyOrderCancelled {
  id: number;
  shop_domain: string;
  email: string;
  cancel_reason?: string;
  customer: {
    first_name?: string;
    last_name?: string;
    email?: string;
  }
  note_attributes?: Array<{
    name: string;
    value: string;
  }>;
}

interface DeliverySelection {
  slotId: string;
  deliveryDate: string;
  deliveryInfo?: {
    rate: number;
    method: string;
    title: string;
    date: string;
    timeSlot: string;
    zone: string;
  };
}

export class WebHookService {
  private deliveryService: DeliveryService;
  private emailService: EmailService;
  constructor() {
    this.deliveryService = new DeliveryService();
    this.emailService = new EmailService();
  }

  private async createDirectAPIClient(shop: string) {
    try {
      console.log(`🔄 Attempting direct API client for shop: ${shop}`);

      // Try to get access token from database or environment
      const dbSession = await db.session.findFirst({
        where: {shop: shop},
        orderBy: {id: 'desc'},
        select: {accessToken: true, scope: true}
      });

      if (!dbSession?.accessToken) {
        throw new Error(`No access token found for shop: ${shop}`);
      }

      // Create a minimal session object
      const session = {
        id: `fallback_${shop}`,
        shop: shop,
        accessToken: dbSession.accessToken,
        scope: dbSession.scope,
        isOnline: false
      };

      console.log(`✅ Direct API client created for ${shop}`);

      return {
        admin: null, // We'll use fetch directly
        session: session,
        useFetch: true // Flag to use fetch instead of GraphQL client
      };

    } catch (error) {
      console.error(`❌ Direct API client creation failed for ${shop}:`, error);
      throw new Error(`All session loading methods failed for shop: ${shop}`);
    }
  }

  /**
   * Main webhook processor - routes to specific handlers
   */
  async processWebhook(topic: string, shop: string, payload: any): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`📥 Processing webhook: ${topic} for shop: ${shop}`);
      console.log("payload: ", payload)
      switch (topic) {
        case "ORDERS_CREATE":
        case "orders/create":
          return await this.handleOrderCreated(shop, payload as ShopifyOrderCreated);

        case "ORDERS_CANCELLED":
        case "orders/cancelled":
          return await this.handleOrderCancelled(shop, payload as ShopifyOrderCancelled);

        // case "CHECKOUTS_UPDATE":
        // case "checkouts/update":
          // return await this.handleShippingRatesRequest(shop, payload);

        default:
          console.warn(`⚠️ Unhandled webhook topic: ${topic}`);
          return {success: true, message: `Topic ${topic} acknowledged but not processed`};
      }
    } catch (error) {
      console.error(`❌ Error processing webhook ${topic}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }

  /**
   * Handle order creation webhook - Enhanced with GraphQL updates
   */
  public async handleOrderCreated(
    shopName: string,
    order: ShopifyOrderCreated
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`📦 Processing order ${order.id} for shop: ${shopName}`);
      console.log('📋 Note attributes:', order.note_attributes);

      // Extract delivery information from order
      const deliverySelection = this.extractDeliverySelection(order);

      if (!deliverySelection) {
        console.log(`📦 Order ${order.id}: No delivery slot specified`);
        return {success: true, message: "No delivery slot specified"};
      }

      console.log(`📦 Order ${order.id}: Found delivery selection:`, deliverySelection);

      const {slotId, deliveryDate} = deliverySelection;
      const requestedDate = new Date(deliveryDate);

      // Use transaction for atomicity
      const result = await db.$transaction(async (tx) => {
        // Check slot availability for the specific date
        const slot = await tx.deliverySlot.findUnique({
          where: {id: slotId},
          include: {zone: true}
        });

        if (!slot) {
          throw new Error("Delivery slot not found");
        }

        if (!slot.isActive) {
          throw new Error("Selected delivery slot is no longer active");
        }

        // Check availability for the specific date
        const isAvailable = await this.deliveryService.isSlotAvailableForDate(slotId, requestedDate);
        if (!isAvailable) {
          throw new Error("Selected delivery slot is not available for the requested date");
        }

        console.log(`📦 Order ${order.id}: Slot validated - ${slot.startTime}-${slot.endTime} for ${deliveryDate}`);

        // Create order record with delivery date
        const dbOrder = await tx.order.create({
          data: {
            shopName,
            shopifyOrderId: order.id.toString(),
            customerEmail: order.email,
            deliverySlotId: slotId,
            deliveryDate: requestedDate,
            totalAmount: parseFloat(order.total_price),
            shippingAddress: order.shipping_address as any,
            status: "CONFIRMED" as OrderStatus,
            deliveryNotes: JSON.stringify({
              deliveryDate: deliveryDate,
              timeSlot: `${slot.startTime} - ${slot.endTime}`,
              zone: slot.zone.name
            })
          },
        });

        console.log(`📦 Order ${order.id}: Database record created with ID: ${dbOrder.id}`);
        return {dbOrder, slot, deliveryDate};
      });

      // Update Shopify order with GraphQL
      await this.updateShopifyOrder(shopName, order.id, {
        deliverySelection,
        slot: result.slot,
        deliveryDate,
        noteAttributes: order.note_attributes
      });

      // Send confirmation email (non-blocking)
      const params: DeliveryConfirmationParams = {
        customerEmail: order.email,
        customerName: `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim() || 'Customer',
        orderId: order.id.toString(),
        deliveryDate: deliveryDate,
        timeSlot: `${result.slot.startTime} - ${result.slot.endTime}`,
        shippingAddress: {
          first_name: order.shipping_address.first_name || '',
          last_name: order.shipping_address.last_name || '',
          address1: order.shipping_address.address1 || '',
          city: order.shipping_address.city || '',
          province: order.shipping_address.province || '',
          country: order.shipping_address.country || '',
          zip: order.shipping_address.zip || '',
        }
      };

      this.emailService.sendDeliveryConfirmation(params)
        .then(() => console.log(`📧 Order ${order.id}: Confirmation email sent`))
        .catch(error => console.error(`📧 Order ${order.id}: Failed to send confirmation email:`, error));

      console.log(`✅ Order ${order.id}: Successfully processed delivery booking for ${deliveryDate}`);
      return {success: true, message: "Order processed successfully"};

    } catch (error) {
      console.error("❌ Order webhook processing failed:", error);

      // For business logic errors, return success to prevent Shopify retries
      if (error instanceof Error && (
        error.message.includes('slot') ||
        error.message.includes('not found') ||
        error.message.includes('available')
      )) {
        return {
          success: true,
          message: "Order processed",
          error: error.message
        };
      }

      return {success: false, error: error instanceof Error ? error.message : "Unknown error"};
    }
  }

  /**
   * Update Shopify order using GraphQL API
   */
  private async updateShopifyOrder(
    shopName: string,
    orderId: number,
    updateData: {
      deliverySelection: any;
      slot: any;
      deliveryDate: string;
      noteAttributes?: Array<{ name: string; value: string }>;
    }
  ): Promise<void> {
    try {
      // Create admin client using session storage (with fallbacks)
      const {session} = await this.createDirectAPIClient(shopName);

      // Extract shipping rate from note_attributes
      const customShippingRate = updateData.noteAttributes?.find(
        attr => attr.name === 'custom_shipping_rate'
      )?.value;

      // Build comprehensive order notes
      const orderNotes = this.buildOrderNotes(updateData.noteAttributes, {
        deliveryDate: updateData.deliveryDate,
        timeSlot: `${updateData.slot.startTime} - ${updateData.slot.endTime}`,
        zoneName: updateData.slot.zone.name,
        slotId: updateData.deliverySelection.slotId
      });

      // Build tags array
      const tags = [
        'scheduled_delivery',
        `delivery_zone:${updateData.slot.zone.name}`,
        `delivery_date:${updateData.deliveryDate}`
      ];

      if (customShippingRate) {
        tags.push(`custom_shipping_rate:${customShippingRate}`);
      }

      // Convert numeric order ID to GraphQL ID
      const gqlOrderId = `gid://shopify/Order/${orderId}`;

      // Update shipping rate if needed
      if (customShippingRate) {
        await this.updateShippingRateWithFetch(shopName, session, gqlOrderId, parseFloat(customShippingRate));
      }

      // Use direct fetch approach
      await this.updateOrderWithFetch(shopName, session, gqlOrderId, orderNotes, tags);

    } catch (error) {
      console.error(`❌ Failed to update Shopify order ${orderId} with GraphQL:`, error);

      // Log the delivery info even if update fails
      console.log(`📝 Order ${orderId}: Delivery scheduled for ${updateData.deliveryDate} (${updateData.slot.startTime} - ${updateData.slot.endTime})`);
    }
  }

  private async updateOrderWithFetch(
    shopName: string,
    session: any,
    gqlOrderId: string,
    orderNotes: string,
    tags: string[]
  ): Promise<void> {
    const response = await fetch(`https://${shopName}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': session.accessToken,
      },
      body: JSON.stringify({
        query: UPDATE_ORDER_MUTATION,
        variables: {
          input: {
            id: gqlOrderId,
            note: orderNotes,
            tags: tags.join(', ')
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    if (result.data?.orderUpdate?.userErrors?.length > 0) {
      throw new Error(`Order update failed: ${result.data.orderUpdate.userErrors[0].message}`);
    }
  }

  /**
   * Update shipping rate using direct fetch (fallback method)
   */
  private async updateShippingRateWithFetch(
    shopName: string,
    session: any,
    gqlOrderId: string,
    newShippingRate: number
  ): Promise<void> {
    try {
      console.log(`💰 Updating shipping rate via fetch for order ${gqlOrderId}`);

      // For simplicity, just add the shipping info to order notes as fallback
      const additionalNote = `\n\nShipping Update: Custom delivery fee of ${newShippingRate} applied via webhook.`;

      const response = await fetch(`https://${shopName}/admin/api/2025-07/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': session.accessToken,
        },
        body: JSON.stringify({
          query: `
            mutation orderUpdate($input: OrderInput!) {
              orderUpdate(input: $input) {
                order { id note }
                userErrors { field message }
              }
            }
          `,
          variables: {
            input: {
              id: gqlOrderId,
              note: additionalNote
            }
          }
        })
      });

      if (response.ok) {
        console.log(`✅ Shipping rate info added to order notes`);
      }

    } catch (error) {
      console.error(`❌ Failed to update shipping rate via fetch:`, error);
    }
  }

  /**
   * Build comprehensive order notes from note_attributes
   */
  private buildOrderNotes(
    noteAttributes?: Array<{ name: string; value: string }>,
    deliveryInfo?: {
      deliveryDate: string;
      timeSlot: string;
      zoneName: string;
      slotId: string;
    }
  ): string {
    const notes: string[] = [];

    // Add delivery information header
    if (deliveryInfo) {
      notes.push('🚚 SCHEDULED DELIVERY CONFIRMED');
      notes.push('━━━━━━━━━━━━━━━━━━━');
      notes.push(`📅 Date: ${new Date(deliveryInfo.deliveryDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`);
      notes.push(`⏰ Time: ${deliveryInfo.timeSlot}`);
      notes.push(`📍 Zone: ${deliveryInfo.zoneName}`);
      notes.push(`🔖 Slot ID: ${deliveryInfo.slotId}`);
      notes.push('');
    }

    // Add formatted note attributes
    if (noteAttributes && noteAttributes.length > 0) {
      notes.push('📋 ORDER DETAILS & CUSTOMER ATTRIBUTES');
      notes.push('━━━━━━━━━━━━━━━━━━━');
      noteAttributes.forEach(attr => {
        // Format different attribute types
        if (attr.name === 'delivery_info') {
          try {
            const info = JSON.parse(attr.value);
            notes.push('🚛 Delivery Selection Details:');
            notes.push(`   • Method: ${info.method || 'N/A'}`);
            notes.push(`   • Title: ${info.title || 'N/A'}`);
            notes.push(`   • Rate: ${info.rate || 'N/A'}`);
            notes.push(`   • Date: ${info.date || 'N/A'}`);
            notes.push(`   • Time Slot: ${info.timeSlot || 'N/A'}`);
            notes.push(`   • Zone: ${info.zone || 'N/A'}`);
          } catch {
            notes.push(`📝 ${attr.name}: ${attr.value}`);
          }
        } else if (attr.name === 'delivery_zone') {
          try {
            const zone = JSON.parse(attr.value);
            notes.push('📍 Delivery Zone Details:');
            notes.push(`   • Name: ${zone.name || 'N/A'}`);
            notes.push(`   • Shipping Rate: ${zone.shippingRate || 'N/A'}`);
            notes.push(`   • Zone ID: ${zone.id || 'N/A'}`);
          } catch {
            notes.push(`📝 ${attr.name}: ${attr.value}`);
          }
        } else if (attr.name === 'custom_shipping_rate') {
          notes.push(`💰 Custom Shipping Rate: $${attr.value}`);
        } else if (attr.name === 'delivery_date') {
          notes.push(`📅 Requested Delivery Date: ${attr.value}`);
        } else if (attr.name === 'delivery_slot_id') {
          notes.push(`🏷️ Delivery Slot ID: ${attr.value}`);
        } else {
          // Format other attributes nicely
          const displayName = attr.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          notes.push(`📝 ${displayName}: ${attr.value}`);
        }
      });
    }

    notes.push('');
    notes.push('━━━━━━━━━━━━━━━━━━━');
    notes.push('🔄 Generated automatically by Delivery Scheduler');
    notes.push(`📅 Updated: ${new Date().toLocaleString()}`);
    notes.push('📞 For delivery changes, contact customer service');

    return notes.join('\n');
  }

  /**
   * Handle order cancellation webhook
   */
  private async handleOrderCancelled(shop: string, order: ShopifyOrderCancelled): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`🚫 Processing order cancellation ${order.id} for shop: ${shop}`);

      // Use transaction for atomicity
      const result = await db.$transaction(async (tx) => {
        // Find the order in our database
        const dbOrder = await tx.order.findUnique({
          where: {shopifyOrderId: order.id.toString()},
          include: {deliverySlot: {include: {zone: true}}},
        });

        if (!dbOrder) {
          throw new Error("Order not found in local database");
        }

        if (dbOrder.status === "CANCELLED") {
          return {dbOrder, alreadyCancelled: true};
        }

        // Update order status
        const updatedOrder = await tx.order.update({
          where: {id: dbOrder.id},
          data: {status: "CANCELLED" as OrderStatus},
          include: {deliverySlot: {include: {zone: true}}}
        });

        console.log(`🚫 Order ${order.id}: Status updated to CANCELLED`);

        return {dbOrder: updatedOrder, alreadyCancelled: false};
      });

      // Send cancellation email only if order wasn't already cancelled
      if (!result.alreadyCancelled) {
        console.log(`🚫 Order ${order.id}: Delivery slot released (order cancelled)`);

        // Extract delivery info from Shopify webhook or database
        const deliveryInfo = this.extractDeliveryInfoFromWebhook(order.note_attributes);
        const deliveryDate = deliveryInfo.deliveryDate || this.getDeliveryDateFromOrder(result.dbOrder);

        const params: DeliveryCancellationParams = {
          customerEmail: order.email,
          customerName: this.formatCustomerName(order.customer),
          orderId: order.id.toString(),
          orderNumber: `#${order.id}`, // Using order ID as fallback
          deliveryDate: deliveryDate,
          timeSlot: deliveryInfo.timeSlot ||
            (result.dbOrder.deliverySlot ?
              `${result.dbOrder.deliverySlot.startTime} - ${result.dbOrder.deliverySlot.endTime}` :
              'N/A'),
          zoneName: deliveryInfo.zoneName ||
            result.dbOrder.deliverySlot?.zone?.name ||
            'N/A',
          cancelReason: order.cancel_reason,
          refundAmount: undefined, // Not available in cancellation webhook
          currency: undefined
        };

        // Send cancellation email (non-blocking)
        this.emailService.sendDeliveryCancellation(params)
          .then(() => console.log(`📧 Order ${order.id}: Cancellation email sent to ${params.customerEmail}`))
          .catch(error => console.error(`📧 Order ${order.id}: Failed to send cancellation email:`, error));
      }

      console.log(`✅ Order ${order.id}: Successfully processed cancellation`);
      return {success: true, message: "Order cancellation processed successfully"};

    } catch (error) {
      console.error("❌ Order cancellation webhook failed:", error);

      if (error instanceof Error && error.message.includes('not found')) {
        return {success: true, message: "Order not found in local database, no action needed"};
      }

      return {success: false, error: error instanceof Error ? error.message : "Unknown error"};
    }
  }

  /**
   * Extract delivery information from Shopify webhook note_attributes
   */
  private extractDeliveryInfoFromWebhook(noteAttributes?: Array<{ name: string; value: string }>): {
    deliveryDate?: string;
    timeSlot?: string;
    zoneName?: string;
  } {
    if (!noteAttributes) return {};

    const deliveryInfo = noteAttributes.find(attr => attr.name === 'delivery_info')?.value;
    const deliveryZone = noteAttributes.find(attr => attr.name === 'delivery_zone')?.value;

    try {
      const info = deliveryInfo ? JSON.parse(deliveryInfo) : {};
      const zone = deliveryZone ? JSON.parse(deliveryZone) : {};

      return {
        deliveryDate: info.date,
        timeSlot: info.timeSlot,
        zoneName: zone.name || info.zone
      };
    } catch (error) {
      console.error('❌ Failed to parse delivery info from note_attributes:', error);
      return {};
    }
  }

  /**
   * Helper method to format customer name safely
   */
  private formatCustomerName(customer?: { first_name?: string; last_name?: string }): string {
    if (!customer) return 'Valued Customer';

    const firstName = customer.first_name?.trim() || '';
    const lastName = customer.last_name?.trim() || '';

    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Valued Customer';
  }

  /**
   * Extract delivery selection from order data - Updated for new format
   */
  private extractDeliverySelection(order: ShopifyOrderCreated): DeliverySelection | null {
    // First, try to get from metafields
    if (order.metafields) {
      const deliveryMetafield = order.metafields.find(
        mf => mf.namespace === 'delivery_scheduler' && mf.key === 'selection'
      );

      if (deliveryMetafield?.value) {
        try {
          return JSON.parse(deliveryMetafield.value) as DeliverySelection;
        } catch (error) {
          console.error('❌ Failed to parse delivery selection from metafield:', error);
        }
      }
    }

    // Fallback: check note attributes for the new format
    const deliverySlotId = order.note_attributes?.find(
      attr => attr.name === "delivery_slot_id"
    )?.value;

    const deliveryDate = order.note_attributes?.find(
      attr => attr.name === "delivery_date"
    )?.value;

    const deliveryInfo = order.note_attributes?.find(
      attr => attr.name === "delivery_info" || attr.name === "delivery_metadata"
    )?.value;

    if (deliverySlotId && deliveryDate) {
      let parsedDeliveryInfo = null;

      if (deliveryInfo) {
        try {
          parsedDeliveryInfo = JSON.parse(deliveryInfo);
        } catch (error) {
          console.error('❌ Failed to parse delivery info from note attributes:', error);
        }
      }

      return {
        slotId: deliverySlotId,
        deliveryDate: deliveryDate,
        deliveryInfo: parsedDeliveryInfo
      };
    }

    // Legacy fallback: old format with delivery_info containing date
    const legacyDeliveryInfo = order.note_attributes?.find(
      attr => attr.name === "delivery_info"
    )?.value;

    if (deliverySlotId && legacyDeliveryInfo) {
      try {
        const parsedInfo = JSON.parse(legacyDeliveryInfo);
        if (parsedInfo.date) {
          return {
            slotId: deliverySlotId,
            deliveryDate: parsedInfo.date,
            deliveryInfo: parsedInfo
          };
        }
      } catch (error) {
        console.error('❌ Failed to parse legacy delivery info:', error);
      }
    }

    console.log('⚠️ No valid delivery selection found in order attributes');
    return null;
  }

  /**
   * Get delivery date from order notes (helper for backward compatibility)
   */
  private getDeliveryDateFromOrder(dbOrder: any): string {
    if (dbOrder.deliveryNotes) {
      try {
        const notes = JSON.parse(dbOrder.deliveryNotes);
        if (notes.deliveryDate) {
          return notes.deliveryDate;
        }
      } catch (error) {
        console.error('❌ Failed to parse delivery notes:', error);
      }
    }

    // Fallback to tomorrow if no date found
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

}
