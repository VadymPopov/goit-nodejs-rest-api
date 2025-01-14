const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");
// const path = require("path");
const fs = require("fs/promises");
const { nanoid } = require("nanoid");

const Jimp = require("jimp");

const { User } = require("../models/user");

const { HttpError, sendEmail, cloudinary } = require("../helpers");

const { SECRET_KEY, PROJECT_URL } = process.env;

// const avatarsDir = path.join(__dirname, "../", "public", "avatars");

const { ctrlWrapper } = require("../helpers");

const register = async (req, res) => {
  const { name, email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    throw HttpError(409, "Email is already in use");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const avatarURL = gravatar.url(email);
  const verificationToken = nanoid();

  const newUser = await User.create({
    ...req.body,
    password: hashedPassword,
    avatarURL,
    verificationToken,
  });

  const verifyEmail = {
    to: email,
    subject: "Verify email",
    // html: `<a target="_blank" href="${PROJECT_URL}/users/verify/${verificationToken}">Click to verify email</a>`,
    html: `<p>${name}, please verify your account. Your verification code is <span style="color:blue; font-weight: 700"> ${verificationToken} </span></p><p> With love your Phonebook App</p>`,
  };

  await sendEmail(verifyEmail);

  res.status(201).json({
    user: {
      name: newUser.name,
      email: newUser.email,
      subscription: newUser.subscription,
    },
  });
};

const verify = async (req, res) => {
  const { verificationToken } = req.params;

  const user = await User.findOne({ verificationToken });
  if (!user) {
    throw HttpError(404, "User not found");
  }

  await User.findByIdAndUpdate(user._id, {
    verify: true,
    verificationToken: null,
  });

  res.json({
    message: "Verification is successful",
  });
};

const resendVerifyEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw HttpError(400, "missing required field email");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(404);
  }

  if (user.verify) {
    throw HttpError(400, "Verification has already been passed");
  }

  const verifyEmail = {
    to: email,
    subject: "Verify email",
    // html: `<a target="_blank" href="${PROJECT_URL}/users/verify/${user.verificationToken}">Click to verify email</a>`,
    html: `<p>${user.name}, please verify your account. Your verification code is ${user.verificationToken}. With love your Phonebook App</p>`,
  };

  await sendEmail(verifyEmail);

  res.json({
    message: "Verification email has been sent successfully",
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, "Email or password is wrong");
  }

  if (!user.verify) {
    throw HttpError(401, "Please verify your email");
  }

  const passwordCompare = await bcrypt.compare(password, user.password);

  if (!passwordCompare) {
    throw HttpError(401, "Email or password is wrong");
  }

  const payload = {
    id: user._id,
  };

  const token = jwt.sign(payload, SECRET_KEY, {
    expiresIn: "23h",
  });
  await User.findByIdAndUpdate(user._id, { token });

  res.json({
    token,
    user: {
      email: user.email,
      subscription: user.subscription,
      avatarURL: user.avatarURL,
    },
  });
};

const getCurrent = async (req, res) => {
  const { email, subscription, avatarURL } = req.user;

  res.json({ email, subscription, avatarURL });
};

const logout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: "" });

  res.status(204).json({ message: "No Content" });
};

const updateSubscription = async (req, res) => {
  const { _id: id } = req.user;

  const result = await User.findByIdAndUpdate(id, req.body, {
    new: true,
  });
  if (!result) {
    throw HttpError(404, "Not found");
  }

  res.json(result);
};

const updateAvatar = async (req, res) => {
  const { _id } = req.user;
  const { path: tempUpload } = req.file;

  // to store avatar inside the folder of the project
  // const filename = `${_id}_${originalname}`;
  // const { path: tempUpload, originalname } = req.file;
  // const resultUpload = path.join(avatarsDir, filename);
  // await fs.rename(tempUpload, resultUpload);
  // const avatarURL = path.join("avatars", filename);
  // await User.findByIdAndUpdate(_id, { avatarURL });
  // res.json({ avatarURL });

  const avatar = await Jimp.read(`${tempUpload}`);
  avatar
    .resize(250, 250, (err) => {
      if (err) throw err;
    })
    .write(`${tempUpload}`);

  // using cloudinary for this purpose
  const fileData = await cloudinary.uploader.upload(tempUpload, {
    folder: "avatars",
  });
  await fs.unlink(tempUpload);

  await User.findByIdAndUpdate(_id, { avatarURL: fileData.url });
  res.json({ avatarURL: fileData.url });
};

module.exports = {
  register: ctrlWrapper(register),
  login: ctrlWrapper(login),
  verify: ctrlWrapper(verify),
  resendVerifyEmail: ctrlWrapper(resendVerifyEmail),
  getCurrent: ctrlWrapper(getCurrent),
  logout: ctrlWrapper(logout),
  updateSubscription: ctrlWrapper(updateSubscription),
  updateAvatar: ctrlWrapper(updateAvatar),
};
