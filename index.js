const express = require("express");
const mongoose = require("mongoose");
const shortid = require('shortid');
const path = require("path");

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
  analytics_data: [{
    timestamp: { type: Number }
  }],
}, { timestamps: true })
//model
const user_details = mongoose.model('url_details', url_details)

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


app.set("view engine", "ejs");
app.set('views', path.resolve("./views"));

app.get("/url/frontend", async (req, res) => {
  const allUrls = await user_details.find({});
  return res.render('./home.ejs', {
    Urls: allUrls,
  })
})

app.get("/", async (req, res) => {
  return res.render("client.ejs")
})
// #important##
// we can also don't pass the redirectingurl through the route and pass
// it through the body it will remove the long link with / problem
app.post("/:url", async (req, res) => {
  let redirectingUrl = req.body.url;
  const shortUrl = shortid.generate(8);
  if (!/^https?:\/\//i.test(redirectingUrl)) {
    redirectingUrl = 'https://' + redirectingUrl;
  }
  const result = await user_details.create({
    shortUrl: shortUrl,
    redirectingUrl: redirectingUrl,
    analytics_data: [],
  })
  console.log(result);
  return res.status(200).render("client", { id: shortUrl })
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
app.delete("/:id", async (req, res) => {
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
