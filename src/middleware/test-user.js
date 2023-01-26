const { BadRequestError } = require('../errors/index');

const testUserMiddleware = (req, res, next) => {
  if (req.user.testUser) {
    throw new BadRequestError('Test User. Read only.');
  }
  next();
};

module.exports = testUserMiddleware;
