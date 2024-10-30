const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../model/userModel");
require("dotenv").config();

// Configuring the Google strategy
// console.log(process.env.CLIENT_ID);
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        // console.log(profile);

        // Check if the user already exists in the database
        let user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          return done(null, user); // If user exists, pass the user to Passport
        }

        // If the user doesn't exist, create a new user
        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          isVerified: true,
          googleId: profile.id,
        });
        await user.save();
        return done(null, user); // Pass the newly created user to Passport
      } catch (error) {
        return done(error, null); // Handle any errors
      }
    }
  )
);

// Serializing the user (storing the user's ID in the session)
passport.serializeUser((user, done) => done(null, user.id));

// Deserializing the user (retrieving the user from the session by their ID)
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});
