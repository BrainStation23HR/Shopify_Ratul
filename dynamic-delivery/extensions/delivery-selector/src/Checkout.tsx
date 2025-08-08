import {
  reactExtension,
  useShippingAddress,
  useCartLines,
  BlockStack,
  InlineStack,
  Text,
  Heading,
  Select,
  Grid,
  Spinner,
  Banner,
  useShop,
  useApplyAttributeChange,
  useAttributes,
} from '@shopify/ui-extensions-react/checkout';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDeliveryZone, useDeliveryEstimate, useDeliverySelection, useShopSettings} from './hooks';
import {formatTimeSlot, isSlotAvailable, formatDateForAPI, parseLabelToISO} from './utils';

// Utility function to check if slot end time exceeds cutoff
const isSlotPastCutoff = (slotEndTime: string, cutoffTime: string): boolean => {
  const [slotHour, slotMinute] = slotEndTime.split(':').map(Number);
  const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);

  const slotMinutes = slotHour * 60 + slotMinute;
  const cutoffMinutes = cutoffHour * 60 + cutoffMinute;

  return slotMinutes > cutoffMinutes;
};

// Get next available date after cutoff violation
const getNextAvailableDate = (currentDate: Date, enableSameDay: boolean): Date => {
  const nextDay = new Date(currentDate);
  nextDay.setDate(currentDate.getDate() + 1);
  return nextDay;
};

// Main extension export
export default reactExtension(
  'purchase.checkout.delivery-address.render-before',
  () => <DeliveryScheduler/>
);

