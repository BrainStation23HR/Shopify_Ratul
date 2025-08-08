import db from "~/db.server";
import type { LoaderFunctionArgs, ActionFunctionArgs} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  Select,
  TextField,
  Text,
  BlockStack,
  Badge,
  ButtonGroup,
  InlineStack,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { DeliveryService } from "~/Services/DeliveryService.server";
import { ShopService } from "~/Services/ShopService.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopService = new ShopService(admin as AdminApiContext);
  const deliveryService = new DeliveryService();

  try {
    // Get zones first
    const zones = await shopService.getDeliveryZones(session.shop);

    // Try the simple version first to debug
    // @ts-ignore
    let slots = [];
    try {
      slots = await deliveryService.getAllSlots(session.shop, false);
    } catch (slotError) {
      console.error('❌ Error loading slots:', slotError);

      // Fallback: try direct database query
      try {
        slots = await db.deliverySlot.findMany({
          where: { shopName: session.shop },
          include: { zone: { select: { name: true } } },
          orderBy: { startTime: 'asc' }
        });

        // Add mock booking data
        slots = slots.map(slot => ({
          ...slot,
          currentOrders: 0
        }));

        console.log('✅ Slots loaded (fallback):', slots.length);
      } catch (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        slots = [];
      }
    }

    // @ts-ignore
    return json({ zones, slots });

  } catch (error) {
    console.error('❌ Error in loader:', error);
    console.error('Error details:', {
      // @ts-ignore
      name: error?.name,
      // @ts-ignore
      message: error?.message,
      // @ts-ignore
      stack: error?.stack
    });

    return json({
      zones: [],
      slots: [],
      // @ts-ignore
      error: error?.message || 'Unknown error occurred'
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const deliveryService = new DeliveryService();

  try {
    const actionType = formData.get('actionType') as string;

    if (actionType === 'create' || actionType === 'update') {
      const startTime = formData.get('startTime') as string;
      const endTime = formData.get('endTime') as string;
      const capacity = parseInt(formData.get('capacity') as string);
      const zoneId = formData.get('zoneId') as string;
      const slotId = formData.get('slotId') as string;

      // Validate inputs
      if (!startTime || !endTime || !capacity || !zoneId) {
        return json({ error: 'All fields are required' }, { status: 400 });
      }

      if (endTime <= startTime) {
        return json({ error: 'End time must be after start time' }, { status: 400 });
      }

      if (capacity <= 0) {
        return json({ error: 'Capacity must be greater than 0' }, { status: 400 });
      }

      if (actionType === 'update' && slotId) {
        // Update existing slot
        await db.deliverySlot.update({
          where: { id: slotId },
          data: {
            startTime,
            endTime,
            capacity,
            zoneId,
            updatedAt: new Date()
          }
        });
        return json({ status: 'updated' });
      } else {
        // Create new slot
        const timeSlot = {
          shopName: session.shop,
          startTime,
          endTime,
          capacity,
          zoneId,
        };

        await deliveryService.createDeliverySlot(timeSlot);
        return json({ status: 'created' });
      }
    }

    if (actionType === 'toggle') {
      const slotId = formData.get('slotId') as string;

      if (!slotId) {
        return json({ error: 'Slot ID is required' }, { status: 400 });
      }

      // Get current slot status
      const currentSlot = await db.deliverySlot.findUnique({
        where: { id: slotId },
        select: { isActive: true }
      });

      if (!currentSlot) {
        return json({ error: 'Slot not found' }, { status: 404 });
      }

      // Toggle the status
      await db.deliverySlot.update({
        where: { id: slotId },
        data: {
          isActive: !currentSlot.isActive,
          updatedAt: new Date()
        }
      });

      return json({
        status: 'toggled',
        newStatus: !currentSlot.isActive
      });
    }

    if (actionType === 'delete') {
      const slotId = formData.get('slotId') as string;

      if (!slotId) {
        return json({ error: 'Slot ID is required' }, { status: 400 });
      }

      // Check if slot has any orders
      const orderCount = await db.order.count({
        where: {
          deliverySlotId: slotId,
          status: { not: 'CANCELLED' }
        }
      });

      if (orderCount > 0) {
        return json({
          error: `Cannot delete slot with ${orderCount} active orders. Please cancel or complete these orders first.`
        }, { status: 400 });
      }

      // Delete the slot
      await db.deliverySlot.delete({
        where: { id: slotId }
      });

      return json({ status: 'deleted' });
    }

    return json({ error: 'Invalid action type' }, { status: 400 });

  } catch (error) {
    console.error('Error in slot action:', error);
    const message = error instanceof Error ? error.message : 'Failed to process action';
    return json({ error: message }, { status: 500 });
  }
}

interface FormData {
  startTime: string;
  endTime: string;
  capacity: string;
  zoneId: string;
}

interface SlotData {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  zoneId: string;
  isActive: boolean;
  zone: { name: string };
}

export default function TimeSlots() {
  const { zones, slots } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    startTime: '09:00',
    endTime: '17:00',
    capacity: '10',
    zoneId: zones[0]?.id || '',
  });

  const toggleModal = useCallback(() => {
    setIsModalOpen(!isModalOpen);
    if (isModalOpen) {
      setEditingSlot(null);
      setFormData({
        startTime: '09:00',
        endTime: '17:00',
        capacity: '10',
        zoneId: zones[0]?.id || '',
      });
    }
  }, [isModalOpen, zones]);

  const handleEdit = useCallback((slot: SlotData) => {
    setEditingSlot(slot);
    setFormData({
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity.toString(),
      zoneId: slot.zoneId,
    });
    setIsModalOpen(true);
  }, []);

  const handleToggleStatus = useCallback((slotId: string) => {
    const form = new FormData();
    form.append('actionType', 'toggle');
    form.append('slotId', slotId);
    submit(form, { method: 'post' });
  }, [submit]);

  const handleDelete = useCallback((slotId: string) => {
    if (confirm('Are you sure you want to delete this time slot? This action cannot be undone.')) {
      const form = new FormData();
      form.append('actionType', 'delete');
      form.append('slotId', slotId);
      submit(form, { method: 'post' });
    }
  }, [submit]);

  const zoneOptions = zones.map((zone) => ({
    label: zone.name,
    value: zone.id,
  }));

  const tableRows = slots.map((slot) => [
    slot.zone.name,
    `${slot.startTime} - ${slot.endTime}`,
    slot.capacity.toString(),
    <Badge key={`status-${slot.id}`} tone={slot.isActive ? "success" : "critical"}>
      {slot.isActive ? "Active" : "Inactive"}
    </Badge>,
    <ButtonGroup key={`actions-${slot.id}`} variant="segmented">
      <Button size="slim" onClick={() => handleEdit(slot)}>
        Edit
      </Button>
      <Button
        size="slim"
        tone={slot.isActive ? "critical" : "success"}
        onClick={() => handleToggleStatus(slot.id)}
      >
        {slot.isActive ? "Deactivate" : "Activate"}
      </Button>
      <Button
        size="slim"
        tone="critical"
        onClick={() => handleDelete(slot.id)}
      >
        Delete
      </Button>
    </ButtonGroup>
  ]);

  const updateFormData = useCallback((path: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [path]: value,
    }));
  }, []);

  const validateFormData = (data: FormData): boolean => {
    if (!data.startTime || !data.endTime || !data.capacity || !data.zoneId) {
      return false;
    }
    if (isNaN(parseInt(data.capacity)) || parseInt(data.capacity) <= 0) {
      return false;
    }
    if (data.endTime <= data.startTime) {
      return false;
    }
    return true;
  };

  const handleSubmit = useCallback(() => {
    if (!validateFormData(formData)) {
      return;
    }

    const form = new FormData();
    form.append('actionType', editingSlot ? 'update' : 'create');
    form.append('startTime', formData.startTime);
    form.append('endTime', formData.endTime);
    form.append('capacity', formData.capacity);
    form.append('zoneId', formData.zoneId);

    if (editingSlot) {
      form.append('slotId', editingSlot.id);
    }

    submit(form, { method: 'post' });
    setIsModalOpen(false);
    setEditingSlot(null);

    // Reset form
    setFormData({
      startTime: '09:00',
      endTime: '17:00',
      capacity: '10',
      zoneId: zones[0]?.id || '',
    });
  }, [formData, submit, zones, editingSlot]);

  return (
    <Page
      title="Recurring Time Slots"
      subtitle="These time slots apply to all delivery dates except blackout dates"
      primaryAction={
        zones.length > 0 ? (
          <Button onClick={() => setIsModalOpen(true)}>Add Time Slot</Button>
        ) : undefined
      }
    >
      <Layout>
        <Layout.Section>
          {zones.length === 0 ? (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">No Delivery Zones</Text>
                <Text as="p">
                  You need to create delivery zones before you can add time slots.
                </Text>
                <Button url="/delivery-zones">Create Delivery Zone</Button>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">
                    Time slots shown below apply to all delivery dates. Manage each slot using the action buttons.
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {slots.length} slot{slots.length !== 1 ? 's' : ''} configured
                  </Text>
                </InlineStack>
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "text"]}
                  headings={["Zone", "Time Range", "Capacity", "Status", "Actions"]}
                  rows={tableRows}
                  footerContent={tableRows.length === 0 ? "No time slots created yet" : undefined}
                />
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Modal
          open={isModalOpen}
          onClose={toggleModal}
          title={editingSlot ? "Edit Time Slot" : "Add Recurring Time Slot"}
          primaryAction={{
            content: editingSlot ? "Update Slot" : "Add Slot",
            onAction: handleSubmit,
            disabled: !validateFormData(formData)
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: toggleModal,
            },
          ]}
        >
          <Modal.Section>
            <Form onSubmit={handleSubmit}>
              <BlockStack gap="400">
                <Text as="p" tone="subdued">
                  {editingSlot
                    ? "Update this time slot. Changes will apply to all future delivery dates."
                    : "This time slot will be available for all delivery dates except blackout dates."
                  }
                </Text>

                <TextField
                  label="Start Time"
                  type="time"
                  value={formData.startTime}
                  onChange={(value) => updateFormData('startTime', value)}
                  requiredIndicator
                  autoComplete="off"
                />

                <TextField
                  label="End Time"
                  type="time"
                  value={formData.endTime}
                  onChange={(value) => updateFormData('endTime', value)}
                  requiredIndicator
                  autoComplete="off"
                  error={formData.endTime <= formData.startTime ? "End time must be after start time" : undefined}
                />

                <TextField
                  label="Daily Capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(value) => updateFormData('capacity', value)}
                  requiredIndicator
                  min="1"
                  autoComplete="off"
                  helpText="Maximum number of deliveries per day in this time slot"
                />

                <Select
                  label="Delivery Zone"
                  options={zoneOptions}
                  value={formData.zoneId}
                  onChange={(value) => updateFormData('zoneId', value)}
                  requiredIndicator
                  disabled={!!editingSlot} // Disable zone change when editing
                />

                {editingSlot && (
                  <Text as="p" tone="subdued" variant="bodySm">
                    Note: Zone cannot be changed when editing. Create a new slot if you need a different zone.
                  </Text>
                )}
              </BlockStack>
            </Form>
          </Modal.Section>
        </Modal>
      </Layout>
    </Page>
  );
}
