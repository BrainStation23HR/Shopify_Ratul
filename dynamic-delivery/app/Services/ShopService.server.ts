import db from "../db.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { Prisma, Shop, ShopSettings, DeliveryZone } from "@prisma/client";

const GET_SHOP = `
query {
  shop {
    id
    name
    shopOwnerName
    contactEmail
    email
    myshopifyDomain
    timezoneAbbreviation
    url
    plan {
      displayName
      shopifyPlus
      partnerDevelopment
    }
    primaryDomain {
      localization {
        defaultLocale
      }
    }
  }
}`;

interface ShopifyShopData {
  id: string;
  name: string;
  shopOwnerName: string;
  contactEmail: string;
  email: string;
  myshopifyDomain: string;
  timezoneAbbreviation: string;
  url: string;
  plan: {
    displayName: string;
    shopifyPlus: boolean;
    partnerDevelopment: boolean;
  };
  primaryDomain: {
    localization: {
      defaultLocale: string;
    };
  };
}

export class ShopService {
  private readonly admin: AdminApiContext;

  constructor(admin: AdminApiContext) {
    this.admin = admin;
  }

  /**
   * Upsert shop data from Shopify to local database
   */
  async upsertShop(): Promise<Shop> {
    try {
      const shopData = await this.getShopFromShopify();
      return await this.upsertShopData(shopData);
    } catch (error) {
      console.error('Error in upsertShop:', error);
      throw error;
    }
  }

  /**
   * Upsert shop data to database
   */
  private async upsertShopData(shopData: Omit<Shop, "id" | "created_at" | "updated_at" | "deleted_at">): Promise<Shop> {
    return db.shop.upsert({
      where: { name: shopData.name },
      update: {
        shopify_id: shopData.shopify_id,
        shop_owner_name: shopData.shop_owner_name,
        email: shopData.email,
        contact_email: shopData.contact_email,
        localization: shopData.localization,
        timezone: shopData.timezone,
        shopify_domain: shopData.shopify_domain,
        shopify_plan: shopData.shopify_plan as Prisma.InputJsonValue,
        status: true,
        onboarding_completed: shopData.onboarding_completed,
        deleted_at: null,
        updated_at: new Date()
      },
      create: {
        ...shopData,
        shopify_plan: shopData.shopify_plan as Prisma.InputJsonValue,
        status: true,
        is_premium: false,
        onboarding_completed: false
      }
    });
  }

  /**
   * Get shop by name from database
   */
  async getShopByName(name: string): Promise<Shop | null> {
    return db.shop.findUnique({
      where: { name },
      include: {
        ShopSettings: true,
        DeliveryZone: true
      }
    });
  }

  /**
   * Fetch shop data from Shopify GraphQL API
   */
  private async getShopFromShopify(): Promise<Omit<Shop, "id" | "created_at" | "updated_at" | "deleted_at">> {
    const response = await this.admin.graphql(GET_SHOP);
    const data = await response.json();

    if (!data.data?.shop) {
      throw new Error('Failed to fetch shop data from Shopify');
    }

    const shop: ShopifyShopData = data.data.shop;
    const shopify_id = shop.id.replace("gid://shopify/Shop/", "");

    // Check existing shop for onboarding status
    const existingShop = await this.getShopByName(shop.myshopifyDomain);

    return {
      shopify_id,
      name: shop.myshopifyDomain,
      shop_owner_name: shop.shopOwnerName,
      email: shop.email,
      contact_email: shop.contactEmail,
      localization: shop.primaryDomain?.localization?.defaultLocale || 'en',
      timezone: shop.timezoneAbbreviation ? `UTC${shop.timezoneAbbreviation}:00` : "UTC+00:00",
      shopify_domain: shop.url,
      shopify_plan: shop.plan,
      subscription_id: existingShop?.subscription_id || "",
      is_premium: existingShop?.is_premium || false,
      status: true,
      onboarding_completed: existingShop?.onboarding_completed || false
    };
  }

  /**
   * Get shop settings, create default if not exists
   */
  async getShopSettings(shopName: string): Promise<ShopSettings | null> {
    try {
      let settings = await db.shopSettings.findUnique({
        where: { shopName }
      });

      // Create default settings if none exist
      if (!settings) {
        settings = await db.shopSettings.create({
          data: {
            shopName,
            cutoffTime: "14:00",
            maxDaysInAdvance: 30,
            enableSameDayDelivery: false
          }
        });
      }

      return settings;
    } catch (error) {
      console.error('Error fetching shop settings:', error);
      return null;
    }
  }

