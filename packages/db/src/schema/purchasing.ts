import { INVENTORY_TXN_KINDS, PO_STATUSES, SHIP_TO, WAREHOUSE_KINDS } from "@fieldline/shared";
import { boolean, date, index, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, idCol, money, qty, stamp, updatedAt } from "./_shared";
import { orgs, users } from "./core";
import { equipment, sites } from "./customers";
import { workOrders } from "./work";

export const poStatusEnum = pgEnum("po_status", PO_STATUSES);
export const shipToEnum = pgEnum("ship_to", SHIP_TO);
export const warehouseKindEnum = pgEnum("warehouse_kind", WAREHOUSE_KINDS);
export const inventoryTxnKindEnum = pgEnum("inventory_txn_kind", INVENTORY_TXN_KINDS);

export const vendors = pgTable(
  "vendors",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    city: text("city").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("vendors_org_idx").on(t.orgId)],
);

/** Main shop plus one warehouse per van. Stock is tracked per warehouse. */
export const warehouses = pgTable(
  "warehouses",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    kind: warehouseKindEnum("kind").notNull().default("main"),
    techId: uuid("tech_id").references(() => users.id),
    targetValue: money("target_value"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("warehouses_org_idx").on(t.orgId)],
);

/** Dollar buckets kept from the first build (Refrigerant, Motors, Controls...). */
export const inventoryCategories = pgTable(
  "inventory_categories",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("inventory_categories_slug").on(t.orgId, t.slug)],
);

/** A part by SKU. Stock by warehouse lives in inventory_stock. */
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    categoryId: uuid("category_id").references(() => inventoryCategories.id),
    unitCost: money("unit_cost").notNull().default(0),
    unit: text("unit").notNull().default("ea"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("inventory_items_sku").on(t.orgId, t.sku)],
);

export const inventoryStock = pgTable(
  "inventory_stock",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    itemId: uuid("item_id").notNull().references(() => inventoryItems.id),
    onHand: qty("on_hand").notNull().default(0),
    min: qty("min").notNull().default(0),
    max: qty("max").notNull().default(0),
    lastCountedAt: stamp("last_counted_at"),
    lastUsedAt: stamp("last_used_at"),
  },
  (t) => [uniqueIndex("inventory_stock_unique").on(t.warehouseId, t.itemId)],
);

/** Every movement of parts or dollars between warehouses, jobs and vendors. */
export const inventoryTxns = pgTable(
  "inventory_txns",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    categoryId: uuid("category_id").references(() => inventoryCategories.id),
    itemId: uuid("item_id").references(() => inventoryItems.id),
    kind: inventoryTxnKindEnum("kind").notNull(),
    /** Signed dollars. Positive into the warehouse. */
    amount: money("amount").notNull().default(0),
    /** Signed quantity for SKU items. */
    quantity: qty("quantity"),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    purchaseOrderId: uuid("purchase_order_id"),
    description: text("description").notNull().default(""),
    userId: uuid("user_id").references(() => users.id),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("inventory_txns_wh_idx").on(t.warehouseId, t.date), index("inventory_txns_wo_idx").on(t.workOrderId)],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    number: integer("number").notNull(),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    vendorName: text("vendor_name").notNull(),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    siteId: uuid("site_id").references(() => sites.id),
    shipTo: shipToEnum("ship_to").notNull().default("work_order"),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id),
    status: poStatusEnum("status").notNull().default("issued"),
    draft: boolean("draft").notNull().default(false),
    lumpSum: boolean("lump_sum").notNull().default(false),
    lumpSumAmount: money("lump_sum_amount"),
    /** Lump-sum POs remind the office to upload the pack list. */
    remindAt: stamp("remind_at"),
    orderedAt: stamp("ordered_at"),
    expectedDate: date("expected_date", { mode: "string" }),
    receivedAt: stamp("received_at"),
    receivedById: uuid("received_by_id").references(() => users.id),
    vendorInvoiceNumber: text("vendor_invoice_number").notNull().default(""),
    vendorInvoiceDate: date("vendor_invoice_date", { mode: "string" }),
    vendorInvoiceAmount: money("vendor_invoice_amount"),
    qboId: text("qbo_id"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("purchase_orders_number").on(t.orgId, t.number), index("purchase_orders_wo_idx").on(t.workOrderId), index("purchase_orders_status_idx").on(t.orgId, t.status)],
);

export const poLines = pgTable(
  "po_lines",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id),
    description: text("description").notNull(),
    quantity: qty("quantity").notNull().default(1),
    unitCost: money("unit_cost").notNull().default(0),
    receivedQty: qty("received_qty").notNull().default(0),
    receivedOn: date("received_on", { mode: "string" }),
    categoryId: uuid("category_id").references(() => inventoryCategories.id),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("po_lines_po_idx").on(t.purchaseOrderId)],
);

/** Parts used on a job from a van or the shop. Billed as material. */
export const truckParts = pgTable(
  "truck_parts",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id),
    itemId: uuid("item_id").references(() => inventoryItems.id),
    categoryId: uuid("category_id").references(() => inventoryCategories.id),
    description: text("description").notNull(),
    quantity: qty("quantity").notNull().default(1),
    unitCost: money("unit_cost").notNull().default(0),
    inventoryTxnId: uuid("inventory_txn_id"),
    /** Added by the office at billing with no stock movement. */
    direct: boolean("direct").notNull().default(false),
    addedBy: uuid("added_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("truck_parts_wo_idx").on(t.workOrderId)],
);
