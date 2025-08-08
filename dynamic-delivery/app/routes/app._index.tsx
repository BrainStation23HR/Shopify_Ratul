import { type LoaderFunctionArgs, type ActionFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  ProgressBar,
  List,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  ButtonGroup,
} from "@shopify/polaris";
import { useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { DeliveryService } from "~/Services/DeliveryService.server";
import db from "~/db.server";
import DateRangeSelector from "~/routes/Components/DateRangeSelector";

interface DateRange {
  startDate: string;
  endDate: string;
}

function getDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (startDate && endDate) {
    // Create dates in local timezone to avoid UTC conversion issues
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    return { start, end };
  }

  // Default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  today.setHours(23, 59, 59, 999);

  return { start: thirtyDaysAgo, end: today };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const deliveryService = new DeliveryService();

  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');


    // @ts-ignore
    const dateRange = getDateRange(startDate, endDate);

    // Get orders within the date range
    const ordersInRange = await db.order.findMany({
      where: {
        shopName: session.shop,
        status: {
          in: ["CONFIRMED", "PENDING", "DELIVERED", "CANCELLED"]
        },
        deliveryDate: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      include: {
        deliverySlot: {
          include: {
            zone: {
              select: { name: true }
            }
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get upcoming deliveries (future orders regardless of filter)
    const today = new Date();
    const upcomingDeliveries = await db.order.findMany({
      where: {
        shopName: session.shop,
        status: {
          in: ["CONFIRMED", "PENDING"]
        },
        deliveryDate: {
          gte: today,
        }
      },
      include: {
        deliverySlot: {
          include: {
            zone: {
              select: { name: true }
            }
          }
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10,
    });

    // Get today's slots with booking counts
    const todaySlots = await deliveryService.getAllSlots(session.shop);
    // Calculate statistics for the selected period
    const totalOrders = ordersInRange.length;
    const confirmedOrders = ordersInRange.filter(o => o.status === "CONFIRMED").length;
    const deliveredOrders = ordersInRange.filter(o => o.status === "DELIVERED").length;
    const cancelledOrders = ordersInRange.filter(o => o.status === "CANCELLED").length;
    const pendingOrders = ordersInRange.filter(o => o.status === "PENDING").length;
    const totalRevenue = ordersInRange.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate period length in days
    const periodDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const avgDailyOrders = periodDays > 0 ? Math.round(totalOrders / periodDays * 10) / 10 : 0; // Round to 1 decimal
    const avgDailyRevenue = periodDays > 0 ? totalRevenue / periodDays : 0;

    // Calculate today's utilization from active slots
    const activeSlots = todaySlots.filter(slot => slot.isActive);
    const totalCapacity = activeSlots.reduce((acc, slot) => acc + slot.capacity, 0);
    const totalBookings = activeSlots.reduce((acc, slot) => acc + (slot.currentBookings || 0), 0);

    const stats = {
      totalOrders,
      confirmedOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      totalRevenue,
      avgDailyOrders,
      avgDailyRevenue,
      slotUtilization: totalCapacity > 0 ? Math.round((totalBookings / totalCapacity) * 100) : 0,
      periodDays,
      totalCapacity,
      totalBookings,
      dateRange: {
        startDate: dateRange.start.toISOString().split('T')[0],
        endDate: dateRange.end.toISOString().split('T')[0],
      }
    };

    return json({
      ordersInRange: ordersInRange.slice(0, 50),
      upcomingDeliveries,
      stats,
      todaySlots: activeSlots.slice(0, 10),
    });

  } catch (error) {
    console.error('❌ Error loading dashboard data:', error);

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);

    return json({
      ordersInRange: [],
      upcomingDeliveries: [],
      stats: {
        totalOrders: 0,
        confirmedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        avgDailyOrders: 0,
        avgDailyRevenue: 0,
        slotUtilization: 0,
        periodDays: 30,
        totalCapacity: 0,
        totalBookings: 0,
        dateRange: {
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        }
      },
      todaySlots: []
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const dashboard = formData.get('dashboard') as string;

  if (dashboard === "1" && startDate && endDate) {
    const url = new URL(request.url);
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    return Response.redirect(url.toString());
  }

  return json({ success: true });
}

export default function Dashboard() {
  const { ordersInRange, upcomingDeliveries, stats, todaySlots } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // Handle date range filter
  const handleFilter = useCallback((filter: DateRange) => {
    fetcher.submit({
      startDate: filter.startDate,
      endDate: filter.endDate,
      dashboard: "1"
    }, { method: 'POST' });
  }, [fetcher]);

  // Create initial date range for the component
  const initialDateRange: DateRange = {
    startDate: stats.dateRange.startDate,
    endDate: stats.dateRange.endDate,
  };

  // Format period display
  const formatDateForDisplay = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString();
  };

  const periodDisplay = `${formatDateForDisplay(stats.dateRange.startDate)} - ${formatDateForDisplay(stats.dateRange.endDate)}`;

  // Table rows for orders in selected period
  const orderRows = ordersInRange.map((order) => [
    order.deliveryDate.split('T')[0],
    `${order.deliverySlot.startTime} - ${order.deliverySlot.endTime}`,
    order.deliverySlot.zone.name,
    order.customerEmail,
    `$${order.totalAmount.toFixed(2)}`,
    <Badge key={order.id} tone={
      order.status === 'DELIVERED' ? 'success' :
        order.status === 'CONFIRMED' ? 'info' :
          order.status === 'CANCELLED' ? 'critical' : 'warning'
    }>
      {order.status}
    </Badge>
  ]);

  // Upcoming delivery rows
  const upcomingRows = upcomingDeliveries.map((order) => [
    order.deliveryDate.split('T')[0],
    `${order.deliverySlot.startTime} - ${order.deliverySlot.endTime}`,
    order.deliverySlot.zone.name,
    order.customerEmail,
    `$${order.totalAmount.toFixed(2)}`,
  ]);

  return (
    <Page
      title="Delivery Dashboard"
    >
      <Layout>
        {/* Filter Controls */}
        <Layout.Section>
          <BlockStack gap="400">
            <InlineStack align="end">
              <ButtonGroup>
                <DateRangeSelector
                  setFilter={handleFilter}
                  initialRange={initialDateRange}
                />
              </ButtonGroup>
            </InlineStack>

            {fetcher.state === 'submitting' && (
              <Text as="p" tone="subdued">Updating dashboard...</Text>
            )}
          </BlockStack>
        </Layout.Section>

        {/* Performance Metrics */}
        <Layout.Section>
          <InlineStack gap="400" align="start">
            <div style={{ flex: 1 }}>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Orders Overview</Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p">Total Orders</Text>
                      <Text as="p" variant="headingMd">{stats.totalOrders}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Pending</Text>
                      <Text as="p" variant="headingMd" tone="caution">{stats.pendingOrders}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Confirmed</Text>
                      <Text as="p" variant="headingMd" tone="success">{stats.confirmedOrders}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Delivered</Text>
                      <Text as="p" variant="headingMd" tone="success">{stats.deliveredOrders}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Cancelled</Text>
                      <Text as="p" variant="headingMd" tone="critical">{stats.cancelledOrders}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Daily Average</Text>
                      <Text as="p" variant="headingMd">{stats.avgDailyOrders}</Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </div>

            <div style={{ flex: 1 }}>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Revenue & Performance</Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p">Total Revenue</Text>
                      <Text as="p" variant="headingMd" tone="success">
                        ${stats.totalRevenue.toFixed(2)}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Daily Average</Text>
                      <Text as="p" variant="headingMd">
                        ${stats.avgDailyRevenue.toFixed(2)}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Avg Order Value</Text>
                      <Text as="p" variant="headingMd">
                        ${stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : '0.00'}
                      </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Period</Text>
                      <Text as="p" variant="headingMd">{stats.periodDays} days</Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </div>

            <div style={{ flex: 1 }}>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Today's Slots</Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p">Total Capacity</Text>
                      <Text as="p" variant="headingMd">{stats.totalCapacity}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p">Bookings</Text>
                      <Text as="p" variant="headingMd">{stats.totalBookings}</Text>
                    </InlineStack>
                    <BlockStack gap="100">
                      <Text as="p">Utilization</Text>
                      <ProgressBar progress={stats.slotUtilization} size="small" />
                      <Text as="p" tone="subdued">{stats.slotUtilization}% capacity used</Text>
                    </BlockStack>

                    {todaySlots.length > 0 ? (
                      <List type="bullet">
                        {todaySlots.slice(0, 3).map((slot) => (
                          <List.Item key={slot.id}>
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodySm">
                                {slot.startTime} - {slot.endTime}
                              </Text>
                              <Text as="span" tone="subdued" variant="bodySm">
                                {slot.currentBookings || 0}/{slot.capacity}
                              </Text>
                            </InlineStack>
                          </List.Item>
                        ))}
                        {todaySlots.length > 3 && (
                          <List.Item>
                            <Text as="span" variant="bodySm" tone="subdued">
                              +{todaySlots.length - 3} more slots
                            </Text>
                          </List.Item>
                        )}
                      </List>
                    ) : (
                      <Text as="p" tone="subdued" variant="bodySm">No slots configured</Text>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>
            </div>
          </InlineStack>
        </Layout.Section>

        {/* Upcoming Deliveries */}
        {upcomingDeliveries.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Upcoming Deliveries</Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {upcomingDeliveries.length} upcoming orders
                  </Text>
                </InlineStack>

                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Date", "Time Slot", "Zone", "Customer", "Total"]}
                  rows={upcomingRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Orders in Selected Period */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Orders for Selected Period
                </Text>
                <Text as="p" tone="subdued">
                  Showing {orderRows.length} of {stats.totalOrders} orders
                </Text>
              </InlineStack>

              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Date", "Time Slot", "Zone", "Customer", "Total", "Status"]}
                rows={orderRows}
                footerContent={orderRows.length === 0 ? `No orders found for ${periodDisplay}` : undefined}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
