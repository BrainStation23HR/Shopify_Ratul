import {type LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  TextField,
  Modal,
  BlockStack,
  Select,
  Badge,
  ButtonGroup,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { ShopService } from "~/Services/ShopService.server";
import {type AdminApiContext} from "@shopify/shopify-app-remix/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopifyAdmin = admin as AdminApiContext
  const shopService = new ShopService(shopifyAdmin);
  const zones = await shopService.getDeliveryZones(session.shop);

  return json({ zones });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const shopService = new ShopService(admin as AdminApiContext);

  try {
    const actionType = formData.get('actionType') as string;

    if (actionType === 'create' || actionType === 'update') {
      const name = formData.get('name') as string;
      const shippingRate = parseFloat(formData.get('shippingRate') as string);
      const zoneId = formData.get('zoneId') as string;

      // Validate inputs
      if (!name || !shippingRate || isNaN(shippingRate)) {
        return json({ error: 'All fields are required and shipping rate must be a valid number' }, { status: 400 });
      }

      if (shippingRate < 0) {
        return json({ error: 'Shipping rate cannot be negative' }, { status: 400 });
      }

      if (actionType === 'update' && zoneId) {
        // Update existing zone
        await shopService.updateDeliveryZone(zoneId, session.shop, {
          name,
          shippingRate,
        });
        return json({ status: 'updated' });
      } else {
        // Create new zone
        await shopService.createDeliveryZone(session.shop, {
          name,
          shippingRate,
        });
        return json({ status: 'created' });
      }
    }

    if (actionType === 'toggle') {
      const zoneId = formData.get('zoneId') as string;

      if (!zoneId) {
        return json({ error: 'Zone ID is required' }, { status: 400 });
      }

      await shopService.toggleDeliveryZone(session.shop, zoneId);
      return json({ status: 'toggled' });
    }

    if (actionType === 'delete') {
      const zoneId = formData.get('zoneId') as string;

      if (!zoneId) {
        return json({ error: 'Zone ID is required' }, { status: 400 });
      }

      // Check if zone has any active slots or orders
      const hasActiveSlots = await shopService.hasActiveSlots(session.shop, zoneId);

      if (hasActiveSlots) {
        return json({
          error: 'Cannot delete zone with active time slots or orders. Please remove time slots first.'
        }, { status: 400 });
      }

      await shopService.deleteDeliveryZone(session.shop, zoneId);
      return json({ status: 'deleted' });
    }

    return json({ error: 'Invalid action type' }, { status: 400 });

  } catch (error) {
    console.error('Error in zone action:', error);
    const message = error instanceof Error ? error.message : 'Failed to process action';
    return json({ error: message }, { status: 500 });
  }
}

interface FormData {
  name: string;
  shippingRate: string;
}

interface ZoneData {
  id: string;
  name: string;
  shippingRate: number;
  isActive: boolean;
  createdAt: string;
}

