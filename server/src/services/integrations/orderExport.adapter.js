import { prisma } from "../../config/db.js";
import { stringifyCsv } from "../../utils/csv.js";
import { recordSyncResult, startSync, SYNC_ENTITY_TYPES } from "./syncLog.service.js";

const ORDER_EXPORT_COLUMNS = [
  "orderNumber", "orderId", "customerName", "customerEmail", "customerPhone",
  "country", "governorate", "cityArea", "street", "building", "apartmentFloor", "postalCode",
  "clinicName", "clinicBranch", "deliveryMethod", "deliveryNotes", "orderNotes", "paymentMethod",
  "orderStatus", "createdAt", "confirmedAtOrLastUpdatedAt", "orderTotal",
  "sku", "productName", "quantity", "unitPrice", "lineTotal", "selectedOptions",
];

function parseAddress(value) {
  try {
    const address = JSON.parse(value || "{}");
    return address && typeof address === "object" ? address : {};
  } catch {
    return { street: value || "" };
  }
}

export async function exportConfirmedOrders({ status = "CONFIRMED" } = {}) {
  if (status !== "CONFIRMED") {
    const error = new Error("Only confirmed orders can be exported.");
    error.statusCode = 400;
    throw error;
  }
  const syncLog = await startSync({
    entityType: SYNC_ENTITY_TYPES.ORDER_EXPORT,
    direction: "WEBSITE_TO_OWNER",
    sourceSystem: "MANUAL_CSV",
  });
  try {
    const orders = await prisma.order.findMany({
      where: { status: "CONFIRMED" },
      include: { items: { orderBy: { createdAt: "asc" } }, user: true },
      orderBy: { createdAt: "asc" },
    });
    const rows = orders.flatMap((order) => {
      const address = parseAddress(order.shippingAddress);
      return order.items.map((item) => ({
        orderNumber: order.orderNumber,
        orderId: order.id,
        customerName: order.customerName || order.user.name,
        customerEmail: order.customerEmail || order.user.email,
        customerPhone: order.customerPhone || order.user.phone || "",
        country: address.country || "",
        governorate: address.governorate || "",
        cityArea: address.cityArea || "",
        street: address.street || "",
        building: address.building || "",
        apartmentFloor: address.apartmentFloor || "",
        postalCode: address.postalCode || "",
        clinicName: address.clinicName || "",
        clinicBranch: address.clinicBranch || "",
        deliveryMethod: address.deliveryMethod || "",
        deliveryNotes: address.deliveryNotes || "",
        orderNotes: address.orderNotes || "",
        paymentMethod: order.paymentMethod || "",
        orderStatus: order.status,
        createdAt: order.createdAt,
        confirmedAtOrLastUpdatedAt: order.updatedAt,
        orderTotal: Number(order.total || 0),
        sku: item.sku || "",
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.total || 0),
        selectedOptions: "",
      }));
    });
    const csv = stringifyCsv(rows, ORDER_EXPORT_COLUMNS.map((key) => ({ key, header: key })));
    await recordSyncResult(syncLog.id, {
      status: "SUCCESS",
      summary: {
        outcome: "SUCCESS",
        ordersExported: orders.length,
        orderItemsExported: rows.length,
        ordersMarkedExported: 0,
        note: "CSV generated only; order sync status was not changed.",
      },
    });
    return { csv, orderCount: orders.length, itemCount: rows.length, syncLogId: syncLog.id };
  } catch (error) {
    await recordSyncResult(syncLog.id, {
      status: "FAILED",
      summary: { outcome: "FAILED", ordersExported: 0, orderItemsExported: 0 },
      errorSummary: error instanceof Error ? error.message : "Order export failed.",
    }).catch(() => {});
    throw error;
  }
}

export async function markOrderExported(orderIds) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return { count: 0 };
  const uniqueOrderIds = [...new Set(orderIds.filter((id) => typeof id === "string" && id))];
  if (uniqueOrderIds.length === 0) return { count: 0 };
  const syncLog = await startSync({
    entityType: SYNC_ENTITY_TYPES.ORDER_EXPORT_MARK,
    entityId: uniqueOrderIds.length === 1 ? uniqueOrderIds[0] : null,
    direction: "WEBSITE_TO_OWNER",
    sourceSystem: "OWNER_SYSTEM_ACKNOWLEDGEMENT",
  });
  try {
    const result = await prisma.order.updateMany({
      where: { id: { in: uniqueOrderIds }, status: "CONFIRMED" },
      data: { syncStatus: "EXPORTED", lastSyncedAt: new Date() },
    });
    await recordSyncResult(syncLog.id, {
      status: "SUCCESS",
      summary: { outcome: "SUCCESS", ordersRequested: uniqueOrderIds.length, ordersMarkedExported: result.count },
    });
    return result;
  } catch (error) {
    await recordSyncResult(syncLog.id, {
      status: "FAILED",
      summary: { outcome: "FAILED", ordersRequested: uniqueOrderIds.length, ordersMarkedExported: 0 },
      errorSummary: error instanceof Error ? error.message : "Could not mark orders exported.",
    }).catch(() => {});
    throw error;
  }
}
