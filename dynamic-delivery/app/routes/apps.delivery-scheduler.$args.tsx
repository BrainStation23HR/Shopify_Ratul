import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { DeliveryService } from '~/Services/DeliveryService.server';
import { ShopService } from '~/Services/ShopService.server';
import type { AdminApiContext } from '@shopify/shopify-app-remix/server';

const API_ENDPOINTS = {
  ZONES: 'zones',
  ESTIMATE: 'estimate',
  SLOTS: 'slots',
  BLACKOUT_DATES: 'blackout-dates',
  AVAILABILITY: 'availability',
  SHOP_SETTINGS: 'shop-settings',
  RESERVE_SLOT: 'reserve-slot',
  RELEASE_SLOT: 'release-slot',
} as const;

// GET request handlers
const DeliveryZones = {
  loader: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const countryCode = url.searchParams.get("country_code");
    const shopName = url.searchParams.get("shop");

    if (!countryCode || !shopName) {
      return json({ error: "Country code and shop are required" }, { status: 400 });
    }

    try {
      const deliveryService = new DeliveryService();
      const zone = await deliveryService.getZoneByCountryCode(shopName, countryCode);
      if (!zone) {
        return json({ error: "No delivery zone found for this country" }, { status: 404 });
      }

      // Get available dates using the new method
      // const shopService = new ShopService({} as AdminApiContext);
      // const settings = await shopService.getShopSettings(shopName);

      // const availableDates = await deliveryService.getAvailableDates(
      //   shopName,
      //   countryCode,
      //   settings?.enableSameDayDelivery || false,
      //   settings?.maxDaysInAdvance || 30
      // );

      // const formattedDates = formatAvailableDates(availableDates);
      // console.log("Available dates: ", formattedDates);

      return json({
        id: zone.id,
        name: zone.name,
        // availableDates: formattedDates,
        shippingRate: Number(zone.shippingRate),
      });
    } catch (error) {
      console.error('Zone lookup error:', error);
      return json({ error: "Internal server error" }, { status: 500 });
    }
  }
};

// const formatAvailableDates = (availableDates: string[]) => {
//   const today = new Date();
//   const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
//
//   return availableDates.map(dateStr => {
//     const date = new Date(dateStr);
//
//     let label = date.toLocaleDateString('en-US', {
//       weekday: 'long',
//       month: 'short',
//       day: 'numeric',
//     });
//
//     if (date.toDateString() === today.toDateString()) {
//       label = `Today - ${label}`;
//     } else if (date.toDateString() === tomorrow.toDateString()) {
//       label = `Tomorrow - ${label}`;
//     }
//
//     return {
//       label,
//       value: dateStr,
//     };
//   });
// };

const DeliveryEstimate = {
  loader: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const countryCode = url.searchParams.get("country_code");
    const deliveryDate = url.searchParams.get("delivery_date");
    const shopName = url.searchParams.get("shop");

    if (!countryCode || !deliveryDate || !shopName) {
      return json({ error: "Missing required parameters" }, { status: 400 });
    }

    try {
      const deliveryService = new DeliveryService();
      const date = new Date(deliveryDate);

      if (isNaN(date.getTime())) {
        return json({ error: "Invalid delivery date" }, { status: 400 });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        return json({ error: "Cannot select past dates" }, { status: 400 });
      }

      const zone = await deliveryService.getZoneByCountryCode(shopName, countryCode);

      if (!zone) {
        return json({ error: "Delivery not available in this area" }, { status: 404 });
      }

      // Check if date is blacked out
      const isBlackedOut = await deliveryService.isDateBlackedOut(shopName, date, zone.id);
      if (isBlackedOut) {
        return json({ error: "Selected date is not available for delivery" }, { status: 400 });
      }

      const availableSlots = await deliveryService.getAvailableSlots(shopName, date, zone.id);

      const formattedSlots = availableSlots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        currentOrders: slot.currentBookings || 0,
        date: deliveryDate, // Use the requested date
        zoneId: slot.zoneId,
        isActive: slot.isActive
      }));

      return json({
        shippingRate: Number(zone.shippingRate),
        availableSlots: formattedSlots,
        zone: zone.name,
      });
    } catch (error) {
      console.error('Delivery estimation error:', error);
      return json({ error: "Failed to calculate shipping rate" }, { status: 500 });
    }
  }
};

