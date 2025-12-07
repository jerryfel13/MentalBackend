const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// ========== WEBHOOK ROUTES (No auth required) ==========
// POST /api/payments/webhook - Process payment webhook (no auth required for webhooks)
router.post('/webhook', paymentController.processPaymentWebhook);

// All other payment routes require authentication
router.use(authenticate);

// ========== PATIENT ROUTES ==========
// GET /api/payments/patient - Get all payments for authenticated patient
router.get('/patient', paymentController.getPatientPayments);

// GET /api/payments/patient/stats - Get payment statistics for patient
router.get('/patient/stats', paymentController.getPatientPaymentStats);

// GET /api/payments/patient/history - Get patient payment history with filters
router.get('/patient/history', paymentController.getPatientPaymentHistory);

// GET /api/payments/appointment/:appointmentId - Get payment by appointment ID
router.get('/appointment/:appointmentId', paymentController.getPaymentByAppointmentId);

// POST /api/payments/initialize - Initialize payment (create payment record and get payment details)
router.post('/initialize', paymentController.initializePayment);

// GET /api/payments/:paymentId/status - Get payment status
router.get('/:paymentId/status', paymentController.getPaymentStatus);

// POST /api/payments/:paymentId/verify - Verify payment status
router.post('/:paymentId/verify', paymentController.verifyPayment);

// POST /api/payments/:paymentId/cancel - Cancel payment
router.post('/:paymentId/cancel', paymentController.cancelPayment);

// POST /api/payments/patient - Create payment from patient side (legacy)
router.post('/patient', paymentController.createPaymentFromPatient);

module.exports = router;

