const express = require("express");
const userRoute = express.Router();
const session = require("express-session");
userRoute.use(express.urlencoded({ extended: true }));
const userController = require("../controller/userController");
const passport = require("passport");
const authController = require("../config/passportSetup");
const { isUser, isnotUser } = require("../middleware/userAuth");
const { loadAddProduct } = require("../controller/adminController");

userRoute.use(
  session({
    secret: "your_secret",
    resave: false,
    saveUninitialized: true,
  })
);
// userRoute.get("/register",userController.insertUser)

userRoute.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// Route to handle Google callback (after Google login)
userRoute.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  userController.googleAuth
);

userRoute.get("/register", isnotUser, userController.loadRegister);
userRoute.post("/registerUser", userController.registerUser);
userRoute.get("/login", isnotUser, userController.loadLogin);
userRoute.post("/login", userController.loginUser);
userRoute.get("/forgotPassword", userController.loadForgotPassword);
userRoute.post("/forgotPassword", userController.forgotPassword);
userRoute.get("/forgotVerify-otp/:id", userController.loadForgotOtp);
userRoute.get("/forgotResendOtp", userController.forgotResendOtp);
userRoute.get("/changePassword/:id", userController.changePassword);
userRoute.post("/changePass", userController.changePass);
userRoute.post("/forgotVerify-otp", userController.forgotVerifyOtp);
userRoute.get("/verify-otp/:id", userController.loadVerifyOtp);
userRoute.get("/resend-otp", userController.resendOtp);
userRoute.post("/verify-otp", userController.verifyOtp);
// userRoute.post("/resend-otp", userController.resendOtp);
userRoute.get("/home", isUser, userController.loadHome);
userRoute.get("/product", isUser, userController.loadProductList);
userRoute.get(
  "/product-details/:id",
  isUser,
  userController.loadProductDetails
);
userRoute.get("/cart", isUser, userController.loadCart);
userRoute.get("/account", isUser, userController.loadUserAc);
userRoute.get("/accountDetails", isUser, userController.loadaccountDetails);
userRoute.post(
  "/accountDetails/userDetails",
  isUser,
  userController.accountDetails
);
userRoute.post(
  "/accountDetails/updatepassword",
  isUser,
  userController.updatePassword
);
userRoute.get("/userAddress", isUser, userController.loadAddress);
userRoute.post("/userAddress", userController.addAddress);
userRoute.post("/userAddress", userController.editAddress);

userRoute.get("/logout", userController.logout);

module.exports = userRoute;
