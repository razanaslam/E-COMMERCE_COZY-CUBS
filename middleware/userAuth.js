const userModel = require("../model/userModel");

const isUser = async (req, res, next) => {
  if (req.session.user || req.user) {
    // console.log("jkhghkghjghjlkgk", req.session.user, "jhgkhgkjhghj", req.user);
    const userId = req.session.user._id;
    const newUser = await userModel.findById(userId);
    if (newUser.isBlocked) {
      req.flash("error", "Your account has been blocked.");
      req.session.user = null;
      return res.redirect("/landing-page");
    }
    next();
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
