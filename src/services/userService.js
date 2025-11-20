const User = require("../models/userModel");

async function createUser(username, avatar = null) {
  const user = await User.create({ username, avatar });
  return user;
}

async function getUserById(id) {
  return User.findById(id);
}

module.exports = {
  createUser,
  getUserById,
};