function DeliveryScheduler() {
  const shippingAddress = useShippingAddress();
  const cartLines = useCartLines();
  const shop = useShop();
  const applyAttributeChange = useApplyAttributeChange();
  const attributes = useAttributes();

  // State for cutoff notifications
  const [cutoffNotification, setCutoffNotification] = useState<string | null>(null);

  // Prevent infinite loops
  const lastAppliedRef = useRef<string>('');

  const countryCode = shippingAddress?.countryCode;
  const shopDomain = shop.myshopifyDomain;

  // Custom hooks for state management
  const {zone: deliveryZone, loading: zoneLoading, error: zoneError} = useDeliveryZone(
    countryCode,
    shopDomain
  );

  const {settings} = useShopSettings(shopDomain);
  const enableSameDay = settings?.enableSameDayDelivery || false;
  const extensionTitle = 'Select Delivery Time';
  const maxDaysAdvance = settings?.maxDaysInAdvance || 30;
  const cutoffTime = settings?.cutoffTime || '14:00';

  const {
    selectedDate,
    selectedSlot,
    setSelectedDate,
    setSelectedSlot,
    resetSlotSelection
  } = useDeliverySelection();

  const {
    estimate,
    loading: slotsLoading,
    error: slotsError
  } = useDeliveryEstimate(
    countryCode,
    selectedDate,
    shopDomain
  );

  // Check if delivery is needed (has physical products)
  const hasPhysicalProducts = useMemo(() =>
    cartLines.some(line =>
      line.merchandise &&
      line.merchandise.product &&
      line.merchandise.type === 'variant' &&
      // @ts-ignore
      !line.merchandise.product.isGiftCard &&
      line.merchandise.requiresShipping === true
    ), [cartLines]
  );

  // Generate date options based on settings
  const dateOptions = useMemo(() => {
    if (!deliveryZone) return [];

    const options: Array<{ label: string; value: string }> = [];
    const today = new Date();
    const startDate = enableSameDay ? today : new Date(today.getTime() + 24 * 60 * 60 * 1000);

    for (let i = 0; i < maxDaysAdvance; i++) {
      if (i === 0 && !enableSameDay) {
        i++;
      }
      if (i >= maxDaysAdvance) break;

      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);

      let label = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      if (i === 1 || (i === 0 && !enableSameDay)) {
        label = `Tomorrow - ${label}`;
      }

      const dateStr = parseLabelToISO(label);
      options.push({label, value: dateStr});
    }

    return options;
  }, [deliveryZone, enableSameDay, maxDaysAdvance]);

  // Generate slot options
  const slotOptions = useMemo(() => {
    if (!estimate?.availableSlots) {
      return [{label: 'No slots available', value: '', disabled: true}];
    }

    const availableSlots = estimate.availableSlots.filter(isSlotAvailable);

    if (availableSlots.length === 0) {
      return [{label: 'No slots available', value: '', disabled: true}];
    }

    return [
      {label: 'Choose a time slot', value: '', disabled: true},
      ...availableSlots.map(slot => ({
        label: formatTimeSlot(slot),
        value: slot.id,
      }))
    ];
  }, [estimate?.availableSlots]);

  // Handle date selection
  const handleDateChange = useCallback((dateStr: string) => {
    const date = dateStr ? new Date(dateStr) : null;
    setSelectedDate(date);
    resetSlotSelection();
    setCutoffNotification(null); // Clear any previous notifications
  }, [setSelectedDate, resetSlotSelection]);

  // Enhanced slot selection with cutoff time validation
  const handleSlotChange = useCallback((slotId: string) => {
    if (!slotId || !selectedDate || !estimate?.availableSlots) {
      setSelectedSlot(slotId);
      setCutoffNotification(null);
      return;
    }

    const selectedSlotData = estimate.availableSlots.find(slot => slot.id === slotId);
    if (!selectedSlotData) {
      setSelectedSlot(slotId);
      return;
    }

    // Check if slot end time exceeds cutoff
    if (isSlotPastCutoff(selectedSlotData.endTime, cutoffTime)) {
      const nextDate = getNextAvailableDate(selectedDate, enableSameDay);
      const nextDateStr = nextDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });

      // Auto-move to next day
      setSelectedDate(nextDate);
      resetSlotSelection();

      // Show notification
      setCutoffNotification(
        `The selected time slot (ending at ${selectedSlotData.endTime}) is past our ${cutoffTime} cutoff time. ` +
        `Your delivery has been automatically moved to ${nextDateStr} with the first available time slot selected.`
      );

      return;
    }

    // Clear notification if valid slot selected
    setCutoffNotification(null);
    setSelectedSlot(slotId);
  }, [selectedDate, estimate?.availableSlots, cutoffTime, enableSameDay, setSelectedDate, setSelectedSlot, resetSlotSelection]);

  // Apply delivery selection to checkout using cart attributes
  const applyDeliverySelection = useCallback(async () => {
    const selectionKey = `${selectedSlot}-${selectedDate?.toISOString()}-${deliveryZone?.id}`;

    if (lastAppliedRef.current === selectionKey) {
      return;
    }

    if (!selectedSlot || !selectedDate || !deliveryZone || !estimate) {
      // Clear delivery attributes if selection is incomplete
      const attributesToClear = [
        'delivery_slot_id',
        'delivery_info',
        'custom_shipping_rate',
        'shipping_method_override'
      ];

      await Promise.all(
        attributesToClear.map(key =>
          applyAttributeChange({
            type: 'updateAttribute',
            key,
            value: ''
          })
        )
      );

      lastAppliedRef.current = '';
      return;
    }

    const selectedSlotData = estimate.availableSlots.find(slot => slot.id === selectedSlot);
    if (!selectedSlotData) {
      console.log('❌ Selected slot data not found');
      return;
    }

    // Additional validation before applying
    if (isSlotPastCutoff(selectedSlotData.endTime, cutoffTime)) {
      console.log('❌ Slot past cutoff time, not applying');
      return;
    }

    try {
      const deliveryInfo = {
        rate: deliveryZone.shippingRate,
        method: 'scheduled_delivery',
        title: `Scheduled Delivery - ${deliveryZone.name}`,
        date: formatDateForAPI(selectedDate),
        timeSlot: `${selectedSlotData.startTime} - ${selectedSlotData.endTime}`,
        zone: deliveryZone.name
      };

      // Apply all attributes in parallel for better performance
      await Promise.all([
        applyAttributeChange({
          type: 'updateAttribute',
          key: 'delivery_slot_id',
          value: selectedSlot
        }),
        applyAttributeChange({
          type: 'updateAttribute',
          key: 'delivery_info',
          value: JSON.stringify(deliveryInfo)
        }),
        applyAttributeChange({
          type: 'updateAttribute',
          key: 'custom_shipping_rate',
          value: deliveryZone.shippingRate.toString()
        }),
        applyAttributeChange({
          type: 'updateAttribute',
          key: 'shipping_method_override',
          value: 'scheduled_delivery'
        }),
        applyAttributeChange({
          type: 'updateAttribute',
          key: 'delivery_zone',
          value: JSON.stringify(deliveryZone)
        })
      ]);

      lastAppliedRef.current = selectionKey;
      console.log('✅ All cart attributes stored successfully');

    } catch (err) {
      console.error('❌ Error applying delivery selection:', err);
    }
  }, [selectedSlot, selectedDate, deliveryZone, estimate, applyAttributeChange, cutoffTime]);

  // Auto-select first slot when new date loads after cutoff violation
  useEffect(() => {
    if (cutoffNotification && estimate?.availableSlots && !selectedSlot) {
      const availableSlots = estimate.availableSlots.filter(isSlotAvailable);
      if (availableSlots.length > 0) {
        const firstSlot = availableSlots[0];
        console.log('🔄 Auto-selecting first slot after cutoff violation:', firstSlot.id);
        setSelectedSlot(firstSlot.id);
      }
    }
  }, [estimate?.availableSlots, cutoffNotification, selectedSlot, setSelectedSlot]);

  // Apply selection when values change
  useEffect(() => {
    applyDeliverySelection();
  }, [applyDeliverySelection]);

  // Load existing selection from attributes on mount
  useEffect(() => {
    const existingSlotId = attributes.find(attr => attr.key === 'delivery_slot_id')?.value;
    const existingDeliveryInfo = attributes.find(attr => attr.key === 'delivery_info')?.value;

    if (existingSlotId && existingDeliveryInfo) {
      try {
        const deliveryInfo = JSON.parse(existingDeliveryInfo.toString());
        console.log('🔄 Loading existing selection:', deliveryInfo);
        setSelectedSlot(existingSlotId.toString());
        setSelectedDate(new Date(deliveryInfo.date));
      } catch (err) {
        console.error('❌ Error loading existing delivery selection:', err);
      }
    }
  }, []);

  // Auto-clear notification after 5 seconds
  useEffect(() => {
    if (cutoffNotification) {
      const timer = setTimeout(() => {
        setCutoffNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [cutoffNotification]);

  // Early returns for various states
  if (!hasPhysicalProducts) return null;

  if (!countryCode) {
    return (
      <BlockStack spacing="loose">
        <Heading level={2}>{extensionTitle}</Heading>
        <Banner status="info">
          Please complete your shipping address to see available delivery options.
        </Banner>
      </BlockStack>
    );
  }

  if (zoneLoading) {
    return (
      <BlockStack spacing="loose">
        <Heading level={2}>{extensionTitle}</Heading>
        <InlineStack spacing="tight" blockAlignment="center">
          <Spinner size="small"/>
          <Text appearance="subdued">Checking delivery availability...</Text>
        </InlineStack>
      </BlockStack>
    );
  }

  if (zoneError || !deliveryZone) {
    return (
      <BlockStack spacing="loose">
        <Heading level={2}>{extensionTitle}</Heading>
        <Banner status="warning">
          {zoneError || 'Delivery is not available in your area.'}
        </Banner>
      </BlockStack>
    );
  }

  const selectedDateStr = selectedDate ? formatDateForAPI(selectedDate) : '';
  const selectedSlotData = estimate?.availableSlots.find(slot => slot.id === selectedSlot);

  return (
    <BlockStack spacing="loose">
      <Heading level={2}>{extensionTitle}</Heading>

      <Text appearance="subdued" size="small">
        Delivery to {deliveryZone.name} - ${deliveryZone.shippingRate.toFixed(2)} shipping rate will be applied
        {cutoffTime && (
          <Text appearance="subdued" size="small">
            {' '}• Orders must be placed by {cutoffTime} for same-day delivery
          </Text>
        )}
      </Text>

      {/* Cutoff notification banner */}
      {cutoffNotification && (
        <Banner status="warning">
          {cutoffNotification}
        </Banner>
      )}

      <Grid columns={['50%', '50%']} spacing="base">
        <Select
          label="Delivery Date"
          value={selectedDateStr}
          onChange={handleDateChange}
          disabled={dateOptions.length === 0}
          placeholder="Select delivery date"
          options={dateOptions}
        />

        <Select
          label="Time Slot"
          value={selectedSlot}
          onChange={handleSlotChange}
          disabled={slotsLoading || !selectedDate || slotOptions.length <= 1}
          options={slotOptions}
        />
      </Grid>

      {slotsError && (
        <Banner status="warning">
          {slotsError}
        </Banner>
      )}

      {slotsLoading && (
        <InlineStack spacing="tight" blockAlignment="center">
          <Spinner size="small"/>
          <Text appearance="subdued">Loading time slots...</Text>
        </InlineStack>
      )}

      {selectedSlot && selectedDate && selectedSlotData && !slotsLoading && (
        <Banner status="success">
          <BlockStack spacing="tight">
            <Text>
              🚚 Delivery scheduled for{' '}
              {dateOptions.find(d => d.value === selectedDateStr)?.label || selectedDateStr}
              {' '}between{' '}
              {selectedSlotData.startTime} - {selectedSlotData.endTime}
            </Text>
            <Text appearance="subdued" size="small">
              Shipping rate: ${deliveryZone.shippingRate.toFixed(2)}
            </Text>
          </BlockStack>
        </Banner>
      )}
    </BlockStack>
  );
}
