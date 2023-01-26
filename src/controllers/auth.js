const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const { BadRequestError, UnauthenticatedError } = require('../errors');

const register = async (req, res) => {
  const user = await User.create({ ...req.body });
  const token = user.createJWT();
  res.status(StatusCodes.CREATED).json({
    user: {
      email: user.email,
      lastName: user.lastname,
      location: user.location,
      name: user.name,
      token,
    },
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Please provide email and password');
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthenticatedError('Invalid Credentials');
  }
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid Credentials');
  }
  // compare password
  const token = user.createJWT();
  res.status(StatusCodes.OK).json({
    user: {
      email: user.email,
      lastName: user.lastname,
      location: user.location,
      name: user.name,
      token,
    },
  });
};

const updateUser = async (req, res) => {
  const {
    body: {
      email, lastName, location, name,
    },
    user: { userId },
  } = req;

  if (!email || !lastName || !location || !name) {
    throw new BadRequestError('Please provide email, lastname, location, name');
  }

  // Here we update user in a different manner to show the PASSWORD GOTCHA.
  // 1) we find the user by its ID
  const user = await User.findOne({ _id: userId });
  // 2) change fields of the found User document
  user.email = email;
  user.lastname = lastName;
  user.location = location;
  user.name = name;
  // 3) Save this document by inserting a new document into the database IF document.isNew is true.
  // Or send an "updateOne" operation only with the modifications to the database.
  // It does not replace the whole document in our case because we are NOT CREATING NEW
  // DOCUMENT here, but we get the existing document from the DB. Which means that "$isNew" FLAG
  // is FALSE:
  await user.save();
  // 4) Create a new token (because token payload includes NAME of the user which we CHANGE here)
  const token = user.createJWT();
  // 5) send back all the needed data
  res.status(StatusCodes.OK).json({
    user: {
      email: user.email,
      lastName: user.lastname,
      location: user.location,
      name: user.name,
      token,
    },
  });
  // AND WE CAN NO LONGER LOGIN! Why? Because if we take a closer look at this code:
  // UserSchema.pre('save', async function () {
  //   const salt = await bcrypt.genSalt(10);
  //   this.password = await bcrypt.hash(this.password, salt);
  // });
  // then we can see that this is a PRE-SAVE hook that will be triggered everytime
  // we call "user.save". As a result ALREADY HASHED PASSWORD WILL BE HASHED AGAIN,
  // and password that we input on the client has no chance of matching this one.
};

module.exports = {
  register,
  login,
  updateUser,
};
