import { useState, useEffect, useCallback } from 'react';
import type {DeliveryZone, DeliveryEstimate, ShopSettings} from './types';
import { handleAPIError, formatDateForAPI } from './utils';

const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL;

/**
 * Hook to fetch delivery zone by country code
 */
export const useDeliveryZone = (
  countryCode: string | undefined,
  shopDomain: string | undefined
) => {
  const [zone, setZone] = useState<DeliveryZone | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!countryCode || !shopDomain) {
      setZone(null);
      setError('');
      return;
    }

    const fetchZone = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `${SHOPIFY_APP_URL}/apps/delivery-scheduler/zones?country_code=${encodeURIComponent(countryCode)}&shop=${shopDomain}`
        );

        if (response.status === 404) {
          setError('Delivery is not available in your area.');
          setZone(null);
          return;
        }

        const errorMessage = await handleAPIError(response);
        if (errorMessage) {
          setError(errorMessage);
          setZone(null);
          return;
        }

        const zoneData: DeliveryZone = await response.json();
        setZone(zoneData);
        setError('');

      } catch (err) {
        console.error('Error fetching delivery zone:', err);
        setError('Unable to check delivery availability.');
        setZone(null);
      } finally {
        setLoading(false);
      }
    };

    fetchZone();
  }, [countryCode, shopDomain]);

  return { zone, loading, error };
};

/**
 * Hook to fetch delivery estimate and available slots
 */
export const useDeliveryEstimate = (
  countryCode: string | undefined,
  deliveryDate: Date | null,
  shopDomain: string | undefined
) => {
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!countryCode || !deliveryDate || !shopDomain) {
      setEstimate(null);
      setError('');
      return;
    }

    const fetchEstimate = async () => {
      setLoading(true);
      setError('');

      try {
        const dateStr = formatDateForAPI(deliveryDate);
        const response = await fetch(
          `${SHOPIFY_APP_URL}/apps/delivery-scheduler/estimate?country_code=${encodeURIComponent(countryCode)}&delivery_date=${dateStr}&shop=${shopDomain}`
        );

        const errorMessage = await handleAPIError(response);
        if (errorMessage) {
          setError(errorMessage);
          setEstimate(null);
          return;
        }

        const estimateData: DeliveryEstimate = await response.json();
        setEstimate(estimateData);

        if (!estimateData.availableSlots || estimateData.availableSlots.length === 0) {
          setError('No delivery slots available for this date.');
        } else {
          setError('');
        }

      } catch (err) {
        console.error('Error fetching delivery estimate:', err);
        setError('Unable to load delivery slots.');
        setEstimate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEstimate();
  }, [countryCode, deliveryDate, shopDomain]);

  return { estimate, loading, error };
};

/**
 * Hook to manage delivery selection state
 */
export const useDeliverySelection = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  const resetSelection = useCallback(() => {
    setSelectedDate(null);
    setSelectedSlot('');
  }, []);

  const resetSlotSelection = useCallback(() => {
    setSelectedSlot('');
  }, []);

  return {
    selectedDate,
    selectedSlot,
    setSelectedDate,
    setSelectedSlot,
    resetSelection,
    resetSlotSelection
  };
};

/**
 * Hook to manage blackout dates
 */
export const useBlackoutDates = (shopDomain: string | undefined) => {
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopDomain) return;

    const fetchBlackoutDates = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${SHOPIFY_APP_URL}/apps/delivery-scheduler/blackout-dates?shop=${shopDomain}`
        );

        if (response.ok) {
          const blackouts = await response.json();
          setBlackoutDates(blackouts.map((date: string) => date.split('T')[0]));
        }
      } catch (err) {
        console.error('Error fetching blackout dates:', err);
        // Continue without blackout dates
      } finally {
        setLoading(false);
      }
    };

    fetchBlackoutDates();
  }, [shopDomain]);

  const isBlackoutDate = useCallback((date: Date): boolean => {
    const dateStr = formatDateForAPI(date);
    return blackoutDates.includes(dateStr);
  }, [blackoutDates]);

  return { blackoutDates, loading, isBlackoutDate };
};

/**
 * Hook to manage available date options
 */
export const useDateOptions = (
  enableSameDay: boolean,
  maxDaysAdvance: number,
  blackoutDates: string[]
) => {
  return useCallback(() => {
    const options: Array<{ label: string; value: string }> = [];
    const today = new Date();
    const startDate = enableSameDay ? today : new Date(today.getTime() + 24 * 60 * 60 * 1000);

    for (let i = 0; i < maxDaysAdvance; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = formatDateForAPI(date);

      // Skip blackout dates
      if (blackoutDates.includes(dateStr)) {
        continue;
      }

      // Format label
      let label = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });

      if (i === 0 && enableSameDay) {
        label = `Today - ${label}`;
      } else if (i === 1 || (i === 0 && !enableSameDay)) {
        label = `Tomorrow - ${label}`;
      }

      options.push({ label, value: dateStr });
    }

    return options;
  }, [enableSameDay, maxDaysAdvance, blackoutDates]);
};


/**
 * Hook to fetch shop settings
 */
export const useShopSettings = (
  shopDomain: string | undefined
) => {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!shopDomain) {
      setSettings(null);
      setError('');
      return;
    }

    const fetchSettings = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `${SHOPIFY_APP_URL}/apps/delivery-scheduler/shop-settings?shop=${encodeURIComponent(shopDomain)}`
        );

        if (response.status === 404) {
          setError('Shop settings not found.');
          setSettings(null);
          return;
        }

        const errorMessage = await handleAPIError(response);
        if (errorMessage) {
          setError(errorMessage);
          setSettings(null);
          return;
        }

        const settingsData: ShopSettings = await response.json();
        setSettings(settingsData);
        setError('');

      } catch (err) {
        console.error('Error fetching shop settings:', err);
        setError('Unable to load shop settings.');
        setSettings(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [shopDomain]);

  return { settings, loading, error };
};
