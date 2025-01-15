const userModel = require("../model/userModel");

const isUser = async (req, res, next) => {
  if (req.session.user || req.user) {
console.log("1")
    const user = req.session.user || req.user;
    const userId = user._id;
    try {
console.log("2")
      // const userId = req.session.user._id;
      const newUser = await userModel.findById(userId);
      if (newUser.isBlocked) {
console.log("3")
        req.flash("error", "Your account has been blocked.");
        req.session.user = null;
        return res.redirect("/landing-page");
      }
      next();
    } catch (error) {
console.log("4")
      console.error("Error fetching user:", error);
      res.redirect("/landing-page");
    }
console.log("5")
    // if(req.session.user==)
  } else {
console.log("6")
    res.redirect("/landing-page");
  }
};
const isnotUser = (req, res, next) => {
  if (!req.session.user) {
console.log("7")
    return next();
  }

  res.redirect("/home");
};

module.exports = { isUser, isnotUser };
