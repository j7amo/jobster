const express = require('express');
const testUser = require('../middleware/test-user');

const router = express.Router();
const authenticateUser = require('../middleware/authentication');
const { register, login, updateUser } = require('../controllers/auth');

router.post('/register', register);
router.post('/login', login);
// we add "updateUser" resource handling here. Because this is an authenticated resource(obviously
// user cannot update his profile BEFORE logging in), we need to register auth middleware
// before controller:
router.patch('/updateUser', authenticateUser, testUser, updateUser);

module.exports = router;
