import { LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  TextField,
  DatePicker,
  Checkbox,
  BlockStack,
  ButtonGroup,
  Select,
  Badge,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { ShopService } from "~/Services/ShopService.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import db from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopService = new ShopService(admin as AdminApiContext);

  try {
    const [blackoutDates, zones] = await Promise.all([
      db.blackoutDate.findMany({
        where: { shopName: session.shop },
        include: {
          zone: {
            select: { name: true }
          }
        },
        orderBy: { date: 'asc' },
      }),
      shopService.getDeliveryZones(session.shop)
    ]);

    return json({ blackoutDates, zones });
  } catch (error) {
    console.error('Error loading blackout dates:', error);
    return json({ blackoutDates: [], zones: [] });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  try {
    const actionType = formData.get('actionType') as string;

    if (actionType === 'create' || actionType === 'update') {
      const date = new Date(formData.get('date') as string);
      const reason = formData.get('reason') as string;
      const isRecurring = formData.get('isRecurring') === 'true';
      const zoneId = formData.get('zoneId') as string;
      const blackoutId = formData.get('blackoutId') as string;

      // Validate date
      if (isNaN(date.getTime())) {
        return json({ error: 'Invalid date provided' }, { status: 400 });
      }

      const data = {
        shopName: session.shop,
        date,
        reason: reason || null,
        isRecurring,
        zoneId: zoneId || null, // null for shop-wide blackout
      };

      if (actionType === 'update' && blackoutId) {
        await db.blackoutDate.update({
          where: { id: blackoutId },
          data: {
            ...data,
          }
        });
        return json({ status: 'updated' });
      } else {
        // Check for duplicate blackout date
        const existing = await db.blackoutDate.findFirst({
          where: {
            shopName: session.shop,
            date,
            zoneId: zoneId || null,
          }
        });

        if (existing) {
          return json({
            error: 'Blackout date already exists for this date and zone'
          }, { status: 400 });
        }

        await db.blackoutDate.create({ data });
        return json({ status: 'created' });
      }
    }

    if (actionType === 'delete') {
      const blackoutId = formData.get('blackoutId') as string;

      if (!blackoutId) {
        return json({ error: 'Blackout ID is required' }, { status: 400 });
      }

      await db.blackoutDate.delete({
        where: { id: blackoutId }
      });

      return json({ status: 'deleted' });
    }

    return json({ error: 'Invalid action type' }, { status: 400 });

  } catch (error) {
    console.error('Error in blackout date action:', error);
    const message = error instanceof Error ? error.message : 'Failed to process action';
    return json({ error: message }, { status: 500 });
  }
}

interface FormData {
  date: Date;
  reason: string;
  isRecurring: boolean;
  zoneId: string;
}

interface BlackoutDate {
  id: string;
  date: Date;
  reason: string | null;
  isRecurring: boolean;
  zoneId: string | null;
  zone?: { name: string } | null;
  createdAt: Date;
}

export default function BlackoutDates() {
  const { blackoutDates, zones } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlackout, setEditingBlackout] = useState<BlackoutDate | null>(null);

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState({
    month: today.getMonth(),
    year: today.getFullYear(),
  });

  const [formData, setFormData] = useState<FormData>({
    date: today,
    reason: '',
    isRecurring: false,
    zoneId: '', // Empty means shop-wide
  });

  const handleMonthChange = useCallback(
    (month: number, year: number) => {
      setSelectedDate({ month, year });
    },
    [],
  );

  const toggleModal = useCallback(() => {
    setIsModalOpen(!isModalOpen);
    if (isModalOpen) {
      setEditingBlackout(null);
      setFormData({
        date: today,
        reason: '',
        isRecurring: false,
        zoneId: '',
      });
    }
  }, [isModalOpen, today]);

  const handleEdit = useCallback((blackout: BlackoutDate) => {
    setEditingBlackout(blackout);
    const blackoutDate = new Date(blackout.date);
    setFormData({
      date: blackoutDate,
      reason: blackout.reason || '',
      isRecurring: blackout.isRecurring,
      zoneId: blackout.zoneId || '',
    });
    setSelectedDate({
      month: blackoutDate.getMonth(),
      year: blackoutDate.getFullYear(),
    });
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback((blackoutId: string) => {
    if (confirm('Are you sure you want to delete this blackout date? This action cannot be undone.')) {
      const form = new FormData();
      form.append('actionType', 'delete');
      form.append('blackoutId', blackoutId);
      submit(form, { method: 'post' });
    }
  }, [submit]);

  const updateFormData = useCallback((path: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [path]: value,
    }));
  }, []);

  const validateFormData = (data: FormData): boolean => {
    if (!data.date) {
      return false;
    }
    return true;
  };

  const handleSubmit = useCallback(() => {
    if (!validateFormData(formData)) {
      return;
    }

    const form = new FormData();
    form.append('actionType', editingBlackout ? 'update' : 'create');

    // Ensure date is formatted correctly for storage
    const dateForStorage = new Date(formData.date);
    // Create date string in YYYY-MM-DD format in local timezone
    const year = dateForStorage.getFullYear();
    const month = String(dateForStorage.getMonth() + 1).padStart(2, '0');
    const day = String(dateForStorage.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;

    console.log('📅 Submitting date:', localDateString);
    form.append('date', localDateString);
    form.append('reason', formData.reason);
    form.append('isRecurring', formData.isRecurring.toString());
    form.append('zoneId', formData.zoneId);

    if (editingBlackout) {
      form.append('blackoutId', editingBlackout.id);
    }

    submit(form, { method: 'post' });
    setIsModalOpen(false);
    setEditingBlackout(null);

    // Reset form
    setFormData({
      date: today,
      reason: '',
      isRecurring: false,
      zoneId: '',
    });
  }, [formData, submit, today, editingBlackout]);

  // Create zone options for select
  const zoneOptions = [
    { label: 'All zones (Shop-wide)', value: '' },
    ...zones.map((zone) => ({
      label: zone.name,
      value: zone.id,
    }))
  ];

  // Create table rows
  const tableRows = blackoutDates.map((blackout) => [
    new Date(blackout.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    blackout.reason || "No reason provided",
    blackout.zone?.name || "All zones",
    <Badge key={`recurring-${blackout.id}`} tone={blackout.isRecurring ? "info" : "success"}>
      {blackout.isRecurring ? "Yearly" : "One-time"}
    </Badge>,
    new Date(blackout.createdAt).toLocaleDateString(),
    <ButtonGroup key={`actions-${blackout.id}`} variant="segmented">
      {/*// @ts-ignore*/}
      <Button size="slim" onClick={() => handleEdit(blackout)}>
        Edit
      </Button>
      <Button
        size="slim"
        tone="critical"
        onClick={() => handleDelete(blackout.id)}
      >
        Delete
      </Button>
    </ButtonGroup>
  ]);

  return (
    <Page
      title="Blackout Dates"
      subtitle="Manage dates when delivery is not available"
      primaryAction={
        <Button onClick={toggleModal}>Add Blackout Date</Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="p" tone="subdued">
                  Blackout dates prevent customers from selecting specific dates for delivery.
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  {blackoutDates.length} blackout date{blackoutDates.length !== 1 ? 's' : ''} configured
                </Text>
              </InlineStack>

              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Date", "Reason", "Zone", "Type", "Created", "Actions"]}
                rows={tableRows}
                footerContent={tableRows.length === 0 ? "No blackout dates configured" : undefined}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Modal
          open={isModalOpen}
          onClose={toggleModal}
          title={editingBlackout ? "Edit Blackout Date" : "Add Blackout Date"}
          primaryAction={{
            content: editingBlackout ? "Update Date" : "Add Date",
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
                  {editingBlackout
                    ? "Update the blackout date settings."
                    : "Select a date when delivery should not be available."
                  }
                </Text>

                <DatePicker
                  month={selectedDate.month}
                  year={selectedDate.year}
                  selected={formData.date}
                  onMonthChange={handleMonthChange}
                  onChange={({start}) => {
                    if (start) {
                      // Fix timezone issue - create date in local timezone
                      const localDate = new Date(start.getTime() - start.getTimezoneOffset() * 60000);
                      console.log('📅 DatePicker selected:', start.toISOString().split('T')[0]);
                      console.log('📅 Fixed local date:', localDate.toISOString().split('T')[0]);
                      updateFormData('date', localDate);
                    }
                  }}
                  disableDatesBefore={editingBlackout ? undefined : today}
                />

                <Select
                  label="Apply to Zone"
                  options={zoneOptions}
                  value={formData.zoneId}
                  onChange={(value) => updateFormData('zoneId', value)}
                  helpText="Select a specific zone or leave as 'All zones' for shop-wide blackout"
                />

                <TextField
                  label="Reason (Optional)"
                  type="text"
                  autoComplete="off"
                  multiline={2}
                  value={formData.reason}
                  onChange={(value) => updateFormData('reason', value)}
                  placeholder="e.g., Public holiday, Staff vacation, etc."
                />

                <Checkbox
                  label="Recurring yearly"
                  checked={formData.isRecurring}
                  onChange={(checked) => updateFormData('isRecurring', checked)}
                  helpText="Enable this if this date should be blocked every year (e.g., Christmas, New Year)"
                />

                {formData.isRecurring && (
                  <Text as="p" tone="subdued" variant="bodySm">
                    This will block {formData.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} every year.
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
