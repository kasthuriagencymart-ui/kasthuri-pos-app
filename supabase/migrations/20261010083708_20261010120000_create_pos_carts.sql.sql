/*
# Create persistent POS carts

1. New Tables
- `pos_carts` stores one active billing cart per signed-in user.
- `id` is the cart record identifier.
- `user_id` identifies the owner and defaults to the current authenticated user.
- `items` stores the current cart line items as JSON data.
- `discount` stores the active bill discount.
- `updated_at` records the latest cart change.

2. Security
- Row-level security is enabled.
- Authenticated users can only read, create, update, or delete their own cart.
- Anonymous users cannot access billing carts.

3. Important Notes
- The unique user index ensures each user has one active cart.
- The cart is cleared by the application after a completed bill or when the user explicitly clears it.
*/

CREATE TABLE IF NOT EXISTS pos_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE pos_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pos_carts" ON pos_carts;
CREATE POLICY "select_own_pos_carts" ON pos_carts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pos_carts" ON pos_carts;
CREATE POLICY "insert_own_pos_carts" ON pos_carts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_pos_carts" ON pos_carts;
CREATE POLICY "update_own_pos_carts" ON pos_carts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pos_carts" ON pos_carts;
CREATE POLICY "delete_own_pos_carts" ON pos_carts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
