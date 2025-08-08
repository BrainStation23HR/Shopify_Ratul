import type { DeliverySlot, DeliverySelection } from './types';

/**
 * Format time slot for display
 */
export const formatTimeSlot = (slot: DeliverySlot): string => {
  const spotsLeft = slot.capacity - slot.currentOrders;
  return `${slot.startTime} - ${slot.endTime} (${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} available)`;
};

/**
 * Check if a slot is available
 */
export const isSlotAvailable = (slot: DeliverySlot): boolean => {
  return slot.isActive && slot.currentOrders < slot.capacity;
};

/**
 * Format date for API requests (YYYY-MM-DD)
 */
export const formatDateForAPI = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const parseLabelToISO = (label: string): string => {
  const cleanLabel = label.replace(/^.*?([A-Za-z]+, .*)$/, '$1').trim();
  const match = cleanLabel.match(/^([A-Za-z]+), ([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (!match) return '';

  const [, , monthStr, dayStr, yearStr] = match;

  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  const year = parseInt(yearStr, 10);
  const month = monthMap[monthStr];
  const day = parseInt(dayStr, 10);

  const date = new Date(year, month, day);

  return date.toLocaleDateString('en-CA');
};

/**
 * Format date for display
 */
export const formatDateForDisplay = (date: Date, includeYear = false): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  };

  if (includeYear) {
    options.year = 'numeric';
  }

  return date.toLocaleDateString('en-US', options);
};

/**
 * Get minimum selectable date based on same-day delivery setting
 */
export const getMinSelectableDate = (enableSameDay: boolean): Date => {
  const today = new Date();
  if (enableSameDay) {
    return today;
  }

  // Next day
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return tomorrow;
};

/**
 * Get maximum selectable date based on advance booking setting
 */
export const getMaxSelectableDate = (maxDaysAdvance: number): Date => {
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + maxDaysAdvance);
  return maxDate;
};

/**
 * Check if a date is within selectable range
 */
export const isDateSelectable = (
  date: Date,
  enableSameDay: boolean,
  maxDaysAdvance: number,
  blackoutDates: string[] = []
): boolean => {
  const dateStr = formatDateForAPI(date);

  // Check if it's a blackout date
  if (blackoutDates.includes(dateStr)) {
    return false;
  }

  const minDate = getMinSelectableDate(enableSameDay);
  const maxDate = getMaxSelectableDate(maxDaysAdvance);

  return date >= minDate && date <= maxDate;
};

/**
 * Create API URL with parameters
 */
export const createAPIUrl = (
  endpoint: string,
  params: Record<string, string>
): string => {
  const baseUrl = process.env.SHOPIFY_APP_URL || '';
  const url = new URL(`/apps/delivery-scheduler/${endpoint}`, baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.append(key, value);
    }
  });

  return url.toString();
};

/**
 * Handle API errors consistently
 */
export const handleAPIError = async (response: Response): Promise<string> => {
  if (!response.ok) {
    try {
      const errorData = await response.json();
      return errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    } catch {
      return `HTTP ${response.status}: ${response.statusText}`;
    }
  }
  return '';
};

/**
 * Debounce function for API calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T => {
  let timeout: NodeJS.Timeout;

  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  }) as T;
};

/**
 * Validate delivery selection
 */
export const validateDeliverySelection = (selection: Partial<DeliverySelection>): boolean => {
  return !!(
    selection.slotId &&
    selection.date &&
    selection.zone &&
    selection.slot
  );
};

/**
 * Calculate delivery cost summary
 */
export const calculateDeliveryCost = (baseShipping: number, deliveryRate: number): {
  baseShipping: number;
  deliveryFee: number;
  total: number;
} => {
  return {
    baseShipping,
    deliveryFee: deliveryRate,
    total: baseShipping + deliveryRate
  };
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number, currencyCode = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2
  }).format(amount);
};

/**
 * Parse date string safely
 */
export const parseDate = (dateStr: string): Date | null => {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

/**
 * Generate date range options
 */
export const generateDateOptions = (
  enableSameDay: boolean,
  maxDaysAdvance: number,
  blackoutDates: string[] = []
): Array<{ label: string; value: string }> => {
  const options: Array<{ label: string; value: string }> = [];
  const today = new Date();
  const startDate = getMinSelectableDate(enableSameDay);

  for (let i = 0; i < maxDaysAdvance; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = formatDateForAPI(date);

    // Skip blackout dates
    if (blackoutDates.includes(dateStr)) {
      continue;
    }

    // Format label
    let label = formatDateForDisplay(date);

    const daysDiff = Math.floor((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (daysDiff === 0 && enableSameDay) {
      label = `Today - ${label}`;
    } else if (daysDiff === 1 || (daysDiff === 0 && !enableSameDay)) {
      label = `Tomorrow - ${label}`;
    }

    options.push({ label, value: dateStr });
  }

  return options;
};