const Countries = [
  { "label": "Afghanistan", "value": "AF" },
  { "label": "Albania", "value": "AL" },
  { "label": "Algeria", "value": "DZ" },
  { "label": "Andorra", "value": "AD" },
  { "label": "Angola", "value": "AO" },
  { "label": "Antigua and Barbuda", "value": "AG" },
  { "label": "Argentina", "value": "AR" },
  { "label": "Armenia", "value": "AM" },
  { "label": "Australia", "value": "AU" },
  { "label": "Austria", "value": "AT" },
  { "label": "Azerbaijan", "value": "AZ" },
  { "label": "Bahamas", "value": "BS" },
  { "label": "Bahrain", "value": "BH" },
  { "label": "Bangladesh", "value": "BD" },
  { "label": "Barbados", "value": "BB" },
  { "label": "Belarus", "value": "BY" },
  { "label": "Belgium", "value": "BE" },
  { "label": "Belize", "value": "BZ" },
  { "label": "Benin", "value": "BJ" },
  { "label": "Bhutan", "value": "BT" },
  { "label": "Bolivia", "value": "BO" },
  { "label": "Bosnia and Herzegovina", "value": "BA" },
  { "label": "Botswana", "value": "BW" },
  { "label": "Brazil", "value": "BR" },
  { "label": "Brunei", "value": "BN" },
  { "label": "Bulgaria", "value": "BG" },
  { "label": "Burkina Faso", "value": "BF" },
  { "label": "Burundi", "value": "BI" },
  { "label": "Cabo Verde", "value": "CV" },
  { "label": "Cambodia", "value": "KH" },
  { "label": "Cameroon", "value": "CM" },
  { "label": "Canada", "value": "CA" },
  { "label": "Central African Republic", "value": "CF" },
  { "label": "Chad", "value": "TD" },
  { "label": "Chile", "value": "CL" },
  { "label": "China", "value": "CN" },
  { "label": "Colombia", "value": "CO" },
  { "label": "Comoros", "value": "KM" },
  { "label": "Congo (Congo-Brazzaville)", "value": "CG" },
  { "label": "Costa Rica", "value": "CR" },
  { "label": "Croatia", "value": "HR" },
  { "label": "Cuba", "value": "CU" },
  { "label": "Cyprus", "value": "CY" },
  { "label": "Czech Republic", "value": "CZ" },
  { "label": "Denmark", "value": "DK" },
  { "label": "Djibouti", "value": "DJ" },
  { "label": "Dominica", "value": "DM" },
  { "label": "Dominican Republic", "value": "DO" },
  { "label": "Ecuador", "value": "EC" },
  { "label": "Egypt", "value": "EG" },
  { "label": "El Salvador", "value": "SV" },
  { "label": "Equatorial Guinea", "value": "GQ" },
  { "label": "Eritrea", "value": "ER" },
  { "label": "Estonia", "value": "EE" },
  { "label": "Eswatini", "value": "SZ" },
  { "label": "Ethiopia", "value": "ET" },
  { "label": "Fiji", "value": "FJ" },
  { "label": "Finland", "value": "FI" },
  { "label": "France", "value": "FR" },
  { "label": "Gabon", "value": "GA" },
  { "label": "Gambia", "value": "GM" },
  { "label": "Georgia", "value": "GE" },
  { "label": "Germany", "value": "DE" },
  { "label": "Ghana", "value": "GH" },
  { "label": "Greece", "value": "GR" },
  { "label": "Grenada", "value": "GD" },
  { "label": "Guatemala", "value": "GT" },
  { "label": "Guinea", "value": "GN" },
  { "label": "Guinea-Bissau", "value": "GW" },
  { "label": "Guyana", "value": "GY" },
  { "label": "Haiti", "value": "HT" },
  { "label": "Honduras", "value": "HN" },
  { "label": "Hungary", "value": "HU" },
  { "label": "Iceland", "value": "IS" },
  { "label": "India", "value": "IN" },
  { "label": "Indonesia", "value": "ID" },
  { "label": "Iran", "value": "IR" },
  { "label": "Iraq", "value": "IQ" },
  { "label": "Ireland", "value": "IE" },
  { "label": "Israel", "value": "IL" },
  { "label": "Italy", "value": "IT" },
  { "label": "Jamaica", "value": "JM" },
  { "label": "Japan", "value": "JP" },
  { "label": "Jordan", "value": "JO" },
  { "label": "Kazakhstan", "value": "KZ" },
  { "label": "Kenya", "value": "KE" },
  { "label": "Kiribati", "value": "KI" },
  { "label": "Kuwait", "value": "KW" },
  { "label": "Kyrgyzstan", "value": "KG" },
  { "label": "Laos", "value": "LA" },
  { "label": "Latvia", "value": "LV" },
  { "label": "Lebanon", "value": "LB" },
  { "label": "Lesotho", "value": "LS" },
  { "label": "Liberia", "value": "LR" },
  { "label": "Libya", "value": "LY" },
  { "label": "Liechtenstein", "value": "LI" },
  { "label": "Lithuania", "value": "LT" },
  { "label": "Luxembourg", "value": "LU" },
  { "label": "Madagascar", "value": "MG" },
  { "label": "Malawi", "value": "MW" },
  { "label": "Malaysia", "value": "MY" },
  { "label": "Maldives", "value": "MV" },
  { "label": "Mali", "value": "ML" },
  { "label": "Malta", "value": "MT" },
  { "label": "Marshall Islands", "value": "MH" },
  { "label": "Mauritania", "value": "MR" },
  { "label": "Mauritius", "value": "MU" },
  { "label": "Mexico", "value": "MX" },
  { "label": "Micronesia", "value": "FM" },
  { "label": "Moldova", "value": "MD" },
  { "label": "Monaco", "value": "MC" },
  { "label": "Mongolia", "value": "MN" },
  { "label": "Montenegro", "value": "ME" },
  { "label": "Morocco", "value": "MA" },
  { "label": "Mozambique", "value": "MZ" },
  { "label": "Myanmar", "value": "MM" },
  { "label": "Namibia", "value": "NA" },
  { "label": "Nauru", "value": "NR" },
  { "label": "Nepal", "value": "NP" },
  { "label": "Netherlands", "value": "NL" },
  { "label": "New Zealand", "value": "NZ" },
  { "label": "Nicaragua", "value": "NI" },
  { "label": "Niger", "value": "NE" },
  { "label": "Nigeria", "value": "NG" },
  { "label": "North Korea", "value": "KP" },
  { "label": "North Macedonia", "value": "MK" },
  { "label": "Norway", "value": "NO" },
  { "label": "Oman", "value": "OM" },
  { "label": "Pakistan", "value": "PK" },
  { "label": "Palau", "value": "PW" },
  { "label": "Palestine", "value": "PS" },
  { "label": "Panama", "value": "PA" },
  { "label": "Papua New Guinea", "value": "PG" },
  { "label": "Paraguay", "value": "PY" },
  { "label": "Peru", "value": "PE" },
  { "label": "Philippines", "value": "PH" },
  { "label": "Poland", "value": "PL" },
  { "label": "Portugal", "value": "PT" },
  { "label": "Qatar", "value": "QA" },
  { "label": "Romania", "value": "RO" },
  { "label": "Russia", "value": "RU" },
  { "label": "Rwanda", "value": "RW" },
  { "label": "Saint Kitts and Nevis", "value": "KN" },
  { "label": "Saint Lucia", "value": "LC" },
  { "label": "Saint Vincent and the Grenadines", "value": "VC" },
  { "label": "Samoa", "value": "WS" },
  { "label": "San Marino", "value": "SM" },
  { "label": "Sao Tome and Principe", "value": "ST" },
  { "label": "Saudi Arabia", "value": "SA" },
  { "label": "Senegal", "value": "SN" },
  { "label": "Serbia", "value": "RS" },
  { "label": "Seychelles", "value": "SC" },
  { "label": "Sierra Leone", "value": "SL" },
  { "label": "Singapore", "value": "SG" },
  { "label": "Slovakia", "value": "SK" },
  { "label": "Slovenia", "value": "SI" },
  { "label": "Solomon Islands", "value": "SB" },
  { "label": "Somalia", "value": "SO" },
  { "label": "South Africa", "value": "ZA" },
  { "label": "South Korea", "value": "KR" },
  { "label": "South Sudan", "value": "SS" },
  { "label": "Spain", "value": "ES" },
  { "label": "Sri Lanka", "value": "LK" },
  { "label": "Sudan", "value": "SD" },
  { "label": "Suriname", "value": "SR" },
  { "label": "Sweden", "value": "SE" },
  { "label": "Switzerland", "value": "CH" },
  { "label": "Syria", "value": "SY" },
  { "label": "Taiwan", "value": "TW" },
  { "label": "Tajikistan", "value": "TJ" },
  { "label": "Tanzania", "value": "TZ" },
  { "label": "Thailand", "value": "TH" },
  { "label": "Timor-Leste", "value": "TL" },
  { "label": "Togo", "value": "TG" },
  { "label": "Tonga", "value": "TO" },
  { "label": "Trinidad and Tobago", "value": "TT" },
  { "label": "Tunisia", "value": "TN" },
  { "label": "Turkey", "value": "TR" },
  { "label": "Turkmenistan", "value": "TM" },
  { "label": "Tuvalu", "value": "TV" },
  { "label": "Uganda", "value": "UG" },
  { "label": "Ukraine", "value": "UA" },
  { "label": "United Arab Emirates", "value": "AE" },
  { "label": "United Kingdom", "value": "GB" },
  { "label": "United States", "value": "US" },
  { "label": "Uruguay", "value": "UY" },
  { "label": "Uzbekistan", "value": "UZ" },
  { "label": "Vanuatu", "value": "VU" },
  { "label": "Vatican City", "value": "VA" },
  { "label": "Venezuela", "value": "VE" },
  { "label": "Vietnam", "value": "VN" },
  { "label": "Yemen", "value": "YE" },
  { "label": "Zambia", "value": "ZM" },
  { "label": "Zimbabwe", "value": "ZW" }
];

