CREATE TYPE "public"."role" AS ENUM('admin', 'supervisor', 'dispatcher', 'customer_service', 'billing', 'tech');--> statement-breakpoint
CREATE TYPE "public"."equipment_source" AS ENUM('manual', 'list_import', 'nameplate_photo');--> statement-breakpoint
CREATE TYPE "public"."equipment_stage" AS ENUM('proposed', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."invoice_delivery" AS ENUM('email', 'print', 'both', 'text');--> statement-breakpoint
CREATE TYPE "public"."billing_type" AS ENUM('tm', 'nte', 'quoted');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('service', 'maintenance', 'quoted');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('photo', 'nameplate', 'signature', 'document', 'report', 'vendor_invoice');--> statement-breakpoint
CREATE TYPE "public"."follow_up_kind" AS ENUM('review_request', 'permit_final', 'warranty_registration', 'eta_text_failed', 'quote_touch', 'custom');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('open', 'snoozed', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('urgent', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."tech_status" AS ENUM('en_route', 'on_site', 'paused', 'done');--> statement-breakpoint
CREATE TYPE "public"."time_kind" AS ENUM('labor', 'travel', 'meal', 'rest');--> statement-breakpoint
CREATE TYPE "public"."timesheet_status" AS ENUM('open', 'submitted', 'approved');--> statement-breakpoint
CREATE TYPE "public"."wait_reason" AS ENUM('parts', 'quote_sent', 'approved', 'return', 'no_access', 'warranty');--> statement-breakpoint
CREATE TYPE "public"."wo_status" AS ENUM('open', 'closed', 'billed');--> statement-breakpoint
CREATE TYPE "public"."quote_reason" AS ENUM('pm', 'service', 'customer');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'viewed', 'approved', 'declined', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."quote_tier" AS ENUM('single', 'good', 'better', 'best');--> statement-breakpoint
CREATE TYPE "public"."inventory_txn_kind" AS ENUM('po_receipt', 'used_on_wo', 'transfer_in', 'transfer_out', 'count_adjust');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'issued', 'partial', 'received', 'invoiced', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ship_to" AS ENUM('work_order', 'inventory');--> statement-breakpoint
CREATE TYPE "public"."warehouse_kind" AS ENUM('main', 'vehicle');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('complaint', 'incorrect', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'billed', 'paid', 'partially_credited', 'credited', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'ach', 'check', 'cash', 'link', 'tap_to_pay', 'autopay');--> statement-breakpoint
CREATE TYPE "public"."agreement_billing" AS ENUM('monthly_card', 'annual_invoice', 'pre_billed', 'on_demand');--> statement-breakpoint
CREATE TYPE "public"."agreement_status" AS ENUM('pending', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."agreement_tier" AS ENUM('bronze', 'silver', 'gold', 'custom');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('unscheduled', 'scheduled', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."automation_key" AS ENUM('confirmation', 'on_my_way', 'review_request', 'quote_followup', 'permit_warranty', 'pm_due', 'missed_call');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'received');--> statement-breakpoint
CREATE TYPE "public"."leak_check" AS ENUM('passed', 'failed', 'na');--> statement-breakpoint
CREATE TYPE "public"."permit_status" AS ENUM('needed', 'applied', 'issued', 'inspected', 'final', 'na');--> statement-breakpoint
CREATE TABLE "counters" (
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" integer DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"from_value" text,
	"to_value" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"license" text DEFAULT '' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_home" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_off_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" "role" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"team_id" uuid,
	"home_team_id" uuid,
	"can_edit_customers" boolean,
	"can_bill" boolean,
	"shift_hours" numeric(8, 2) DEFAULT 8 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"auth_subject" text,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"billing_address" text DEFAULT '' NOT NULL,
	"ap_contact_name" text DEFAULT '' NOT NULL,
	"ap_contact_phone" text DEFAULT '' NOT NULL,
	"contract" boolean DEFAULT false NOT NULL,
	"credit_limit" numeric(12, 2),
	"account_manager_id" uuid,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"tax_exempt_number" text DEFAULT '' NOT NULL,
	"invoice_delivery" "invoice_delivery",
	"invoice_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"card_on_file" jsonb,
	"portal_enabled" boolean DEFAULT false NOT NULL,
	"portal_token" text,
	"qbo_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"kind" text DEFAULT '' NOT NULL,
	"make" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"serial" text DEFAULT '' NOT NULL,
	"tons" numeric(12, 3),
	"refrigerant" text DEFAULT '' NOT NULL,
	"charge_lbs" numeric(12, 3),
	"install_year" integer,
	"manufacture_date" date,
	"warranty_parts_until" date,
	"warranty_labor_until" date,
	"location_note" text DEFAULT '' NOT NULL,
	"source" "equipment_source" DEFAULT 'manual' NOT NULL,
	"stage" "equipment_stage" DEFAULT 'active' NOT NULL,
	"nameplate_file_id" uuid,
	"qr_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"address" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"access_notes" text DEFAULT '' NOT NULL,
	"primary_tech_id" uuid,
	"backup_tech_id" uuid,
	"tax_rate" numeric(6, 3),
	"invoice_delivery" "invoice_delivery",
	"invoice_emails" jsonb,
	"lat" numeric(6, 3),
	"lng" numeric(6, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "file_kind" DEFAULT 'photo' NOT NULL,
	"work_order_id" uuid,
	"equipment_id" uuid,
	"related_id" uuid,
	"caption" text DEFAULT '' NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text DEFAULT 'application/octet-stream' NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"include_in_report" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" "follow_up_kind" NOT NULL,
	"status" "follow_up_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"due_on" date,
	"customer_id" uuid,
	"work_order_id" uuid,
	"related_id" uuid,
	"assigned_to" uuid,
	"snoozed_until" date,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_order_id" uuid,
	"site_id" uuid,
	"user_id" uuid,
	"kind" text DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"work_order_id" uuid,
	"kind" text DEFAULT 'assignment' NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tech_id" uuid NOT NULL,
	"lat" numeric(6, 3) NOT NULL,
	"lng" numeric(6, 3) NOT NULL,
	"accuracy_m" integer,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_order_id" uuid,
	"tech_id" uuid NOT NULL,
	"kind" time_kind NOT NULL,
	"date" date NOT NULL,
	"started_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"edited_by" uuid,
	"source" text DEFAULT 'clock' NOT NULL,
	"gps_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tech_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" timesheet_status DEFAULT 'open' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_comment" text DEFAULT '' NOT NULL,
	"meal_reason" text DEFAULT '' NOT NULL,
	"missed_meal" boolean DEFAULT false NOT NULL,
	"missed_rest" boolean DEFAULT false NOT NULL,
	"premium_hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"payroll_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_helpers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"tech_id" uuid NOT NULL,
	"role" text DEFAULT 'helper' NOT NULL,
	"scheduled_for" date,
	"start_minute" integer,
	"allocated_hours" numeric(8, 2),
	"tech_status" "tech_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"trip" integer DEFAULT 1 NOT NULL,
	"customer_id" uuid,
	"site_id" uuid,
	"equipment_id" uuid,
	"site_text" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"call_type" "call_type" DEFAULT 'service' NOT NULL,
	"billing_type" "billing_type" DEFAULT 'tm' NOT NULL,
	"nte_amount" numeric(12, 2),
	"quoted_amount" numeric(12, 2),
	"material_budget" numeric(12, 2),
	"labor_budget_hours" numeric(8, 2),
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"status" "wo_status" DEFAULT 'open' NOT NULL,
	"tech_status" "tech_status",
	"tech_status_at" timestamp with time zone,
	"assigned_tech_id" uuid,
	"scheduled_for" date,
	"start_minute" integer,
	"allocated_hours" numeric(8, 2),
	"dispatch_note" text DEFAULT '' NOT NULL,
	"need_return" boolean DEFAULT false NOT NULL,
	"waiting_on_parts" boolean DEFAULT false NOT NULL,
	"warranty" boolean DEFAULT false NOT NULL,
	"caller_name" text DEFAULT '' NOT NULL,
	"caller_phone" text DEFAULT '' NOT NULL,
	"customer_po" text DEFAULT '' NOT NULL,
	"signature_required" boolean DEFAULT false NOT NULL,
	"work_performed" text DEFAULT '' NOT NULL,
	"signer_name" text DEFAULT '' NOT NULL,
	"signature_file_id" uuid,
	"summary" text DEFAULT '' NOT NULL,
	"follow_up" jsonb,
	"agreement_id" uuid,
	"agreement_visit_id" uuid,
	"tracking_token" text,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricebook_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Repairs' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parts_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"labor_hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"price_good" numeric(12, 2),
	"price_better" numeric(12, 2),
	"price_best" numeric(12, 2),
	"margin_percent" numeric(6, 3),
	"image_file_id" uuid,
	"times_used" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"option_id" uuid,
	"kind" text DEFAULT 'material' NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"pricebook_item_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"tier" "quote_tier" DEFAULT 'single' NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"cost" numeric(12, 2),
	"financing_monthly" numeric(12, 2),
	"is_recommended" boolean DEFAULT false NOT NULL,
	"included" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"customer_id" uuid,
	"site_id" uuid,
	"equipment_id" uuid,
	"work_order_id" uuid,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"reason" "quote_reason" DEFAULT 'service' NOT NULL,
	"problem_text" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"scope_template_id" uuid,
	"labor" jsonb DEFAULT '{"journeymanHours":0,"apprenticeHours":0,"driverHours":0,"journeymanRate":null,"apprenticeRate":null,"driverRate":null}'::jsonb NOT NULL,
	"margin_percent" numeric(6, 3) DEFAULT 45 NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"loss_reason" text DEFAULT '' NOT NULL,
	"loss_note" text DEFAULT '' NOT NULL,
	"follow_up_date" date,
	"follow_up_kind" text DEFAULT '' NOT NULL,
	"selected_option_id" uuid,
	"created_work_order_id" uuid,
	"approval_token" text,
	"signer_name" text DEFAULT '' NOT NULL,
	"signature_file_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scope_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"labor_hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"labor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid,
	"unit_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'ea' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"on_hand" numeric(12, 3) DEFAULT 0 NOT NULL,
	"min" numeric(12, 3) DEFAULT 0 NOT NULL,
	"max" numeric(12, 3) DEFAULT 0 NOT NULL,
	"last_counted_at" timestamp with time zone,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_txns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"category_id" uuid,
	"item_id" uuid,
	"kind" "inventory_txn_kind" NOT NULL,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"quantity" numeric(12, 3),
	"work_order_id" uuid,
	"purchase_order_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"user_id" uuid,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"received_qty" numeric(12, 3) DEFAULT 0 NOT NULL,
	"received_on" date,
	"category_id" uuid,
	"inventory_item_id" uuid,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"vendor_id" uuid,
	"vendor_name" text NOT NULL,
	"work_order_id" uuid,
	"equipment_id" uuid,
	"site_id" uuid,
	"ship_to" "ship_to" DEFAULT 'work_order' NOT NULL,
	"warehouse_id" uuid,
	"status" "po_status" DEFAULT 'issued' NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"lump_sum" boolean DEFAULT false NOT NULL,
	"lump_sum_amount" numeric(12, 2),
	"remind_at" timestamp with time zone,
	"ordered_at" timestamp with time zone,
	"expected_date" date,
	"received_at" timestamp with time zone,
	"received_by_id" uuid,
	"vendor_invoice_number" text DEFAULT '' NOT NULL,
	"vendor_invoice_date" date,
	"vendor_invoice_amount" numeric(12, 2),
	"qbo_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "truck_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"item_id" uuid,
	"category_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT 1 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT 0 NOT NULL,
	"inventory_txn_id" uuid,
	"direct" boolean DEFAULT false NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "warehouse_kind" DEFAULT 'main' NOT NULL,
	"tech_id" uuid,
	"target_value" numeric(12, 2),
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_memos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" "credit_reason" DEFAULT 'other' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"line_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"method" "invoice_delivery" NOT NULL,
	"emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"rev" integer NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"work_order_id" uuid NOT NULL,
	"customer_id" uuid,
	"status" "invoice_status" DEFAULT 'billed' NOT NULL,
	"billed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" date,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"labor_mode" text DEFAULT 'itemized' NOT NULL,
	"material_mode" text DEFAULT 'itemized' NOT NULL,
	"hide_hourly_rate" boolean DEFAULT false NOT NULL,
	"descriptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"taxable_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"tax_rate" numeric(6, 3) DEFAULT 0 NOT NULL,
	"sales_tax" numeric(12, 2) DEFAULT 0 NOT NULL,
	"accrued_use_tax" numeric(12, 2) DEFAULT 0 NOT NULL,
	"payment_token" text,
	"qbo_id" text,
	"qbo_synced_at" timestamp with time zone,
	"qbo_error" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"provider_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"season" text NOT NULL,
	"due_on" date NOT NULL,
	"status" "visit_status" DEFAULT 'unscheduled' NOT NULL,
	"work_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"tier" "agreement_tier" DEFAULT 'silver' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"status" "agreement_status" DEFAULT 'active' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"billing_method" "agreement_billing" DEFAULT 'annual_invoice' NOT NULL,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"visit_amount" numeric(12, 2),
	"visits_per_year" integer DEFAULT 2 NOT NULL,
	"response_hours" integer,
	"included_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" "automation_key" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"customer_id" uuid,
	"work_order_id" uuid,
	"channel" "message_channel" DEFAULT 'sms' NOT NULL,
	"direction" "message_direction" NOT NULL,
	"from_address" text DEFAULT '' NOT NULL,
	"to_address" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"automated" boolean DEFAULT false NOT NULL,
	"template" text DEFAULT '' NOT NULL,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"error" text DEFAULT '' NOT NULL,
	"sent_by" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"tech_id" uuid,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_before_complete" boolean DEFAULT false NOT NULL,
	"trigger" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"site_id" uuid,
	"jurisdiction" text DEFAULT '' NOT NULL,
	"permit_number" text DEFAULT '' NOT NULL,
	"status" "permit_status" DEFAULT 'needed' NOT NULL,
	"tests" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"filed_on" date,
	"final_on" date,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refrigerant_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"equipment_id" uuid,
	"tech_id" uuid,
	"tech_cert" text DEFAULT '' NOT NULL,
	"refrigerant_type" text NOT NULL,
	"lbs_added" numeric(12, 3) DEFAULT 0 NOT NULL,
	"lbs_recovered" numeric(12, 3) DEFAULT 0 NOT NULL,
	"cylinder_id" text DEFAULT '' NOT NULL,
	"leak_check" "leak_check" DEFAULT 'na' NOT NULL,
	"leak_rate_percent" numeric(6, 3),
	"full_charge_lbs" numeric(12, 3),
	"notes" text DEFAULT '' NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"work_order_id" uuid,
	"manufacturer" text DEFAULT '' NOT NULL,
	"registered_on" date,
	"registration_deadline" date,
	"claim_status" text DEFAULT 'none' NOT NULL,
	"claim_number" text DEFAULT '' NOT NULL,
	"parts_return_by" date,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counters" ADD CONSTRAINT "counters_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_changes" ADD CONSTRAINT "field_changes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_changes" ADD CONSTRAINT "field_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_off_days" ADD CONSTRAINT "user_off_days_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_off_days" ADD CONSTRAINT "user_off_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_manager_id_users_id_fk" FOREIGN KEY ("account_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_primary_tech_id_users_id_fk" FOREIGN KEY ("primary_tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_backup_tech_id_users_id_fk" FOREIGN KEY ("backup_tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_items" ADD CONSTRAINT "follow_up_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_items" ADD CONSTRAINT "follow_up_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_items" ADD CONSTRAINT "follow_up_items_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_items" ADD CONSTRAINT "follow_up_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_locations" ADD CONSTRAINT "tech_locations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_locations" ADD CONSTRAINT "tech_locations_tech_id_users_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tech_id_users_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_tech_id_users_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_helpers" ADD CONSTRAINT "work_order_helpers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_helpers" ADD CONSTRAINT "work_order_helpers_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_helpers" ADD CONSTRAINT "work_order_helpers_tech_id_users_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_tech_id_users_id_fk" FOREIGN KEY ("assigned_tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricebook_items" ADD CONSTRAINT "pricebook_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_option_id_quote_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."quote_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_templates" ADD CONSTRAINT "scope_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_parts" ADD CONSTRAINT "truck_parts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_parts" ADD CONSTRAINT "truck_parts_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_parts" ADD CONSTRAINT "truck_parts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_parts" ADD CONSTRAINT "truck_parts_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_parts" ADD CONSTRAINT "truck_parts_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_parts" ADD CONSTRAINT "truck_parts_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tech_id_users_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_memos" ADD CONSTRAINT "credit_memos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_revisions" ADD CONSTRAINT "invoice_revisions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_revisions" ADD CONSTRAINT "invoice_revisions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_revisions" ADD CONSTRAINT "invoice_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_assets" ADD CONSTRAINT "agreement_assets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_assets" ADD CONSTRAINT "agreement_assets_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_assets" ADD CONSTRAINT "agreement_assets_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_visits" ADD CONSTRAINT "agreement_visits_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_visits" ADD CONSTRAINT "agreement_visits_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_results" ADD CONSTRAINT "checklist_results_tech_id_users_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refrigerant_logs" ADD CONSTRAINT "refrigerant_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refrigerant_logs" ADD CONSTRAINT "refrigerant_logs_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refrigerant_logs" ADD CONSTRAINT "refrigerant_logs_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refrigerant_logs" ADD CONSTRAINT "refrigerant_logs_tech_id_users_id_fk" FOREIGN KEY ("tech_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "counters_unique" ON "counters" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "field_changes_entity_idx" ON "field_changes" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "teams_org_idx" ON "teams" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_off_days_unique" ON "user_off_days" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_subject_idx" ON "users" USING btree ("auth_subject");--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "equipment_site_idx" ON "equipment" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "equipment_org_idx" ON "equipment" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sites_org_idx" ON "sites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sites_customer_idx" ON "sites" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "files_wo_idx" ON "files" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "files_equipment_idx" ON "files" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "follow_up_items_org_idx" ON "follow_up_items" USING btree ("org_id","status","due_on");--> statement-breakpoint
CREATE INDEX "notes_wo_idx" ON "notes" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "tech_locations_tech_idx" ON "tech_locations" USING btree ("tech_id","recorded_at");--> statement-breakpoint
CREATE INDEX "time_entries_tech_day_idx" ON "time_entries" USING btree ("tech_id","date");--> statement-breakpoint
CREATE INDEX "time_entries_wo_idx" ON "time_entries" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheets_tech_day" ON "timesheets" USING btree ("tech_id","date");--> statement-breakpoint
CREATE INDEX "timesheets_org_day_idx" ON "timesheets" USING btree ("org_id","date");--> statement-breakpoint
CREATE INDEX "wo_helpers_wo_idx" ON "work_order_helpers" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "wo_helpers_tech_idx" ON "work_order_helpers" USING btree ("tech_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_number_trip" ON "work_orders" USING btree ("org_id","number","trip");--> statement-breakpoint
CREATE INDEX "work_orders_day_idx" ON "work_orders" USING btree ("org_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "work_orders_tech_idx" ON "work_orders" USING btree ("assigned_tech_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "work_orders_site_idx" ON "work_orders" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "work_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pricebook_code" ON "pricebook_items" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "pricebook_category_idx" ON "pricebook_items" USING btree ("org_id","category");--> statement-breakpoint
CREATE INDEX "quote_lines_quote_idx" ON "quote_lines" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_options_quote_idx" ON "quote_options" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_number" ON "quotes" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "quotes_customer_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "scope_templates_org_idx" ON "scope_templates" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_categories_slug" ON "inventory_categories" USING btree ("org_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_sku" ON "inventory_items" USING btree ("org_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_stock_unique" ON "inventory_stock" USING btree ("warehouse_id","item_id");--> statement-breakpoint
CREATE INDEX "inventory_txns_wh_idx" ON "inventory_txns" USING btree ("warehouse_id","date");--> statement-breakpoint
CREATE INDEX "inventory_txns_wo_idx" ON "inventory_txns" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "po_lines_po_idx" ON "po_lines" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_number" ON "purchase_orders" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "purchase_orders_wo_idx" ON "purchase_orders" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "truck_parts_wo_idx" ON "truck_parts" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "vendors_org_idx" ON "vendors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "warehouses_org_idx" ON "warehouses" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "credit_memos_invoice_idx" ON "credit_memos" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_deliveries_invoice_idx" ON "invoice_deliveries" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_revisions_invoice_idx" ON "invoice_revisions" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number" ON "invoices" USING btree ("org_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_wo" ON "invoices" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "agreement_assets_agreement_idx" ON "agreement_assets" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "agreement_visits_agreement_idx" ON "agreement_visits" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "agreement_visits_due_idx" ON "agreement_visits" USING btree ("org_id","status","due_on");--> statement-breakpoint
CREATE INDEX "agreements_site_idx" ON "agreements" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "agreements_org_status_idx" ON "agreements" USING btree ("org_id","status","ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "automations_key" ON "automations" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "messages_customer_idx" ON "messages" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_org_idx" ON "messages" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "checklist_results_wo_idx" ON "checklist_results" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "checklist_templates_org_idx" ON "checklist_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "permits_wo_idx" ON "permits" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "refrigerant_logs_wo_idx" ON "refrigerant_logs" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "refrigerant_logs_equipment_idx" ON "refrigerant_logs" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "warranty_claims_equipment_idx" ON "warranty_claims" USING btree ("equipment_id");