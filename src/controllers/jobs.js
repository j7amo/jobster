const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const moment = require('moment');
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

const showStats = async (req, res) => {
  // in order to extract and transform data from DB we can use Aggregation.
  // Aggregation operations process multiple documents and return computed results.
  // We can use aggregation operations to:
  // - Group values from multiple documents together.
  // - Perform operations on the grouped data to return a single result.
  // - Analyze data changes over time.

  // To perform aggregation operations, you can use:
  // - Aggregation pipelines, which are the preferred method for performing aggregations.
  //
  // Single purpose aggregation methods, which are simple but lack the capabilities
  // of an aggregation pipeline.
  //
  // Aggregation Pipelines
  // An aggregation pipeline consists of one or more stages that process documents.
  // Each stage performs an operation on the input documents.
  // For example, a stage can (1)filter documents, (2)group documents, and (3)calculate values.
  // The documents that are output from a stage are passed to the next stage.
  // An aggregation pipeline can return results for groups of documents.
  // For example, return the total, average, maximum, and minimum values.
  let stats = await Job.aggregate([
    // 1) filter by user associated with the job
    {
      $match: {
        createdBy: mongoose.Types.ObjectId(req.user.userId),
      },
    },
    // 2) group by status
    {
      $group: {
        _id: '$status',
        // 3) calculate: each time a job of the same status is found - count increment happens
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  // we cannot use the "stats" data right away, we must transform it (because client
  // expects a specific structure of the data):
  stats = stats.reduce((acc, curr) => {
    const { _id: status, count } = curr;
    // eslint-disable-next-line no-underscore-dangle
    acc[status] = count;

    // return data in the format suitable for client
    return acc;
  }, {}); // results in { declined: 49, interview: 24, pending: 27 }

  const defaultStats = {
    pending: stats.pending || 0,
    interview: stats.interview || 0,
    declined: stats.declined || 0,
  };

  let monthlyApplications = await Job.aggregate([
    // filter
    {
      $match: {
        createdBy: mongoose.Types.ObjectId(req.user.userId),
      },
    },
    // group
    {
      $group: {
        _id: {
          // here we group jobs by YEAR & MONTH
          year: {
            // we use "$year" operator to extract year from "$createdAt" property
            $year: '$createdAt',
          },
          month: {
            // we use "$month" operator to extract month from "$createdAt" property
            $month: '$createdAt',
          },
        },
        // everytime we add such a document to the group we use "$sum" operator to increment value
        count: {
          $sum: 1,
        },
      },
    },
    // sort
    {
      $sort: {
        '_id.year': -1,
        '_id.month': -1,
      },
    },
    // limit
    {
      $limit: 6,
    },
  ]);
  // The result of aggregation is:
  // [
  //   { _id: { year: 2023, month: 1 }, count: 1 },
  //   { _id: { year: 2022, month: 12 }, count: 6 },
  //   { _id: { year: 2022, month: 11 }, count: 4 },
  //   { _id: { year: 2022, month: 10 }, count: 5 },
  //   { _id: { year: 2022, month: 9 }, count: 2 },
  //   { _id: { year: 2022, month: 8 }, count: 4 }
  // ]
  // we cannot use the "monthlyApplications" data right away, we must transform it (because client
  // expects a specific structure of the data):
  monthlyApplications = monthlyApplications
    .map((item) => {
      const {
        _id: { year, month },
        count,
      } = item;

      const date = moment()
        // we need to subtract 1 because "moment" treats month differently
        .month(month - 1)
        .year(year)
        .format('MMM Y');

      // return data in the format suitable for client
      return {
        date,
        count,
      };
    })
    .reverse();

  res.status(StatusCodes.OK).json({ defaultStats, monthlyApplications });
};

module.exports = {
  createJob,
  deleteJob,
  getAllJobs,
  updateJob,
  getJob,
  showStats,
};
