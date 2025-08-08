// extensions/delivery-selector/src/types.ts
export interface DeliveryZone {
  id: string;
  name: string;
  shippingRate: number;
}

export interface DeliverySlot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  currentOrders: number;
  date?: string;
  zoneId?: string;
  isActive: boolean;
}

export interface DeliveryEstimate {
  shippingRate: number;
  availableSlots: DeliverySlot[];
  zone: string;
}

export interface ExtensionSettings {
  title?: string;
  enable_same_day?: boolean;
  max_days_advance?: number;
}

export interface DeliverySelection {
  slotId: string;
  date: Date;
  zone: DeliveryZone;
  slot: DeliverySlot;
}

export interface ShopSettings {
  id: string;
  shopName: string;
  cutoffTime: string;
  maxDaysInAdvance: number;
  enableSameDayDelivery: boolean;
  timezone: string;
  businessHours?: any; // JSON object
  createdAt: string;
  updatedAt: string;
}
