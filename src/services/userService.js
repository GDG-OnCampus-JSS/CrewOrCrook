import User from "../models/userModel.js";

export async function createUser(username, avatar = null) {
  const user = await User.create({ username, avatar });
  return user;
}

export async function getUserById(id) {
  return User.findById(id);
}