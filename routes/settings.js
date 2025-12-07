const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');

// All settings routes require authentication
router.use(authenticate);

// GET /api/settings - Get user settings
router.get('/', settingsController.getUserSettings);

// PUT /api/settings - Update or create setting
router.put('/', settingsController.updateSetting);

// PUT /api/settings/bulk - Update multiple settings
router.put('/bulk', settingsController.updateSettings);

// DELETE /api/settings/:category/:key - Delete setting
router.delete('/:category/:key', settingsController.deleteSetting);

module.exports = router;

