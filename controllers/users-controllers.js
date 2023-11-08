const HttpError = require('../models/http-error');
const { validationResult } = require('express-validator');
const User = require('../models/user');

const getUsers = async (req, res, next) => {
  let users;
  try {
    /* users = await User.find({}, 'name email');
    res.json(users); */
    users = await User.find({}, '-password');
  } catch (err) {
    return next(new HttpError('Internal server issue, Please try later', 500));
  }
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

/* signup new user */
const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      'Signing up failed, please try again later.',
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      'User exists already, please login instead.',
      422
    );
    return next(error);
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.path,
    password,
    places: [],
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError('Signing up failed, please try again.', 500);
    return next(error);
  }

  res.status(201).json({ user: createdUser.toObject({ getters: true }) });
};

/* --------------- login user ------------------- */
const login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    return next(
      new HttpError('Logging failed, please try after sometime', 500)
    );
  }

  if (!existingUser || existingUser.password !== password) {
    return next(new HttpError('Invalid login credentials', 401));
  }
  res.json({
    message: 'Logged in',
    user: existingUser.toObject({ getters: true }),
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
