require('dotenv').config();
require('express-async-errors');

// extra security packages
const helmet = require('helmet');
const xss = require('xss-clean');

const express = require('express');

const app = express();

const path = require('path');
const connectDB = require('./db/connect');
const authenticateUser = require('./middleware/authentication');
// routers
const authRouter = require('./routes/auth');
const jobsRouter = require('./routes/jobs');
// error handler
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');

app.set('trust proxy', 1);
// serve the frontend
app.use(
  express.static(
    path.resolve(
      __dirname,
      '../../node-express-mongo-jobster-client-smilga/build',
    ),
  ),
);
app.use(express.json());
app.use(helmet());
app.use(xss());

// routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/jobs', authenticateUser, jobsRouter);

// serve index.html for any route that's not a part of API
app.get('*', (req, res) => {
  res.sendFile(
    path.resolve(
      __dirname,
      '../../node-express-mongo-jobster-client-smilga/build',
      'index.html',
    ),
  );
});

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(port, () => console.log(`Server is listening on port ${port}...`));
  } catch (error) {
    console.log(error);
  }
};

start();
