import db from "~/db.server";
import type { DeliverySlot, DeliveryZone } from "@prisma/client";

export interface CreateSlotData {
  shopName: string;
  startTime: string;
  endTime: string;
  capacity: number;
  zoneId: string;
}

export interface SlotWithBookings extends DeliverySlot {
  zone: DeliveryZone;
  currentBookings: number;
  availableCapacity: number;
}

export interface DeliveryEstimate {
  shippingRate: number;
  availableSlots: SlotWithBookings[];
  zone: string;
}

export class DeliveryService {
  async getAvailableSlots(
    shopName: string,
    requestedDate: Date,
    zoneId: string
  ): Promise<SlotWithBookings[]> {
    try {
      const isBlackoutDate = await this.isDateBlackedOut(shopName, requestedDate, zoneId);
      if (isBlackoutDate) {
        return [];
      }

      const slots = await db.deliverySlot.findMany({
        where: {
          shopName,
          zoneId,
          isActive: true,
        },
        include: {
          zone: true
        },
        orderBy: {
          startTime: 'asc'
        }
      });

      const slotsWithBookings = await Promise.all(
        slots.map(async (slot) => {
          const currentBookings = await this.getSlotBookingsForDate(
            slot.id,
            requestedDate
          );

          return {
            ...slot,
            currentBookings,
            availableCapacity: slot.capacity - currentBookings,
            currentOrders: currentBookings
          };
        })
      );

      return slotsWithBookings.filter(slot => slot.availableCapacity > 0);

    } catch (error) {
      console.error('Error fetching available slots:', error);
      throw new Error('Failed to fetch available slots');
    }
  }

  /**
   * Check if a specific date is blacked out
   */
  async isDateBlackedOut(
    shopName: string,
    date: Date,
    zoneId?: string
  ): Promise<boolean> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const exactDateBlackout = await db.blackoutDate.findFirst({
        where: {
          shopName,
          date: {
            gte: startOfDay,
            lte: endOfDay
          },
          OR: [
            { zoneId: zoneId },
            { zoneId: null }
          ]
        }
      });

      if (exactDateBlackout) return true;

      const recurringBlackout = await db.blackoutDate.findFirst({
        where: {
          shopName,
          isRecurring: true,
          OR: [
            { zoneId: zoneId },
            { zoneId: null }
          ]
        }
      });

      if (recurringBlackout) {
        const blackoutMonth = recurringBlackout.date.getMonth();
        const blackoutDay = recurringBlackout.date.getDate();
        const requestedMonth = date.getMonth();
        const requestedDay = date.getDate();

        return blackoutMonth === requestedMonth && blackoutDay === requestedDay;
      }

