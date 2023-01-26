require('dotenv').config({ path: '../../.env' });
const Job = require('../models/Job');
const connectDB = require('./connect');
const mockData = require('../../MOCK_DATA.json');

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    await Job.create(mockData);
    console.log('DB populated successfully!');
    process.exit(0);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

start();
