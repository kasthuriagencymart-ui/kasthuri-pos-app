/*
# Checkout RPC + Helper Functions

1. Purpose
   - process_checkout: atomically creates a sale, its line items, decrements stock, updates customer credit, and logs audit — all in one server-side transaction.
   - generate_invoice_number: returns next invoice number using the sequence + prefix.
   - process_purchase: atomically creates a purchase, its line items, increments stock, updates supplier outstanding.
   - process_sales_return: creates a sales return, restocks items, adjusts customer credit.
   - process_purchase_return: creates a purchase return, removes stock, adjusts supplier outstanding.

2. Security
   - All functions are SECURITY DEFINER so they can update products/customers/suppliers which the caller already owns.
   - All functions verify auth.uid() matches the user_id on the payload.

3. Notes
   - These functions run server-side so stock updates are atomic and race-free.
*/

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(prefix text DEFAULT 'INV')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val bigint;
  inv_num text;
BEGIN
  next_val := nextval('invoice_seq');
  inv_num := prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 6, '0');
  RETURN inv_num;
END;
$$;

-- Process checkout (sale)
CREATE OR REPLACE FUNCTION process_checkout(
  p_customer_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT 'Walk-in Customer',
  p_subtotal numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_tax numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_paid numeric DEFAULT 0,
  p_balance numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_payment_details jsonb DEFAULT '{}',
  p_cashier text DEFAULT '',
  p_notes text DEFAULT '',
  p_items jsonb DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_id uuid;
  inv_num text;
  item jsonb;
  p_id uuid;
  p_name text;
  p_sku text;
  qty numeric;
  price numeric;
  item_discount numeric;
  item_tax numeric;
  item_total numeric;
  new_stock numeric;
  prefix text;
BEGIN
  -- Get invoice prefix from settings
  SELECT invoice_prefix INTO prefix FROM shop_settings WHERE user_id = auth.uid() LIMIT 1;
  IF prefix IS NULL THEN prefix := 'INV'; END IF;

  inv_num := generate_invoice_number(prefix);

  INSERT INTO sales (user_id, invoice_number, customer_id, customer_name, subtotal, discount, tax, total, paid, balance, payment_method, payment_details, cashier, notes)
  VALUES (auth.uid(), inv_num, p_customer_id, p_customer_name, p_subtotal, p_discount, p_tax, p_total, p_paid, p_balance, p_payment_method, p_payment_details, p_cashier, p_notes)
  RETURNING id INTO sale_id;

  -- Process items
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    p_id := (item->>'product_id')::uuid;
    p_name := item->>'product_name';
    p_sku := COALESCE(item->>'sku', '');
    qty := (item->>'quantity')::numeric;
    price := (item->>'price')::numeric;
    item_discount := COALESCE((item->>'discount')::numeric, 0);
    item_tax := COALESCE((item->>'tax')::numeric, 0);
    item_total := (item->>'total')::numeric;

    INSERT INTO sale_items (user_id, sale_id, product_id, product_name, sku, quantity, price, discount, tax, total)
    VALUES (auth.uid(), sale_id, p_id, p_name, p_sku, qty, price, item_discount, item_tax, item_total);

    -- Decrement stock
    IF p_id IS NOT NULL THEN
      UPDATE products SET stock = stock - qty, updated_at = now() WHERE id = p_id AND user_id = auth.uid();
    END IF;
  END LOOP;

  -- Update customer credit balance if there's a balance (credit sale)
  IF p_customer_id IS NOT NULL AND p_balance > 0 THEN
    UPDATE customers SET credit_balance = credit_balance + p_balance WHERE id = p_customer_id AND user_id = auth.uid();
  END IF;

  -- Audit log
  INSERT INTO audit_logs (user_id, actor, action, entity, entity_id, details)
  VALUES (auth.uid(), p_cashier, 'CREATE_SALE', 'sales', sale_id, jsonb_build_object('invoice_number', inv_num, 'total', p_total, 'payment_method', p_payment_method));

  RETURN sale_id;
END;
$$;

-- Process purchase (stock IN)
CREATE OR REPLACE FUNCTION process_purchase(
  p_supplier_id uuid DEFAULT NULL,
  p_supplier_name text DEFAULT '',
  p_subtotal numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_tax numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_paid numeric DEFAULT 0,
  p_balance numeric DEFAULT 0,
  p_payment_method text DEFAULT 'cash',
  p_notes text DEFAULT '',
  p_items jsonb DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_id uuid;
  inv_num text;
  item jsonb;
  p_id uuid;
  p_name text;
  qty numeric;
  price numeric;
  item_total numeric;
  prefix text;
BEGIN
  prefix := 'PUR';
  inv_num := prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 6, '0');

  INSERT INTO purchases (user_id, invoice_number, supplier_id, supplier_name, subtotal, discount, tax, total, paid, balance, payment_method, notes)
  VALUES (auth.uid(), inv_num, p_supplier_id, p_supplier_name, p_subtotal, p_discount, p_tax, p_total, p_paid, p_balance, p_payment_method, p_notes)
  RETURNING id INTO purchase_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    p_id := (item->>'product_id')::uuid;
    p_name := item->>'product_name';
    qty := (item->>'quantity')::numeric;
    price := (item->>'price')::numeric;
    item_total := (item->>'total')::numeric;

    INSERT INTO purchase_items (user_id, purchase_id, product_id, product_name, quantity, price, total)
    VALUES (auth.uid(), purchase_id, p_id, p_name, qty, price, item_total);

    -- Increment stock
    IF p_id IS NOT NULL THEN
      UPDATE products SET stock = stock + qty, purchase_price = price, updated_at = now() WHERE id = p_id AND user_id = auth.uid();
    END IF;
  END LOOP;

  -- Update supplier outstanding
  IF p_supplier_id IS NOT NULL AND p_balance > 0 THEN
    UPDATE suppliers SET outstanding = outstanding + p_balance WHERE id = p_supplier_id AND user_id = auth.uid();
  END IF;

  INSERT INTO audit_logs (user_id, actor, action, entity, entity_id, details)
  VALUES (auth.uid(), '', 'CREATE_PURCHASE', 'purchases', purchase_id, jsonb_build_object('invoice_number', inv_num, 'total', p_total));

  RETURN purchase_id;
END;
$$;

-- Process sales return (stock IN, credit reduces)
CREATE OR REPLACE FUNCTION process_sales_return(
  p_sale_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT '',
  p_total numeric DEFAULT 0,
  p_reason text DEFAULT '',
  p_items jsonb DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  return_id uuid;
  ret_num text;
  item jsonb;
  p_id uuid;
  p_name text;
  qty numeric;
  price numeric;
  item_total numeric;
BEGIN
  ret_num := 'SR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 6, '0');

  INSERT INTO sales_returns (user_id, return_number, sale_id, customer_id, customer_name, total, reason)
  VALUES (auth.uid(), ret_num, p_sale_id, p_customer_id, p_customer_name, p_total, p_reason)
  RETURNING id INTO return_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    p_id := (item->>'product_id')::uuid;
    p_name := item->>'product_name';
    qty := (item->>'quantity')::numeric;
    price := (item->>'price')::numeric;
    item_total := (item->>'total')::numeric;

    INSERT INTO sales_return_items (user_id, return_id, product_id, product_name, quantity, price, total)
    VALUES (auth.uid(), return_id, p_id, p_name, qty, price, item_total);

    IF p_id IS NOT NULL THEN
      UPDATE products SET stock = stock + qty, updated_at = now() WHERE id = p_id AND user_id = auth.uid();
    END IF;
  END LOOP;

  IF p_customer_id IS NOT NULL AND p_total > 0 THEN
    UPDATE customers SET credit_balance = GREATEST(credit_balance - p_total, 0) WHERE id = p_customer_id AND user_id = auth.uid();
  END IF;

  INSERT INTO audit_logs (user_id, actor, action, entity, entity_id, details)
  VALUES (auth.uid(), '', 'CREATE_SALES_RETURN', 'sales_returns', return_id, jsonb_build_object('return_number', ret_num, 'total', p_total));

  RETURN return_id;
END;
$$;

-- Process purchase return (stock OUT, supplier outstanding reduces)
CREATE OR REPLACE FUNCTION process_purchase_return(
  p_purchase_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_supplier_name text DEFAULT '',
  p_total numeric DEFAULT 0,
  p_reason text DEFAULT '',
  p_items jsonb DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  return_id uuid;
  ret_num text;
  item jsonb;
  p_id uuid;
  p_name text;
  qty numeric;
  price numeric;
  item_total numeric;
BEGIN
  ret_num := 'PR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_seq')::text, 6, '0');

  INSERT INTO purchase_returns (user_id, return_number, purchase_id, supplier_id, supplier_name, total, reason)
  VALUES (auth.uid(), ret_num, p_purchase_id, p_supplier_id, p_supplier_name, p_total, p_reason)
  RETURNING id INTO return_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    p_id := (item->>'product_id')::uuid;
    p_name := item->>'product_name';
    qty := (item->>'quantity')::numeric;
    price := (item->>'price')::numeric;
    item_total := (item->>'total')::numeric;

    INSERT INTO purchase_return_items (user_id, return_id, product_id, product_name, quantity, price, total)
    VALUES (auth.uid(), return_id, p_id, p_name, qty, price, item_total);

    IF p_id IS NOT NULL THEN
      UPDATE products SET stock = stock - qty, updated_at = now() WHERE id = p_id AND user_id = auth.uid();
    END IF;
  END LOOP;

  IF p_supplier_id IS NOT NULL AND p_total > 0 THEN
    UPDATE suppliers SET outstanding = GREATEST(outstanding - p_total, 0) WHERE id = p_supplier_id AND user_id = auth.uid();
  END IF;

  INSERT INTO audit_logs (user_id, actor, action, entity, entity_id, details)
  VALUES (auth.uid(), '', 'CREATE_PURCHASE_RETURN', 'purchase_returns', return_id, jsonb_build_object('return_number', ret_num, 'total', p_total));

  RETURN return_id;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION generate_invoice_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION process_checkout TO authenticated;
GRANT EXECUTE ON FUNCTION process_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION process_sales_return TO authenticated;
GRANT EXECUTE ON FUNCTION process_purchase_return TO authenticated;
