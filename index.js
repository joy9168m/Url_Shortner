const express = require("express");
const mongoose = require("mongoose");
const shortid = require('shortid');
const path = require("path");
const cookieParser = require("cookie-parser");
const { setUser, getUser } = require("./services/auth.js");
const { restrictToLoggedinUserOnly, checkAuth } = require("./middleware/auth.js");

const app = express();

const PORT = 8000;

mongoose.connect("mongodb://127.0.0.1:27017/url_shortner").then(() => console.log("Mongoose Connected")).catch((err) => console.log("mongo error ", err));

//Schema
const url_details = new mongoose.Schema({
  shortUrl: {
    type: String,
    unique: true,
    required: true,
  },
  redirectingUrl: {
    type: String,
    required: true,
  },
  totalClicks: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "login_details",
    required: true,
  },
  analytics_data: [{
    timestamp: { type: Number }
  }],
}, { timestamps: true })

const login_details = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
  },
}, { timestamps: true })



//model
const user_details = mongoose.model('url_details', url_details)
const user_login_details = mongoose.model('login_details', login_details)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set('views', path.resolve("./views"));

app.get("/url/frontend", restrictToLoggedinUserOnly, async (req, res) => {
  const allUrls = await user_details.find({});
  return res.render('./home.ejs', {
    Urls: allUrls,
  })
})

app.get("/", checkAuth, async (req, res) => {
  const userUrls = await user_details.find({ createdBy: req.user._id });
  return res.render("client.ejs", { urls: userUrls, user: req.user })
})

app.get("/login", async (req, res) => {
  // const login = await user_login_details.find({});
  return res.render("login.ejs")
})

app.get("/signup", async (req, res) => {
  return res.render("signup.ejs")
})

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const user = await user_login_details.create({
      name: name,
      email: email,
      password: password,
    });

    return res.render("login.ejs");
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).send("An account with this email already exists.");
    }
    console.error("Signup error:", error);
    return res.status(500).send("Server Error");
  }
})

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await user_login_details.findOne({ email, password })
  if (!user) {
    return res.render("login.ejs");
  }
  const userPayload = {
    _id: user._id.toString(),
    email: user.email,
    name: user.name,
  };

  const token = setUser(userPayload);
  res.cookie("token", token);

  res.redirect("/")
})
// #important##
// we can also don't pass the redirectingurl through the route and pass
// it through the body it will remove the long link with / problem
app.post("/url", restrictToLoggedinUserOnly, async (req, res) => {
  let redirectingUrl = req.body.url;
  if (redirectingUrl === "") {
    return res.status(404).json({ error: "dont leave it blank" })
  } else {
    const shortUrl = shortid.generate(8);
    if (!/^https?:\/\//i.test(redirectingUrl)) {
      redirectingUrl = 'https://' + redirectingUrl;
    }
    const existingUrl = await user_details.findOne({ redirectingUrl: redirectingUrl });
    if (existingUrl) {
      return res.redirect("/");
    }
    const result = await user_details.create({
      shortUrl: shortUrl,
      redirectingUrl: redirectingUrl,
      createdBy: req.user._id,
      analytics_data: [],
    })
    console.log(result);
    const updatedUrls = await user_details.find({ createdBy: req.user._id });
    return res.status(200).render("client", { id: shortUrl, urls: updatedUrls })
  }
})

app.get("/:url", async (req, res) => {
  const shortId = req.params.url;
  const entry = await user_details.findOneAndUpdate(
    { shortUrl: shortId },
    {
      $inc: { totalClicks: 1 },
      $push: {
        analytics_data: { timestamp: Date.now() }
      }
    },
    { new: true }
  );
  if (entry) {
    res.redirect(entry.redirectingUrl);
  } else {
    res.status(404).json({ error: "Wrong shortId" });
  }
})
app.delete("/:id", restrictToLoggedinUserOnly, async (req, res) => {
  const id = req.params.id;

  const deletedRedUrl = await user_details.findByIdAndDelete(id);

  if (!deletedRedUrl) {
    return res.status(500).json({ msg: "Failed to delete" });
  } else {
    return res.status(201).json({ msg: "User deleted", deletedRedUrl });
  }
})
app.get("/analytics/:id", async (req, res) => {
  const shortId = req.params.id;
  const entry = await user_details.findOne(
    { shortUrl: shortId },
  )
  return res.status(200).json({ clicks: entry.totalClicks, details: entry.analytics_data });
})
app.listen(PORT, () => {
  console.log(`The site is running on ${PORT}`)
});
