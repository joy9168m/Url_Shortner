const cookieParser = require("cookie-parser");
const express = require("express");
const app = express();
app.use(cookieParser());
const { getUser } = require("../services/auth");

async function restrictToLoggedinUserOnly(req, res, next) {
  const token = req.cookies?.token;
  const user = getUser(token);
  if (!token) {
    return res.redirect("/login");
  }
  if (!user) {
    return res.redirect("/login");
  }
  req.user = user;
  next();
}

function resrictTo(roles = []) {
  return function(req, res, next) {
    if (!req.user) return res.redirect("/login");

    if (!roles.includes(req.user.role)) return res.end("Unauthorized");

    return next();
  }
}

// async function checkAuth(req, res, next) {
//   const token = req.cookies?.token;
//   const user = getUser(token);
//   req.user = user;
//   next();
// }

module.exports = {
  restrictToLoggedinUserOnly,
  resrictTo,
  // checkAuth,
};
