const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

// GET /api/users - Get all users
router.get('/', userController.getAll);

// GET /api/users/email/:email - Get user by email
router.get('/email/:email', userController.getByEmail);

// POST /api/users/register - Register new user
router.post('/register', userController.register);

// POST /api/users/login - Login user
router.post('/login', userController.login);

// GET /api/users/me - Get current authenticated user (protected route)
router.get('/me', authenticate, userController.getCurrentUser);

// GET /api/users/:id - Get user by ID
router.get('/:id', userController.getById);

// POST /api/users - Create new user
router.post('/', userController.create);

// PUT /api/users/:id - Update user
router.put('/:id', userController.update);

// DELETE /api/users/:id - Delete user
router.delete('/:id', userController.delete);

module.exports = router;

