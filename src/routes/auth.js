const express = require('express');
const rateLimiter = require('express-rate-limit');
const testUser = require('../middleware/test-user');

// we want to limit the number of requests from the same IP to prevent
// bad actors from spamming our API
const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    msg: 'Too many requests from your IP.Please try again after 15 minutes',
  },
});

const router = express.Router();
const authenticateUser = require('../middleware/authentication');
const { register, login, updateUser } = require('../controllers/auth');

router.post('/register', apiLimiter, register);
router.post('/login', apiLimiter, login);
// we add "updateUser" resource handling here. Because this is an authenticated resource(obviously
// user cannot update his profile BEFORE logging in), we need to register auth middleware
// before controller:
router.patch('/updateUser', authenticateUser, testUser, updateUser);

module.exports = router;
