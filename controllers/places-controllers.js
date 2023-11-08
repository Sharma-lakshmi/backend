const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');

/* ------- Get Places by id --------------- */
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid; // { pid: 'p1' }

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, Could not find Place by id',
      500
    );
    return next(error);
  }
  if (!place) {
    const error = new HttpError(
      'Could not find a place for the provided id.',
      404
    );
    return next(error);
  }
  res.json({ place: place.toObject({ getters: true }) }); // => { place } => { place: place }
};

/* ------- Get Places by User id --------------- */
const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate('places');
  } catch (err) {
    const error = new HttpError('Something went wrong', 500);
    return next(error);
  }
  /* 
  let places;
  try {
    places = await Place.find({ creator: userId });
  } catch (err) {
    const error = new HttpError('Something went wrong', 500);
    return next(error);
  }
 */
  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(
      new HttpError('Could not find places for the provided user id.', 404)
    );
  }
  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

/* Create a new Place */
const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  //const { title, description, address, creator } = req.body;
  const title = req.body.title;
  const description = req.body.description;
  const address = req.body.address;
  const creator = req.body.creator;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    imageUrl: req.file.path,
    creator,
  });

  /* try catch block for verifying the User id exist or not */
  let user;
  try {
    user = await User.findById(creator);
  } catch (err) {
    return next(new HttpError('Unable to save the new place', 500));
  }
  if (!user) {
    return next(new HttpError("User doesn't exists", 404));
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError('Creating Place failed', 500);
    return next(error);
  }
  res.status(201).json({ place: createdPlace });
};

/* Update an existing place in the database */
const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new HttpError('Invalid inputs passed, please check your data.', 422);
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError('Something went wrong', 500);
    return next(error);
  }
  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update the place',
      500
    );
    return next(error);
  }
  res.status(200).json({ place: place.toObject({ getter: true }) });
};

/* Delete an existing Place */
const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId).populate('creator');
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete place.',
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Couldn't find a place with that ID", 404);
    return next(error);
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.deleteOne({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete place by selected Place Id.',
      500
    );
    return next(error);
  }

  res.status(200).json({ message: 'Deleted place.' });
};

/* Export the above components */

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
