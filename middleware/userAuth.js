const userModel = require("../model/userModel");

const isUser = async (req, res, next) => {
  if (req.session.user || req.user) {
    const user = req.session.user || req.user;
    const userId = user._id;
    try {
      // const userId = req.session.user._id;
      const newUser = await userModel.findById(userId);
      if (newUser.isBlocked) {
        req.flash("error", "Your account has been blocked.");
        req.session.user = null;
        return res.redirect("/landing-page");
      }
      next();
    } catch (error) {
      console.error("Error fetching user:", err);
      res.redirect("/landing-page");
    }

    // if(req.session.user==)
  } else {
    res.redirect("/landing-page");
  }
};
const isnotUser = (req, res, next) => {
  if (!req.session.user) {
    return next();
  }

  res.redirect("/home");
};

module.exports = { isUser, isnotUser };
