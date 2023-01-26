const { StatusCodes } = require('http-status-codes');
const Job = require('../models/Job');
const { BadRequestError, NotFoundError } = require('../errors');

const getAllJobs = async (req, res) => {
  // Because we have query parameters coming from the client
  // we need to extract them first from "req.query" object
  const {
    search, status, jobType, sort, page, limit,
  } = req.query;

  // before we set up the base query we need to create a query object with filters
  // that we want to apply when searching for documents in the DB.
  // So we start with "createdBy" to get the jobs for a specific user:
  const queryObject = {
    createdBy: req.user.userId,
  };

  // then we need to dynamically create properties on this object IF there are
  // corresponding query parameters coming from the client:
  if (search) {
    queryObject.position = { $regex: search, $options: 'i' };
  }

  if (status && status !== 'all') {
    queryObject.status = status;
  }

  if (jobType && jobType !== 'all') {
    queryObject.jobType = jobType;
  }

  // Now when we have a complete "queryObject" we set up the base query
  // to find ALL jobs associated with the current user.
  // BUT we DO NOT RIGHT AWAY AWAIT the query because if we do so and
  // we have some additional queries that affect the final "jobs" object,
  // then we would not be able to chain them anymore after we awaited the base one.
  let dBquery = Job.find(queryObject);

  // then we just check if we have a specific query param
  // and chain the corresponding query to the base query
  if (sort) {
    if (sort === 'latest') {
      dBquery = dBquery.sort('-createdAt');
    }

    if (sort === 'oldest') {
      dBquery = dBquery.sort('createdAt');
    }

    if (sort === 'a-z') {
      dBquery = dBquery.sort('position');
    }

    if (sort === 'z-a') {
      dBquery = dBquery.sort('-position');
    }
  }

  // set up pagination (which is a great idea because we speed up the app as
  // we are not sending all data available + client has to render less)
  const jobsPerPage = Number(limit) || 10;
  const jobsToSkip = (Number(page) - 1) * jobsPerPage || 0;
  dBquery = dBquery.skip(jobsToSkip).limit(jobsPerPage);
  const totalJobs = await Job.countDocuments(queryObject);
  const numOfPages = Math.ceil(totalJobs / jobsPerPage);

  // and finally we await the chain of queries to get the final result
  const jobs = await dBquery;

  res.status(StatusCodes.OK).json({ jobs, totalJobs, numOfPages });
};
const getJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req;

  const job = await Job.findOne({
    _id: jobId,
    createdBy: userId,
  });
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).json({ job });
};

const createJob = async (req, res) => {
  req.body.createdBy = req.user.userId;
  const job = await Job.create(req.body);
  res.status(StatusCodes.CREATED).json({ job });
};

const updateJob = async (req, res) => {
  const {
    body: { company, position },
    user: { userId },
    params: { id: jobId },
  } = req;

  if (company === '' || position === '') {
    throw new BadRequestError('Company or Position fields cannot be empty');
  }
  const job = await Job.findByIdAndUpdate(
    { _id: jobId, createdBy: userId },
    req.body,
    { new: true, runValidators: true },
  );
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).json({ job });
};

const deleteJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req;

  const job = await Job.findByIdAndRemove({
    _id: jobId,
    createdBy: userId,
  });
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).send();
};

module.exports = {
  createJob,
  deleteJob,
  getAllJobs,
  updateJob,
  getJob,
};
