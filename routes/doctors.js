const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/', doctorController.getAll);
router.get('/available', doctorController.getAvailable);
router.get('/:id', doctorController.getById);
router.post('/register', doctorController.register);
router.post('/login', doctorController.login);

// Protected routes (require authentication)
router.put('/:id', authenticate, doctorController.update);
router.delete('/:id', authenticate, doctorController.delete);

module.exports = router;

