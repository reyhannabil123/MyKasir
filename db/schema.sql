CREATE TABLE "cash_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"opening_cash" integer NOT NULL,
	"expected_cash" integer NOT NULL,
	"counted_cash" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "menu_item_variant_groups" (
	"menu_item_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "menu_item_variant_groups_menu_item_id_group_id_pk" PRIMARY KEY("menu_item_id","group_id")
);

CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"unlimited_stock" boolean DEFAULT true NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"sold_out" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"qty" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discount_mode" text DEFAULT 'rp' NOT NULL,
	"discount_value" double precision DEFAULT 0 NOT NULL
);

CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_name" text DEFAULT '' NOT NULL,
	"order_type" text DEFAULT 'Makan di tempat' NOT NULL,
	"table_no" text DEFAULT '' NOT NULL,
	"subtotal" integer NOT NULL,
	"item_discount" integer DEFAULT 0 NOT NULL,
	"order_discount_mode" text DEFAULT 'rp' NOT NULL,
	"order_discount_value" double precision DEFAULT 0 NOT NULL,
	"order_discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"status" text NOT NULL,
	"paid_at" timestamp with time zone,
	"was_pay_later" boolean DEFAULT false NOT NULL,
	"cash_received" integer DEFAULT 0 NOT NULL,
	"change_given" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "orders_user_number_uq" UNIQUE("user_id","number")
);

CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" text NOT NULL,
	"amount" integer NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"shop_name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"qris_image" text DEFAULT '' NOT NULL,
	"paper_width" integer DEFAULT 58 NOT NULL,
	"receipt_footer" text DEFAULT 'Terima kasih, sampai jumpa lagi!' NOT NULL,
	"theme" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "variant_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "variant_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "menu_item_variant_groups" ADD CONSTRAINT "menu_item_variant_groups_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "menu_item_variant_groups" ADD CONSTRAINT "menu_item_variant_groups_group_id_variant_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."variant_groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "variant_groups" ADD CONSTRAINT "variant_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_group_id_variant_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."variant_groups"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id");
CREATE INDEX "expenses_user_idx" ON "expenses" USING btree ("user_id","created_at");
CREATE INDEX "menu_items_user_idx" ON "menu_items" USING btree ("user_id");
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");
CREATE INDEX "variant_groups_user_idx" ON "variant_groups" USING btree ("user_id");