export default function DeliveryZones() {
  const { zones } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    shippingRate: '',
  });

  const toggleModal = useCallback(() => {
    setIsModalOpen(!isModalOpen);
    if (isModalOpen) {
      setEditingZone(null);
      setFormData({
        name: '',
        shippingRate: '',
      });
    }
  }, [isModalOpen]);

  const handleEdit = useCallback((zone: ZoneData) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      shippingRate: zone.shippingRate.toString(),
    });
    setIsModalOpen(true);
  }, []);

  const handleToggleStatus = useCallback((zoneId: string) => {
    const form = new FormData();
    form.append('actionType', 'toggle');
    form.append('zoneId', zoneId);
    submit(form, { method: 'post' });
  }, [submit]);

  const handleDelete = useCallback((zoneId: string) => {
    if (confirm('Are you sure you want to delete this delivery zone? This action cannot be undone.')) {
      const form = new FormData();
      form.append('actionType', 'delete');
      form.append('zoneId', zoneId);
      submit(form, { method: 'post' });
    }
  }, [submit]);

  const tableRows = zones.map((zone) => [
    zone.name,
    `$${zone.shippingRate}`,
    <Badge key={`status-${zone.id}`} tone={zone.isActive ? "success" : "critical"}>
      {zone.isActive ? "Active" : "Inactive"}
    </Badge>,
    new Date(zone.createdAt).toLocaleDateString(),
    <ButtonGroup key={`actions-${zone.id}`} variant="segmented">
      <Button size="slim" onClick={() => handleEdit(zone)}>
        Edit
      </Button>
      <Button
        size="slim"
        tone={zone.isActive ? "critical" : "success"}
        onClick={() => handleToggleStatus(zone.id)}
      >
        {zone.isActive ? "Deactivate" : "Activate"}
      </Button>
      <Button
        size="slim"
        tone="critical"
        onClick={() => handleDelete(zone.id)}
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
    if (!data.name || !data.shippingRate) {
      return false;
    }
    if (isNaN(parseFloat(data.shippingRate))) {
      return false;
    }
    return true;
  };

  const handleSubmit = useCallback(() => {
    if (!validateFormData(formData)) {
      return;
    }

    const form = new FormData();
    form.append('actionType', editingZone ? 'update' : 'create');
    form.append('name', formData.name);
    form.append('shippingRate', formData.shippingRate);

    if (editingZone) {
      form.append('zoneId', editingZone.id);
    }

    submit(form, { method: 'post' });
    setIsModalOpen(false);
    setEditingZone(null);

    // Reset form
    setFormData({
      name: '',
      shippingRate: '',
    });
  }, [formData, submit, editingZone]);

  return (
    <Page
      title="Delivery Zones"
      primaryAction={
        <Button onClick={toggleModal}>Add Zone</Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["Zone Name", "Shipping Rate", "Status", "Created", "Actions"]}
              rows={tableRows}
            />
          </Card>
        </Layout.Section>

        <Modal
          open={isModalOpen}
          onClose={toggleModal}
          title={editingZone ? "Edit Delivery Zone" : "Add Delivery Zone"}
          primaryAction={{
            content: editingZone ? "Update Zone" : "Add Zone",
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
                <Select
                  label="Zone Name"
                  options={Countries}
                  value={formData.name}
                  onChange={(value) => updateFormData('name', value)}
                  requiredIndicator={true}
                  disabled={!!editingZone} // Disable zone name change when editing
                />

                {editingZone && (
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>
                    Note: Zone name cannot be changed when editing. Create a new zone if needed.
                  </p>
                )}

                <TextField
                  label="Shipping Rate"
                  type="number"
                  prefix="$"
                  autoComplete="off"
                  value={formData.shippingRate}
                  onChange={(value) => updateFormData('shippingRate', value)}
                  requiredIndicator={true}
                  min="0"
                  step={0.01}
                />
              </BlockStack>
            </Form>
          </Modal.Section>
        </Modal>
      </Layout>
    </Page>
  );
}
