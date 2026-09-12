require('dotenv').config();
const secret = process.env.Secret;

const jwt = require("jsonwebtoken")

function setUser(user) {
  if (!user) return null;
  return jwt.sign(user, secret)
}

function getUser(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}
module.exports = {
  setUser,
  getUser,
}
