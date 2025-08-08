import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  Select,
  Button,
  Banner,
  InlineStack,
  BlockStack,
  Checkbox,
  Text,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { ShopService } from "~/Services/ShopService.server";
import {type AdminApiContext} from "@shopify/shopify-app-remix/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopifyAdmin = admin as AdminApiContext
  const shopService = new ShopService(shopifyAdmin);

  const settings = await shopService.getShopSettings(session.shop);

  return json({ settings });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopifyAdmin = admin as AdminApiContext
  const shopService = new ShopService(shopifyAdmin);

  const formData = await request.formData();
  const settings = {
    cutoffTime: formData.get("cutoffTime") as string,
    maxDaysInAdvance: parseInt(formData.get("maxDaysInAdvance") as string),
    enableSameDayDelivery: formData.get("enableSameDayDelivery") === "true",
  };

  await shopService.updateShopSettings(session.shop, settings);

  return json({ status: "success" });
}

interface FormData {
  cutoffTime: string;
  maxDaysInAdvance: string;
  enableSameDayDelivery: boolean;
}

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [formData, setFormData] = useState<FormData>({
    cutoffTime: settings?.cutoffTime || "14:00",
    maxDaysInAdvance: settings?.maxDaysInAdvance?.toString() || "30",
    enableSameDayDelivery: settings?.enableSameDayDelivery || false,
  });

  const updateFormData = useCallback((path: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [path]: value,
    }));
  }, []);

  const validateFormData = (data: FormData): boolean => {
    if (!data.cutoffTime || !data.maxDaysInAdvance) {
      return false;
    }
    if (isNaN(parseInt(data.maxDaysInAdvance)) || parseInt(data.maxDaysInAdvance) <= 0) {
      return false;
    }
    return true;
  };

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();

    if (!validateFormData(formData)) {
      // You might want to show an error message here
      return;
    }

    const form = new FormData();
    form.append('cutoffTime', formData.cutoffTime);
    form.append('maxDaysInAdvance', formData.maxDaysInAdvance);
    form.append('enableSameDayDelivery', formData.enableSameDayDelivery.toString());

    submit(form, { method: 'post' });
  }, [formData, submit]);

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return { label: `${hour}:00`, value: `${hour}:00` };
  });

  const daysOptions = Array.from({ length: 90 }, (_, i) => ({
    label: `${i + 1} days`,
    value: (i + 1).toString(),
  }));

  return (
    <Page title="Delivery Settings">
      <Layout>
        <Layout.Section>
          <Form method="post" onSubmit={handleSubmit}>
            <Card>
              <BlockStack gap="400">
                <FormLayout>
                  <Select
                    label="Order Cutoff Time"
                    options={timeOptions}
                    value={formData.cutoffTime}
                    onChange={(value) => updateFormData('cutoffTime', value)}
                    helpText="Orders placed after this time will be scheduled for the next available delivery day"
                    requiredIndicator={true}
                  />

                  <Select
                    label="Maximum Days in Advance"
                    options={daysOptions}
                    value={formData.maxDaysInAdvance}
                    onChange={(value) => updateFormData('maxDaysInAdvance', value)}
                    helpText="How far in advance customers can schedule deliveries"
                    requiredIndicator={true}
                  />

                  <Checkbox
                    label="Enable Same-Day Delivery"
                    checked={formData.enableSameDayDelivery}
                    onChange={(checked) => updateFormData('enableSameDayDelivery', checked)}
                    helpText="Allow customers to select delivery slots for the same day (before cutoff time)"
                  />

                  <InlineStack align="end">
                    <Button variant="primary" submit>
                      Save Changes
                    </Button>
                  </InlineStack>
                </FormLayout>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">About Delivery Settings</Text>
                <Text as="p">
                  Configure your delivery schedule preferences here. These settings affect how and when customers can select delivery slots during checkout.
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Tips</Text>
                <Banner tone="info">
                  <BlockStack gap="200">
                    <Text as="p">Set your cutoff time based on your operational capacity and courier pickup schedules.</Text>
                    <Text as="p">Consider limiting the maximum advance booking period to maintain accurate availability.</Text>
                  </BlockStack>
                </Banner>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
