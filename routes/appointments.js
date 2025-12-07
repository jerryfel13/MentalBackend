

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes (but should be protected in production)
router.get('/user/:userId', appointmentController.getByUserId);
router.get('/doctor/:doctorId', appointmentController.getByDoctorId);
router.get('/doctor-user/:userId', authenticate, appointmentController.getByDoctorUserId);
router.get('/:id', appointmentController.getById);

// Admin routes
router.get('/', authenticate, requireAdmin, appointmentController.getAll);

// Protected routes (require authentication)
router.post('/', authenticate, appointmentController.create);
router.put('/:id', authenticate, appointmentController.update);
router.delete('/:id', authenticate, appointmentController.delete);

module.exports = router;



