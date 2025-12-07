-- Update payments table to use PHP (Philippine Peso) as default currency
-- This migration ensures all payments are in PHP currency

-- Update default currency to PHP
ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'PHP';

-- Update existing payments to PHP if they are in USD (optional, for existing data)
UPDATE payments SET currency = 'PHP' WHERE currency = 'USD' OR currency IS NULL;

-- Add constraint to ensure only PHP currency is allowed
ALTER TABLE payments ADD CONSTRAINT payments_currency_php_only CHECK (currency = 'PHP');

-- Add comment
COMMENT ON COLUMN payments.currency IS 'Payment currency - PHP (Philippine Peso) only';

