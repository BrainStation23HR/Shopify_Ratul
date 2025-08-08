import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import {Link, Outlet, useLoaderData, useNavigation, useRouteError} from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "~/shopify.server";
import PageLoader from "~/routes/Components/PageLaoder";
import {BlockStack, Text, Link as HyperLink} from "@shopify/polaris";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to={"/app/delivery-zones"}>Delivery Zones</Link>
        <Link to={"/app/time-slots"}>Time Slots</Link>
        <Link to={"/app/blackout-dates"}>Blackout Dates</Link>
        <Link to={"/app/settings"}>Settings</Link>
      </NavMenu>
      <div style={{flexGrow: 1}}>
        {navigation.state === 'loading' || navigation.state === 'submitting' ?
          // {navigation.state === 'loading' ?
          <PageLoader/> : <Outlet/>
        }
      </div>
      <div style={{marginTop: "auto"}}>
        <BlockStack align="center" gap="800">
          <Text as="p" variant="bodyMd" alignment="center">
            © {new Date().getFullYear()} <HyperLink url="https://example.com" target="_blank" monochrome={true} removeUnderline={true}>Dynamic Delivery</HyperLink>. All rights reserved. | Version 1.0.0
          </Text>
        </BlockStack>
      </div>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