const DeliverySlots = {
  loader: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const zoneId = url.searchParams.get("zone_id");
    const shopName = url.searchParams.get("shop");

    if (!date || !zoneId || !shopName) {
      return json({ error: "Date, zone_id, and shop are required" }, { status: 400 });
    }

    try {
      const deliveryService = new DeliveryService();
      const requestDate = new Date(date);

      const slots = await deliveryService.getAvailableSlots(shopName, requestDate, zoneId);

      const formattedSlots = slots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        currentOrders: slot.currentBookings || 0,
        date: date, // Use the requested date
        zoneId: slot.zoneId,
        isActive: slot.isActive
      }));

      return json(formattedSlots);
    } catch (error) {
      console.error('Slots fetch error:', error);
      return json({ error: "Failed to fetch available slots" }, { status: 500 });
    }
  }
};

const BlackoutDates = {
  loader: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const shopName = url.searchParams.get("shop");

    if (!shopName) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    try {
      const deliveryService = new DeliveryService();
      const blackoutDates = await deliveryService.getBlackoutDatesAsStrings(shopName);
      return json(blackoutDates);
    } catch (error) {
      console.error('Blackout dates fetch error:', error);
      return json({ error: "Failed to fetch blackout dates" }, { status: 500 });
    }
  }
};

const DeliveryAvailability = {
  loader: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const countryCode = url.searchParams.get("country_code");
    const deliveryDate = url.searchParams.get("deliveryDate");
    const shopName = url.searchParams.get("shop");

    if (!countryCode || !deliveryDate || !shopName) {
      return json({
        success: false,
        error: "Country code and delivery date are required"
      }, { status: 400 });
    }

    try {
      const deliveryService = new DeliveryService();
      const date = new Date(deliveryDate);

      if (isNaN(date.getTime())) {
        return json({
          success: false,
          error: "Invalid delivery date"
        }, { status: 400 });
      }

      const zone = await deliveryService.getZoneByCountryCode(shopName, countryCode);

      if (!zone) {
        return json({
          success: false,
          error: "Delivery not available in this area"
        }, { status: 404 });
      }

      // Check if date is blacked out
      const isBlackedOut = await deliveryService.isDateBlackedOut(shopName, date, zone.id);
      if (isBlackedOut) {
        return json({
          success: false,
          error: "Selected date is not available for delivery"
        });
      }

      const availableSlots = await deliveryService.getAvailableSlots(shopName, date, zone.id);
      const blackoutDates = await deliveryService.getBlackoutDatesAsStrings(shopName);

      const formattedSlots = availableSlots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        currentOrders: slot.currentBookings || 0,
        isAvailable: (slot.currentBookings || 0) < slot.capacity && slot.isActive,
        price: 0
      }));

      return json({
        success: true,
        data: {
          zone: {
            id: zone.id,
            name: zone.name,
            baseRate: Number(zone.shippingRate),
            isActive: true
          },
          slots: formattedSlots,
          blackoutDates,
          cutoffTime: "14:00"
        }
      });
    } catch (error) {
      console.error('Availability check error:', error);
      return json({
        success: false,
        error: "Failed to check availability"
      }, { status: 500 });
    }
  }
};

const DeliveryShopSettings = {
  loader: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const shopName = url.searchParams.get("shop");

    if (!shopName) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    try {
      const shopService = new ShopService({} as AdminApiContext);
      const settings = await shopService.getShopSettings(shopName);
      return json(settings);
    } catch (error) {
      console.error('Shop settings fetch error:', error);
      return json({ error: "Failed to fetch shop settings" }, { status: 500 });
    }
  }
};

