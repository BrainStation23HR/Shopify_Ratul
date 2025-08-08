import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { WebHookService } from "~/Services/WebHookService.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const {shop, session, topic, payload} = await authenticate.webhook(request);
  console.log(`Received webhook: ${topic} for shop: ${shop}`);

  if (!session) {
    return new Response("Unauthorized", {status: 401});
  }

  const webHookService = new WebHookService();

  // Process the webhook
  const result = await webHookService.processWebhook(topic, shop, payload);

  if (!result.success) {
    console.error(`Webhook processing failed: ${result.error}`);
    return new Response("Failed to process webhook", {status: 500});
  }

  return new Response("Webhook processed successfully", {status: 200});
};

// For GET requests (webhook verification)
export const loader = async () => {
  return new Response("Webhook endpoint is active", { status: 200 });
};
