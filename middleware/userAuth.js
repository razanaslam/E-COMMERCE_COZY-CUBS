const userModel = require("../model/userModel");

const isUser = async (req, res, next) => {
  if (req.session.user || req.user) {
    // console.log("jkhghkghjghjlkgk", req.session.user, "jhgkhgkjhghj", req.user);
    const userId = req.session.user._id;
    const newUser = await userModel.findById(userId);
    if (newUser.isBlocked) {
      req.flash("error", "Your account has been blocked.");
      req.session.user = null;
      return res.redirect("/login");
    }
    next();
    // if(req.session.user==)
  } else {
    res.redirect("/login");
  }
};
const isnotUser = (req, res, next) => {
  // console.log(req.session);

  if (!req.session.user || !req.user) {
    next();
  } else {
    res.redirect("/home");
  }
};

module.exports = { isUser, isnotUser };