// POST request handlers
const ReserveSlot = {
  action: async ({ request }: { request: Request }) => {
    try {
      const body = await request.json();
      const { slotId, deliveryDate } = body;

      if (!slotId || !deliveryDate) {
        return json({ error: "Slot ID and delivery date are required" }, { status: 400 });
      }

      const deliveryService = new DeliveryService();
      const date = new Date(deliveryDate);
      const isAvailable = await deliveryService.isSlotAvailableForDate(slotId, date);

      if (!isAvailable) {
        return json({ error: "Slot is not available for the selected date" }, { status: 409 });
      }

      return json({
        success: true,
        message: "Slot is available for reservation"
      });
    } catch (error) {
      console.error('Slot availability check error:', error);
      return json({ error: "Failed to check slot availability" }, { status: 500 });
    }
  }
};

const ReleaseSlot = {
  action: async ({ request }: { request: Request }) => {
    try {
      const body = await request.json();
      const { slotId, orderId } = body;

      if (!slotId) {
        return json({ error: "Slot ID is required" }, { status: 400 });
      }

      const deliveryService = new DeliveryService();

      if (orderId) {
        // If order ID is provided, use the full release method
        const result = await deliveryService.releaseDeliverySlot({ slotId, orderId });

        if (!result.success) {
          return json({ error: result.error }, { status: 409 });
        }

        return json({ success: true, message: "Order delivery slot released successfully" });
      } else {
        // Otherwise, use the simple slot release
        const success = await deliveryService.releaseSlot(slotId);

        if (!success) {
          return json({ error: "Failed to release slot" }, { status: 409 });
        }

        return json({ success: true, message: "Slot released successfully" });
      }
    } catch (error) {
      console.error('Slot release error:', error);
      return json({ error: "Failed to release slot" }, { status: 500 });
    }
  }
};

// Main loader function
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  // Create CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://extensions.shopifycdn.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    let response;

    switch (params.args) {
      case API_ENDPOINTS.ZONES:
        response = await DeliveryZones.loader({ request });
        break;

      case API_ENDPOINTS.ESTIMATE:
        response = await DeliveryEstimate.loader({ request });
        break;

      case API_ENDPOINTS.SLOTS:
        response = await DeliverySlots.loader({ request });
        break;

      case API_ENDPOINTS.BLACKOUT_DATES:
        response = await BlackoutDates.loader({ request });
        break;

      case API_ENDPOINTS.AVAILABILITY:
        response = await DeliveryAvailability.loader({ request });
        break;

      case API_ENDPOINTS.SHOP_SETTINGS:
        response = await DeliveryShopSettings.loader({ request });
        break;

      default:
        return json({
          message: "Failed to process request",
          status: 400,
          error: 'Invalid endpoint'
        }, {
          status: 400,
          headers: corsHeaders
        });
    }

    // Add CORS headers to the response
    if (response instanceof Response) {
      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...corsHeaders
        }
      });
    }

    return json(await response.json(), { headers: corsHeaders });

  } catch (error) {
    console.error('API Error:', error);
    return json({
      message: "Internal server error",
      status: 500,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: corsHeaders
    });
  }
};

// Main action function
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://extensions.shopifycdn.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    let response;

    switch (params.args) {
      case API_ENDPOINTS.RESERVE_SLOT:
        response = await ReserveSlot.action({ request });
        break;

      case API_ENDPOINTS.RELEASE_SLOT:
        response = await ReleaseSlot.action({ request });
        break;

      default:
        return json({
          message: "Failed to process request",
          status: 400,
          error: 'Invalid action endpoint'
        }, {
          status: 400,
          headers: corsHeaders
        });
    }

    // Add CORS headers to response
    if (response instanceof Response) {
      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...corsHeaders
        }
      });
    }

    return json(await response.json(), { headers: corsHeaders });

  } catch (error) {
    console.error('Action Error:', error);
    return json({
      message: "Internal server error",
      status: 500,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: corsHeaders
    });
  }
};