  /**
   * Update shop settings
   */
  async updateShopSettings(shopName: string, settings: Partial<ShopSettings>): Promise<ShopSettings> {
    return db.shopSettings.upsert({
      where: { shopName },
      create: {
        shopName,
        cutoffTime: settings.cutoffTime || "14:00",
        maxDaysInAdvance: settings.maxDaysInAdvance || 30,
        enableSameDayDelivery: settings.enableSameDayDelivery || false,
      },
      // @ts-ignore
      update: {
        ...settings,
        updatedAt: new Date()
      },
    });
  }

  /**
   * Get all delivery zones for a shop
   */
  async getDeliveryZones(shopName: string): Promise<DeliveryZone[]> {
    try {
      const result = await db.deliveryZone.findMany({
        where: { shopName },
        orderBy: { name: 'asc' }
      });

      return result;
    } catch (error) {
      console.error('Error fetching delivery zones:', error);
      throw new Error('Failed to fetch delivery zones');
    }
  }

  /**
   * Create a new delivery zone
   */
  async createDeliveryZone(shopName: string, data: {
    name: string;
    shippingRate: number;
  }): Promise<DeliveryZone> {
    try {
      // Validate shop exists
      const shop = await this.getShopByName(shopName);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Check for duplicate zone name
      const existingZone = await db.deliveryZone.findFirst({
        where: {
          shopName,
          name: data.name
        }
      });

      if (existingZone) {
        throw new Error('A delivery zone with this name already exists');
      }

      return await db.deliveryZone.create({
        data: {
          shopName,
          name: data.name.trim(),
          shippingRate: data.shippingRate,
        },
      });
    } catch (error) {
      console.error('Error creating delivery zone:', error);
      throw error;
    }
  }

  async toggleDeliveryZone(
    shopName: string,
    zoneId: string,
  ): Promise<DeliveryZone> {
    try {
      // Verify zone belongs to shop
      const existingZone = await db.deliveryZone.findFirst({
        where: { id: zoneId, shopName }
      });

      if (!existingZone) {
        throw new Error('Delivery zone not found or access denied');
      }

      return await db.deliveryZone.update({
        where: { id: zoneId },
        data: {
          isActive: !existingZone.isActive
        }
      });
    } catch (error) {
      console.error('Error toggling delivery zone:', error);
      throw error;
    }
  }

  async hasActiveSlots(shopName: string, zoneId: string): Promise<boolean> {
    try {
      // Check if there are any active delivery slots for the zone
      const slotsCount = await db.deliverySlot.count({
        where: {
          zoneId,
          shopName,
          isActive: true
        }
      });

      return slotsCount > 0;
    } catch (error) {
      console.error('Error checking active delivery slots:', error);
      throw error;
    }
  }

  /**
   * Update delivery zone
   */
  async updateDeliveryZone(
    zoneId: string,
    shopName: string,
    data: Partial<{
      name: string;
      shippingRate: number;
    }>
  ): Promise<DeliveryZone> {
    try {
      // Verify zone belongs to shop
      const existingZone = await db.deliveryZone.findFirst({
        where: { id: zoneId, shopName }
      });

      if (!existingZone) {
        throw new Error('Delivery zone not found or access denied');
      }

      const updateData: any = {};

      if (data.name) {
        updateData.name = data.name.trim();
      }

      if (data.shippingRate !== undefined) {
        updateData.shippingRate = data.shippingRate;
      }

      return await db.deliveryZone.update({
        where: { id: zoneId },
        data: updateData
      });
    } catch (error) {
      console.error('Error updating delivery zone:', error);
      throw error;
    }
  }

  /**
   * Delete delivery zone (soft delete by checking if it has associated slots)
   */
  async deleteDeliveryZone(zoneId: string, shopName: string): Promise<boolean> {
    try {
      // Check if zone has associated delivery slots
      const slotsCount = await db.deliverySlot.count({
        where: { zoneId }
      });

      if (slotsCount > 0) {
        throw new Error('Cannot delete zone with existing delivery slots');
      }

      await db.deliveryZone.delete({
        where: {
          id: zoneId,
          shopName // Ensure zone belongs to the shop
        }
      });

      return true;
    } catch (error) {
      console.error('Error deleting delivery zone:', error);
      throw error;
    }
  }
}
