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

userRoute.get("/", (req, res) => {
  res.redirect("/home"); // Redirect to the home route
});

// Define your other routes
userRoute.get("/home", isUser, userController.loadHome);
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
userRoute.post("/userAddress/edit", userController.editAddress);
userRoute.get("/userAddress/delete/:_id", userController.deleteAddress);
userRoute.post("/addToCart", userController.addToCart);
userRoute.post("/cart/incrementQty", userController.incrementQty);
userRoute.post("/cart/decrementQty", userController.decrementQty);
userRoute.post("/cart/delete/:productId", userController.deleteCart);
userRoute.get("/checkout", isUser, userController.loadCheckout);
userRoute.post("/checkout", userController.addCheckoutAddress);
userRoute.post("/checkout/edit", userController.editCheckoutAddress);
userRoute.post("/placeorder", isUser, userController.orderPlaced);
userRoute.get("/order-confirmed", isUser, userController.loadOrderPlaced);
userRoute.get("/myOrders", isUser, userController.loadMyOrders);
userRoute.get(
  "/orderDetails/:orderId",
  isUser,
  userController.loadOrderDetails
);
// userRoute.post("/updateOrderStatus/:orderId", userController.orderList);
userRoute.post("/updateOrderStatus/:id", userController.cancelOrder);
userRoute.get("/logout", userController.logout);
userRoute.post("/sort-products", userController.sortProducts);

// userRoute.get("/loadShopPage", userController.loadProductList);

userRoute.get("/whishlist", isUser, userController.loadWishlist);
userRoute.get("/addToWhishlist", isUser, userController.addToWhishlist);
userRoute.get(
  "/whishlist/delete/:productId",
  userController.removeFromWhishlist
);

userRoute.get("/getcoupon", isUser, userController.getCoupon);
userRoute.get("/applycoupon", userController.applyCoupon);
userRoute.post("/cancelcoupon", userController.cancelCoupon);
// userRoute.get("/search", isUser, userController.searchItems);
userRoute.get("/wallet", isUser, userController.loadWallet);
///razor pay asdfsda
userRoute.post("/create-order", userController.createOrder);
userRoute.post("/verify-payment", userController.verifyPayment);
// userRoute.post("/paymentSuccessfull", userController.paymentSuccess);

module.exports = userRoute;
