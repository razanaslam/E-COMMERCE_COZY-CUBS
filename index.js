const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const app = express();
const sharp = require("sharp");
const mongoose = require("mongoose");
const userRoute = require("./route/userRoute");
const adminRoute = require("./route/adminRoute");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
// const userAuth = require("./middleware/userAuth");

mongoose.connect("mongodb+srv://cozycubs12:2dVNjMMal8hmxgaX@cluster0.w26a8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");

// const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();

// app.set("view engine", "ejs");

app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);
const passport = require("passport");
app.use(passport.initialize());
app.use(passport.session());

const nocache = require("nocache");
app.use(nocache());

app.use(flash());
app.use((req, res, next) => {
  res.locals.passMatch = req.flash("passMatch");
  res.locals.emailExist = req.flash("emailExist");
  // res.locals.messages = req.flash();
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: "YOUR_GOOGLE_CLIENT_ID",
//       clientSecret: "YOUR_GOOGLE_CLIENT_SECRET",
//       callbackURL: "https://YOUR_NGROK_URL/auth/google/callback",
//     },
//     (accessToken, refreshToken, profile, done) => {
//       // Here you would save the profile info to your database or session
//       return done(null, profile);
//     }
//   )
// );

// // Serialize and deserialize user
// passport.serializeUser((user, done) => {
//   done(null, user);
// });

// passport.deserializeUser((user, done) => {
//   done(null, user);
// });

// ///////////////////////////////////////////////////////

app.set("view engine", "ejs");
app.set("views", ["./view/user", "./view/admin"]);

// app.set("views", "./view/admin");

app.use("/", userRoute);
app.use("/admin", adminRoute);
app.use("/*", (req, res) => {
  res.render("404");
});
const PORT = process.env.PORT || 3700;
app.listen(PORT, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("server is running....");
  }
});
