-- Create payments table to track online payments for appointments
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', 'credit_card', 'debit_card', etc.
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
  transaction_id VARCHAR(255), -- External payment gateway transaction ID
  payment_intent_id VARCHAR(255), -- Stripe payment intent ID or similar
  receipt_url TEXT, -- URL to payment receipt
  failure_reason TEXT, -- Reason for payment failure
  paid_at TIMESTAMP WITH TIME ZONE, -- When payment was completed
  refunded_at TIMESTAMP WITH TIME ZONE, -- When payment was refunded
  refund_amount DECIMAL(10, 2), -- Amount refunded if applicable
  metadata JSONB, -- Additional payment metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT positive_amount CHECK (amount > 0),
  CONSTRAINT valid_refund CHECK (refund_amount IS NULL OR (refund_amount > 0 AND refund_amount <= amount))
);

-- Add foreign key constraints
ALTER TABLE payments 
ADD CONSTRAINT payments_doctor_id_fkey 
FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE payments 
ADD CONSTRAINT payments_patient_id_fkey 
FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_doctor_id ON payments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_doctor_status ON payments(doctor_id, payment_status);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE payments IS 'Online payments for appointments';
COMMENT ON COLUMN payments.amount IS 'Payment amount in the specified currency';
COMMENT ON COLUMN payments.payment_method IS 'Payment method used: stripe, paypal, credit_card, etc.';
COMMENT ON COLUMN payments.payment_status IS 'Payment status: pending, processing, completed, failed, refunded, cancelled';
COMMENT ON COLUMN payments.transaction_id IS 'External payment gateway transaction ID';
COMMENT ON COLUMN payments.payment_intent_id IS 'Stripe payment intent ID or similar gateway identifier';
COMMENT ON COLUMN payments.receipt_url IS 'URL to payment receipt/invoice';
COMMENT ON COLUMN payments.metadata IS 'Additional payment metadata in JSON format';