      return false;

    } catch (error) {
      console.error('Error checking blackout date:', error);
      return false;
    }
  }

  /**
   * Get booking count for a specific slot on a specific date
   */
  async getSlotBookingsForDate(slotId: string, date: Date): Promise<number> {
    try {

      const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      return await db.order.count({
        where: {
          deliverySlotId: slotId,
          status: {
            not: 'CANCELLED'
          },
          deliveryDate: {
            gte: start,
            lt: end,
          },
        }
      });

    } catch (error) {
      console.error('Error counting slot bookings:', error);
      return 0;
    }
  }

  /**
   * Find delivery zone by country code
   */
  async getZoneByCountryCode(
    shopName: string,
    countryCode: string
  ): Promise<DeliveryZone | null> {
    try {
      return await db.deliveryZone.findFirst({
        where: {
          shopName,
          name: countryCode,
          isActive: true
        }
      });
    } catch (error) {
      console.error('Error finding zone by country code:', error);
      throw new Error('Failed to find delivery zone');
    }
  }

  /**
   * Create delivery slot (now date-independent)
   */
  async createDeliverySlot(data: CreateSlotData): Promise<DeliverySlot> {
    try {
      const zone = await db.deliveryZone.findFirst({
        where: {
          id: data.zoneId,
          shopName: data.shopName,
          isActive: true
        }
      });

      if (!zone) {
        throw new Error('Invalid delivery zone for this shop');
      }

      // Check for overlapping time slots in the same zone
      const existingSlots = await db.deliverySlot.findMany({
        where: {
          shopName: data.shopName,
          zoneId: data.zoneId,
          isActive: true,
          OR: [
            {
              startTime: { lte: data.startTime },
              endTime: { gt: data.startTime }
            },
            {
              startTime: { lt: data.endTime },
              endTime: { gte: data.endTime }
            },
            {
              startTime: { gte: data.startTime },
              endTime: { lte: data.endTime }
            }
          ]
        }
      });

      if (existingSlots.length > 0) {
        throw new Error('Time slot overlaps with existing slot');
      }

      return await db.deliverySlot.create({
        data: {
          ...data,
          currentOrders: 0, // Keep for compatibility
          isActive: true
        }
      });

    } catch (error) {
      console.error('Error creating delivery slot:', error);
      throw error;
    }
  }

  /**
   * Check slot availability for a specific date
   */
  async isSlotAvailableForDate(
    slotId: string,
    requestedDate: Date
  ): Promise<boolean> {
    try {
      const slot = await db.deliverySlot.findUnique({
        where: { id: slotId },
        include: { zone: true }
      });

      if (!slot || !slot.isActive) return false;

      const isBlackedOut = await this.isDateBlackedOut(
        slot.shopName,
        requestedDate,
        slot.zoneId
      );
      if (isBlackedOut) return false;

      const currentBookings = await this.getSlotBookingsForDate(slotId, requestedDate);
      return currentBookings < slot.capacity;

    } catch (error) {
      console.error('Error checking slot availability:', error);
      return false;
    }
  }

  /**
   * Get all delivery slots for a shop (for admin interface)
   */
  async getAllSlots(shopName: string, getActiveOnly: boolean = true): Promise<SlotWithBookings[]> {
    let where = {
      shopName,
    }
    if (getActiveOnly) {
      where = {
        shopName,
        // @ts-ignore
        isActive: true
      }
    }
    try {
      const slots = await db.deliverySlot.findMany({
        where,
        include: {
          zone: { select: { name: true } }
        },
        orderBy: [
          { zoneId: 'asc' },
          { startTime: 'asc' }
        ]
      });

      const today = new Date();
      const slotsWithBookings = await Promise.all(
        slots.map(async (slot) => {
          try {
            const currentBookings = await this.getSlotBookingsForDate(slot.id, today);

            return {
              ...slot,
              currentBookings,
              availableCapacity: slot.capacity - currentBookings,
              currentOrders: currentBookings // For compatibility
            };
          } catch (error) {
            console.error(`Error getting bookings for slot ${slot.id}:`, error);
            // Return slot with zero bookings if there's an error
            return {
              ...slot,
              currentBookings: 0,
              availableCapacity: slot.capacity,
              currentOrders: 0
            };
          }
        })
      );

      // @ts-ignore
      return slotsWithBookings;

    } catch (error) {
      console.error('Error fetching all slots:', error);
      throw new Error('Failed to fetch delivery slots');
    }
  }

  /**
   * Get blackout dates as string array (for API responses)
   */
  async getBlackoutDatesAsStrings(shopName: string): Promise<string[]> {
    try {
      const currentYear = new Date().getFullYear();
      const blackoutDates = await db.blackoutDate.findMany({
        where: {
          shopName,
          OR: [
            // Future non-recurring dates
            {
              isRecurring: false,
              date: { gte: new Date() }
            },
            // All recurring dates
            {
              isRecurring: true
            }
          ]
        },
        select: { date: true, isRecurring: true },
        orderBy: { date: 'asc' }
      });

      const allBlackoutDates: string[] = [];

      blackoutDates.forEach(bd => {
        if (bd.isRecurring) {
          // Add this year's and next year's occurrence
          const thisYear = new Date(bd.date);
          thisYear.setFullYear(currentYear);

          const nextYear = new Date(bd.date);
          nextYear.setFullYear(currentYear + 1);

          if (thisYear >= new Date()) {
            allBlackoutDates.push(thisYear.toISOString().split('T')[0]);
          }
          allBlackoutDates.push(nextYear.toISOString().split('T')[0]);
        } else {
          allBlackoutDates.push(bd.date.toISOString().split('T')[0]);
        }
      });

      return allBlackoutDates.sort();

    } catch (error) {
      console.error('Error fetching blackout dates as strings:', error);
      return [];
    }
  }
  async releaseSlot(slotId: string): Promise<boolean> {
    try {
      const result = await db.deliverySlot.updateMany({
        where: {
          id: slotId,
          currentOrders: { gt: 0 }
        },
        data: {
          currentOrders: { decrement: 1 }
        }
      });

      return result.count > 0;
    } catch (error) {
      console.error('Error releasing slot:', error);
      return false;
    }
  }

  async releaseDeliverySlot(params: {
    slotId: string;
    orderId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await db.order.findUnique({
        where: { shopifyOrderId: params.orderId }
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      await db.order.update({
        where: { shopifyOrderId: params.orderId },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });

      return { success: true };

    } catch (error) {
      console.error('Error releasing delivery slot:', error);
      return { success: false, error: 'Failed to release delivery slot' };
    }
  }
}
