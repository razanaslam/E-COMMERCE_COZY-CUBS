// const User = require("../model/userModel");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const otpModel = require("../model/otp-model");
const { log } = require("console");
const { CLIENT_RENEG_LIMIT } = require("tls");
const userModel = require("../model/userModel");
const productModel = require("../model/product");
const addressModel = require("../model/address");
const cartModel = require("../model/cart");
// const product = require("../model/product");
const orderModel = require("../model/order");
const catagory = require("../model/catagory");
const couponModel = require("../model/coupon");
const whishlistModel = require("../model/whishlist");
const walletModel = require("../model/wallet");
const transactionModel = require("../model/transaction");
const offerModel = require("../model/offer");
const Razorpay = require("razorpay");
const order = require("../model/order");
const addresses = require("../model/address");
const { NOTFOUND } = require("dns");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const coupon = require("../model/coupon");
require("dotenv").config();
const generateOtp = () => {
  const otp = Math.floor(100000 + Math.random() * 900000);

  return { otp };
};

//------------------------------------------------------------Registration of User-------------------------------------------------------

const loadRegister = async (req, res) => {
  try {
    if (req.session.user) {
      res.redirect("/home");
    } else {
      const errorEmail = req.flash("errorEmail");
      const errorPassword = req.flash("errorPassword");

      res.render("register", { errorEmail, errorPassword });
    }
  } catch (error) {
    console.log(error);
  }
};

const registerUser = async (req, res) => {
  const { name, email, number, password, confirmPassword, referal } = req.body;
  console.log("req.body in register user controller =>>>", req.body);
  try {
    const existUser = await userModel.findOne({ email });
    if (referal) {
      const refUser = await userModel.findOne({ referalCode: referal });
      if (!refUser) {
        req.flash("referalError", "Please enter a valid referral code");
        return res.redirect("/register");
      }
    }

    if (existUser) {
      req.flash("errorEmail", "User  already exists");
      return res.redirect("/register");
    } else {
      if (password !== confirmPassword) {
        req.flash("errorPassword", "Passwords do not match");
        return res.redirect("/register");
      }

      const secPass = await bcrypt.hash(password, 10);
      const newUser = {
        name,
        email,
        number,
        password: secPass,
        referalCode: referal, // Store the referral code in the session
      };
      req.session.user = newUser;

      const { otp } = generateOtp();
      const emailSent = await sendOtp(email, otp);
      const expirationTime = Date.now() + 60 * 1000;
      const newOtpModel = new otpModel({
        email,
        otpExpiredAt: expirationTime,
        otp,
      });
      await newOtpModel.save();

      if (!emailSent) {
        req.flash("otpError", "Failed to send OTP, please try again.");
        return res.redirect("/register");
      }

      res.redirect(`/verify-otp/${newOtpModel._id}`);
    }
  } catch (error) {
    console.log(error);
    req.flash(
      "error",
      "An error occurred during registration. Please try again."
    );
    res.redirect("/register");
  }
};

//------------------------------------------------------------OTP-------------------------------------------------------

const sendOtp = async (toEmail, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    transporter.verify(function (error, success) {
      if (error) {
        console.error("Error connecting to SMTP server:", error);
      } else {
        console.log("SMTP server is ready to send emails");
      }
    });
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: toEmail,
      subject: "Verify Your Email - OTP",
      text: `Your OTP code is ${otp}.`,
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.log("Error sending email:", error);
    return false;
  }
};

const loadVerifyOtp = async (req, res) => {
  try {
    // const errorOtp = req.flash("errorOtp");
    // // const otpExpiration = req.session.otpExpiration;
    // if (!otpExpiration) {
    //   req.flash(
    //     "otpError",
    //     "OTP expired or not found. Please request a new one."
    //   );

    const id = req.params.id;
    const otpRecord = await otpModel.findById(id);

    ///////////////////////////////////////////////////''
    const invalidOtp = req.flash("invalidOtp");
    res.render("verify-otp", {
      id,
      otpExpiredAt: otpRecord.otpExpiredAt,
      invalidOtp,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp, id } = req.body;
    const currentOtpTime = Date.now();

    // Find the OTP document by ID
    const isOtp = await otpModel.findById(id);
    if (!isOtp) {
      req.flash("error", "Invalid OTP request.");
      return res.redirect(`/verify-otp/${id}`);
    }

    // Check if the OTP has expired
    if (isOtp.otpExpiredAt < currentOtpTime) {
      req.flash("error", "OTP has expired. Please request a new OTP.");
      return res.redirect(`/verify-otp/${id}`);
    }

    // Check if the OTP is valid
    if (isOtp.otp !== otp) {
      req.flash("invalidOtp", "Invalid OTP. Please try again.");
      return res.redirect(`/verify-otp/${id}`);
    }

    // OTP is valid and not expired, proceed with user registration
    const { name, email, number, password, referalCode } = req.session.user;

    // Handle referral code bonus
    if (referalCode) {
      const refUser = await userModel.findOne({ referalCode });

      if (refUser) {
        const refWallet = await walletModel.findOne({ userId: refUser._id });
        console.log(refWallet, "refwallt");

        refWallet.balance += 300; // Add referral bonus
        await refWallet.save(); // Save the updated wallet
        const transaction = new transactionModel({
          userId: refUser._id,
          amount: 300,
          status: "Success",
          type: "Credit",
          date: new Date(),
        });
        await transaction.save(); // Save the transaction
      }
    }

    // Create new user
    const newUser = new userModel({
      name,
      email,
      number,
      password,
    });
    await newUser.save(); // Save the new user

    // Create a wallet for the new user
    const wallet = new walletModel({
      userId: newUser._id,
      balance: 0,
    });

    // If the user was referred, add a bonus to their wallet
    if (referalCode) {
      wallet.balance += 100; // Add bonus for the new user
      const newTransaction = new transactionModel({
        userId: newUser._id,
        amount: 100,
        status: "Success",
        type: "Credit",
        date: new Date(),
      });

      await newTransaction.save(); // Save the transaction
    }

    await wallet.save(); // Save the wallet

    // Clear the session data
    req.session.user = null;
    await otpModel.findByIdAndDelete(id); // Delete the OTP document

    // Redirect to login page after successful registration
    req.flash("success", "OTP verified successfully! You can now log in.");
    res.redirect("/login");
  } catch (error) {
    console.error("Error verifying OTP:", error);
    req.flash(
      "error",
      "An error occurred while verifying the OTP. Please try again."
    );
    res.redirect(`/verify-otp/${id}`);
  }
};

const resendOtp = async (req, res) => {
  const user = req.session.user;
  try {
    const { otp } = generateOtp();
    const emailSent = await sendOtp(user.email, otp);

    if (!emailSent) {
      req.flash("errorOtp", "Failed to resend OTP, please try again.");
      return res.redirect("/verify-otp");
    }

    const expirationTime = Date.now() + 60 * 1000;
    const resendOtp = await otpModel.findOne({ email: user.email });
    resendOtp.otpExpiredAt = expirationTime;
    resendOtp.otp = otp;
    resendOtp.createdAt = Date.now();
    await resendOtp.save();

    req.flash("successOtp", "OTP resent successfully.");
    res.redirect(`/verify-otp/${resendOtp._id}`);
  } catch (error) {
    console.log(error);
    req.flash("otpError", "Something went wrong, please try again.");
    res.redirect(`/verify-otp/${resendOtp._id}`);
  }
};

//------------------------------------------------------------login-------------------------------------------------------

const loadLogin = (req, res) => {
  try {
    if (!req.session.user) {
      const loginError = req.flash("loginError");
      const blocked = req.flash("blocked");
      const googelError = req.flash("googelError");
      res.render("login", { loginError, blocked, googelError });
    } else {
      res.redirect("/home");
    }
  } catch (error) {
    console.log(error);
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      req.flash("loginError", "Invalid email ");
      return res.redirect("/login");
    }
    if (user.googleId) {
      req.flash("googleError", "It is a Google authenticated user.");
      return res.redirect("/login");
    }

    if (user.isBlocked) {
      req.flash("blocked", "blocked, contact for help");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.flash("loginError", "Invalid password.");
      return res.redirect("/login");
    }

    req.session.user = { _id: user._id };
    res.redirect("/home");
  } catch (error) {
    console.log("Error during login:", error);
    req.flash("loginError", "Something went wrong, please try again.");
    res.redirect("/login");
  }
};

//------------------------------------------------------------google Authentication-------------------------------------------------------

const googleAuth = (req, res) => {
  if (req.user) {
    const useremail = req.user.email;

    // console.log(useremail);

    req.session.user = { email: req.user.email, _id: req.user._id };
    // console.log("User session created:", req.session.user);
    return res.redirect("/home");
  } else {
    return res.redirect("/login");
  }
};

//------------------------------------------------------------home------------------------------------------------------------------

const loadHome = async (req, res) => {
  try {
    const products = await productModel

      .find()
      .populate("category", "name")
      .populate("brand", "name")
      .populate("bestOffer");

    const newArrivals = await productModel
      .find()
      .sort({ createdAt: -1 })
      .limit(3)
      .populate("category", "name")
      .populate("brand", "name");

    const categories = await catagory.find();

    res.render("home", { products, categories, newArrivals });
  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while loading the home page.");
  }
};

//------------------------------------------------------------forgot password-------------------------------------------------------

const loadForgotPassword = async (req, res) => {
  try {
    const forgotterror = req.flash("forgotterror");
    const forgotterror2 = req.flash("forgotterror2");
    res.render("forgotPassword", { forgotterror, forgotterror2 });
  } catch (error) {
    console.log(error);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const forgotPass = await userModel.findOne({ email });
    if (!forgotPass) {
      req.flash("forgotterror", "User is not found,Please try again");
      res.redirect("/forgotPassword");
    } else {
      const { otp } = generateOtp();
      const emailSent = await sendOtp(email, otp);
      const otpExpiredAt = Date.now() + 60 * 1000;

      const newOtpModel = new otpModel({
        email,
        otpExpiredAt,
        otp,
      });
      await newOtpModel.save();
      req.session.user = forgotPass;
      if (!emailSent) {
        req.flash("forgotterror2", "Failed to send OTP, please try again.");
        return res.redirect("/forgotPassword");
      }
      res.redirect(`/forgotVerify-otp/${newOtpModel._id}`);
    }
  } catch (error) {
    console.log(error);
  }
};

const loadForgotOtp = async (req, res) => {
  try {
    const id = req.params.id;
    const otpRecord = await otpModel.findById(id);
    const invalidOtp = req.flash("invalidOtp");
    res.render("forgotVerify-otp", {
      id,
      otpExpiredAt: otpRecord.otpExpiredAt,

      invalidOtp,
    });
    // console.log(otpExpiredAt, "kjgjkgkj");
  } catch (error) {
    console.log(error);
  }
};

const forgotVerifyOtp = async (req, res) => {
  try {
    const { otp, id } = req.body;
    const currentOtpTime = Date.now();
    const isOtp = await otpModel.findById(id);
    const user = await userModel.findOne({ email: isOtp.email });
    // console.log(req.body);
    // console.log(isOtp);

    if (!isOtp) {
      // console.log("11");

      return res.redirect(`/forgotVerify-otp/${id}`);
    }
    if (isOtp.otp === otp) {
      if (isOtp.otpExpiredAt < currentOtpTime) {
        return res.redirect(`/forgotVerify-otp/${id}`);
      } else {
        await otpModel.findByIdAndDelete(id);
        console.log("to change password");
        return res.redirect(`/changePassword/${user._id}`);
        // req.session.user = null;

        // await otpModel.findByIdAndDelete(id);
      }
    } else {
      console.log("11");
      req.flash("invalidOtp", "invalid otp");

      res.redirect(`/forgotVerify-otp/${id}`);
    }
    req.session.user = null;
  } catch (error) {
    req.flash("invalidOtp", "invalid otp");
    console.log(error);
  }
};

const forgotResendOtp = async (req, res) => {
  const user = req.session.user;
  console.log(user, "gfghjkllllllllllllllll");

  try {
    const { otp } = generateOtp();
    const emailSent = await sendOtp(user.email, otp);
    console.log(req.session.user);

    if (!emailSent) {
      req.flash("errorOtp", "Failed to resend OTP, please try again.");
      return res.redirect("/forgotVerify-otp");
      ``;
    }

    const expirationTime = Date.now() + 60 * 1000;
    const forgotResendOtp = await otpModel.findOne({ email: user.email });
    console.log(user.email, "dhgkjfjbj");
    console.log(expirationTime);

    forgotResendOtp.otpExpiredAt = expirationTime;
    forgotResendOtp.otp = otp;
    forgotResendOtp.createdAt = Date.now();
    await forgotResendOtp.save();

    req.flash("successOtp", "OTP resent successfully.");
    res.redirect(`/forgotVerify-otp/${forgotResendOtp._id}`);
  } catch (error) {
    console.log(error);
    req.flash("otpError", "Something went wrong, please try again.");
    res.redirect(`/forgotVerify-otp/${forgotResendOtp._id}`);
  }
};

const changePassword = async (req, res) => {
  try {
    const id = req.params.id;
    const otpRecord = await otpModel.findById(id);

    res.render("changePassword", {
      id,
    });
  } catch (error) {
    console.log(error);
  }
};

const changePass = async (req, res) => {
  try {
    // const id = req.params.id;
    const { password, confirmPassword, id } = req.body;
    if (password !== confirmPassword) {
      req.flash("errorPassword", " Passwords do not match");
      console.log("password is already existed");
      return res.redirect(`/changePassword/${id}`);
    } else {
      const secPass = await bcrypt.hash(password, 10);
      await userModel.findByIdAndUpdate(id, {
        password: secPass,
      });
      req.session.user = null;
      await otpModel.findByIdAndDelete(id);
      return res.redirect("/login");
    }
  } catch (error) {
    console.log(error);
  }
};

//------------------------------------------------------------product List-------------------------------------------------------

// const loadProductList = async (req, res) => {
//   try {
//     const currentDate = new Date();
//     const { categories, query, page = 1, limit = 3 } = req.query;
//     let filterQuery = {};

//     if (categories) {
//       filterQuery.category = {
//         $in: Array.isArray(categories) ? categories : [categories],
//       };
//     }

//     if (query) {
//       filterQuery.$or = [
//         { product_title: { $regex: query, $options: "i" } },
//         { category: { $in: categories ? categories : [] } },
//       ];
//     }

//     const skip = (page - 1) * limit;
//     const totalProducts = await productModel.countDocuments(filterQuery);
//     const totalPages = Math.ceil(totalProducts / limit);

//     const products = await productModel
//       .find(filterQuery)
//       .skip(skip)
//       .limit(parseInt(limit))
//       .populate("bestOffer")
//       .populate("category")
//       .populate("brand");

//     for (const product of products) {
//       if (product.bestOffer) {
//         const { endDate } = product.bestOffer;

//         if (new Date(endDate) < currentDate) {
//           product.bestOffer = null;
//           product.discountedPrice = null;
//           await product.save();

//           await cartModel.updateMany(
//             { "items.productId": product._id },
//             { $pull: { items: { productId: product._id } } }
//           );
//         }
//       } else {
//         product.discountedPrice = null;
//         await product.save();
//       }
//     }

//     const categoriesList = await catagory.find();

//     res.render("productList", {
//       product: products,
//       categories: categoriesList,
//       selectedCategories: Array.isArray(categories) ? categories : [categories],
//       searchQuery: query || "",
//       currentPage: parseInt(page),
//       totalPages,
//       limit: parseInt(limit),
//     });
//   } catch (error) {
//     console.error("Error loading product list:", error);
//     res.status(500).send("An error occurred while loading the product list.");
//   }
// };

// const sortProducts = async (req, res) => {
//   const { sortType } = req.body;

//   try {
//     let sortCriteria;

//     switch (sortType) {
//       case "a-z":
//         // Sort by title (case-insensitive)
//         sortCriteria = { $sort: { product_title_lower: 1 } };
//         break;
//       case "z-a":
//         // Sort by title in reverse order (case-insensitive)
//         sortCriteria = { $sort: { product_title_lower: -1 } };
//         break;
//       case "low-to-high":
//         // Sort by discounted price if exists, else by regular price
//         sortCriteria = { $sort: { final_price: 1 } };
//         break;
//       case "high-to-low":
//         // Sort by discounted price if exists, else by regular price (descending)
//         sortCriteria = { $sort: { final_price: -1 } };
//         break;
//       default:
//         // Default: No specific sorting
//         sortCriteria = { $sort: { _id: 1 } }; // Default to sorting by _id
//     }

//     const sortedProducts = await productModel.aggregate([
//       // Add a new field 'final_price' to consider discounted price
//       {
//         $addFields: {
//           final_price: {
//             $cond: {
//               if: { $ifNull: ["$discountedPrice", false] },
//               then: "$discountedPrice",
//               else: "$price",
//             },
//           },
//         },
//       },
//       // Add a lowercase version of the product title for case-insensitive sorting
//       {
//         $addFields: {
//           product_title_lower: { $toLower: "$product_title" },
//         },
//       },
//       sortCriteria, // Apply the sorting based on the selected type
//       {
//         $project: {
//           product_title_lower: 0, // Exclude the temporary field from the output
//         },
//       },
//     ]);

//     res.json({ sortedProducts });
//   } catch (error) {
//     console.error("Error sorting products:", error);
//     res.status(500).send("Error sorting products");
//   }
// };
const loadProductList = async (req, res) => {
  try {
    const currentDate = new Date();
    const { categories, query, page = 1, limit = 10, sortType } = req.query;
    let filterQuery = {};

    // Step 1: Apply Category Filtering (if provided)
    if (categories) {
      filterQuery.category = {
        $in: Array.isArray(categories) ? categories : [categories],
      };
    }

    // Step 2: Apply Search Filtering (only within selected categories)
    if (query) {
      filterQuery.product_title = { $regex: query, $options: "i" };
    }

    // Step 3: Apply Sorting Logic (only on filtered + searched results)
    let sortCriteria = {};
    switch (sortType) {
      case "a-z":
        sortCriteria.product_title = 1;
        break;
      case "z-a":
        sortCriteria.product_title = -1;
        break;
      case "low-to-high":
        sortCriteria.price = 1;
        break;
      case "high-to-low":
        sortCriteria.price = -1;
        break;
      default:
        sortCriteria._id = 1; // Default sorting
    }
    // Pagination Logic
    const skip = (page - 1) * limit;
    const totalProducts = await productModel.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    // Step 4: Fetch Products with Filtering, Searching, Sorting & Pagination
    let products = await productModel
      .find(filterQuery)
      .collation({ locale: "en", strength: 2 }) // 🔥 Ensures case-insensitive sorting
      .sort(sortCriteria) // ✅ Sorting now works correctly
      .skip(skip)
      .limit(parseInt(limit))
      .populate("bestOffer")
      .populate("category")
      .populate("brand");
    // Handling expired offers
    for (const product of products) {
      if (product.bestOffer) {
        const { endDate } = product.bestOffer;
        if (new Date(endDate) < currentDate) {
          product.bestOffer = null;
          product.discountedPrice = null;
          await product.save();

          // Remove expired offers from cart
          await cartModel.updateMany(
            { "items.productId": product._id },
            { $pull: { items: { productId: product._id } } }
          );
        }
      } else {
        product.discountedPrice = null;
        await product.save();
      }
    }

    // Fetch Categories for UI Filter
    const categoriesList = await catagory.find();

    // Render Response
    res.render("productList", {
      product: products,
      categories: categoriesList,
      selectedCategories: Array.isArray(categories) ? categories : [categories],
      searchQuery: query || "",
      currentPage: parseInt(page),
      totalPages,
      limit: parseInt(limit),
      sortType: sortType || "default",
    });
  } catch (error) {
    console.error("Error loading product list:", error);
    res.status(500).send("An error occurred while loading the product list.");
  }
};

//------------------------------------------------------------product Details-------------------------------------------------------

const loadProductDetails = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render("404"); // Render 404 page for invalid ObjectId
    }
    const product = await productModel
      .findById(id)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("bestOffer");
    if (!product) {
      // If product is not found, render the 404 page
      return res.status(404).render("404");
    }
    const cartFail = req.flash("cartFail");
    const msg = req.flash("msg");

    res.render("product_details", { product, cartFail, msg });
  } catch (error) {
    // return res.status(404).render("404");
    console.log(error);
  }
};

//------------------------------------------------------------cart Details-------------------------------------------------------

const loadCart = async (req, res) => {
  try {
    const id = req.session.user._id;
    const cartEmpty = req.flash("cartEmpty");
    const cart = await cartModel
      .findOne({ userId: id })
      .populate("items.product");

    const coupons = await couponModel.find();
    const cartItems = cart ? cart.items : [];
    if (cart) {
      cart.couponApplied = false;
    }
    // cart.save();

    const totalPrice = cart ? cart.totalPrice : [];
    const discount = cart ? cart.discount : [];
    let stockAdjusted = false;
    const adjustmentMessages = [];

    if (cart && cartItems.length > 0) {
      for (const item of cartItems) {
        if (item.product.stock === 0) {
          stockAdjusted = true;

          adjustmentMessages.push(
            `The product "${item.product.name}" is out of stock and has been removed from your cart.`
          );
          cart.totalPrice = 0;
          cart.items = cart.items.filter(
            (cartItem) => cartItem._id.toString() !== item._id.toString()
          );
        } else if (item.qty > item.product.stock) {
          stockAdjusted = true;
          adjustmentMessages.push(
            `The quantity of "${item.product.name}" was adjusted to match available stock.`
          );

          const difference = item.qty - item.product.stock;
          item.qty = item.product.stock;
          cart.totalPrice -= difference * item.price;
        }
      }

      if (stockAdjusted) {
        await cart.save();
      }
    }

    res.render("cart", {
      cart,
      cartItems,
      cartEmpty,
      coupons,
      discount,
      totalPrice,
      adjustmentMessages,
    });
  } catch (error) {
    console.log(error);
  }
};

const addToCart = async (req, res) => {
  try {
    const productId = req.query.id;
    const userId = req.session.user._id;

    // Find the product
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Determine the price (discounted or regular)
    const price = product.discountedPrice || product.price;

    // Find or create the user's cart
    let cart = await cartModel.findOne({ userId });
    if (!cart) {
      cart = new cartModel({
        userId,
        items: [{ product: productId, price, qty: 1 }],
        totalPrice: price,
      });
    } else {
      // Check if the product is already in the cart
      const existingProduct = cart.items.find(
        (item) => item.product.toString() === productId
      );
      if (existingProduct) {
        return res.status(409).json({ message: "Product already in cart" });
      }

      // Add the new product to the cart
      cart.items.push({ product: productId, price, qty: 1 });
      cart.totalPrice += price;
    }

    // Save the cart
    await cart.save();

    // Respond with success
    res.status(200).json({ message: "Product added to cart" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred" });
  }
};

const incrementQty = async (req, res) => {
  const { productId } = req.body;

  try {
    const cart = await cartModel.findOne({ userId: req.session.user._id });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.find((i) => i.product.toString() === productId);

    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    const product = await productModel.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    console.log(product.stock, "stock of pp");

    if (item.qty >= product.stock) {
      item.qty = product.stock;
      await cart.save();
      return res.status(400).json({
        message:
          "Quantity exceeds available stock. Adjusted to available stock.",
        newQty: item.qty,
        newTotal: cart.totalPrice,
      });
    }
    console.log(cart);

    if (item.qty === 5) {
      return res.status(400).json({ message: "Limit of 5 units reached" });
    }

    item.qty += 1;
    cart.totalPrice += item.price;
    await cart.save();

    return res.json({ newQty: item.qty, newTotal: cart.totalPrice });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error updating quantity" });
  }
};

const decrementQty = async (req, res) => {
  const { productId } = req.body;

  try {
    const cart = await cartModel.findOne({ userId: req.session.user._id });
    const item = cart.items.find((i) => i.product.toString() === productId);

    if (item && item.qty > 1) {
      item.qty -= 1;
      cart.totalPrice -= item.price;
      await cart.save();
      res.json({ newQty: item.qty, newTotal: item.price * item.qty });
    } else {
      res
        .status(404)
        .json({ message: "Item not found or quantity cannot be less than 1" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating quantity" });
  }
};

const deleteCart = async (req, res) => {
  const userId = req.session.user._id;
  const productId = req.params.productId;

  try {
    const cart = await cartModel.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    cart.items.splice(itemIndex, 1);

    cartModel.totalPrice = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    await cart.save();

    res.redirect("/cart");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error removing product from cart" });
  }
};

//------------------------------------------------------------checkOut----------------------------------------------------------------------

const loadCheckout = async (req, res) => {
  try {
    const id = req.session.user._id;
    const cart = await cartModel
      .findOne({ userId: id })
      .populate("items.product");
    const address = await addressModel.find({ userId: id });
    const wallet = await walletModel.findOne({ userId: id });
    const walletbalance = wallet.balance ? wallet.balance : 0;

    console.log(walletbalance, "walletbalance");

    if (!cart || cart.items.length === 0) {
      req.flash("cartEmpty", "Your cart is empty");
      return res.redirect("/cart");
    }

    const cartItems = cart.items;
    const deliveryCharge = cart.items.price - 50;
    const totalPrice = cart.totalPrice;
    const cartEmpty = req.flash("cartEmpty");
    const addressSuccess = req.flash("addressSuccess");
    const messages = [];

    res.render("checkout", {
      cart,
      couponName: cart?.couponName || null,
      address,
      cartItems,
      totalPrice,
      cartEmpty,
      addressSuccess,
      messages,
      deliveryCharge,
      walletbalance,
      razorpayKey: "rzp_test_VBZkWRTmp72VJq",
    });
  } catch (error) {
    console.log(error);
  }
};

const addCheckoutAddress = async (req, res) => {
  try {
    const id = req.session.user._id;
    const { fullName, email, number, country, postalCode, state, city } =
      req.body;
    let userAddress = await addressModel.findOne({ userId: id });

    if (!userAddress) {
      userAddress = new addressModel({
        userId: id,
        addressDetails: [
          { fullName, email, number, country, postalCode, state, city },
        ],
      });
    } else {
      userAddress.addressDetails.push({
        fullName,
        email,
        number,
        country,
        postalCode,
        state,
        city,
      });
    }

    await userAddress.save();
    req.flash("success", "Address added successfully");
    return res.status(200).redirect("/checkout");
  } catch (error) {
    console.error("Error adding address:", error);
    req.flash("error", "Failed to add address. Please try again.");
    return res.status(500).redirect("/checkout");
  }
};

const editCheckoutAddress = async (req, res) => {
  try {
    const { fullName, email, number, country, postalCode, state, city, id } =
      req.body;

    await addressModel.updateOne(
      { "addressDetails._id": id },
      {
        $set: {
          "addressDetails.$.fullName": fullName,
          "addressDetails.$.email": email,
          "addressDetails.$.number": number,
          "addressDetails.$.country": country,
          "addressDetails.$.postalCode": postalCode,
          "addressDetails.$.state": state,
          "addressDetails.$.city": city,
        },
      }
    );

    req.flash("addressSuccess", "Address updated successfully");
    res.redirect("/checkout");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const loadOrderPlaced = async (req, res) => {
  try {
    const id = req.params.id;
    const order = orderModel.findById(id);
    res.render("orderPlaced", { order });
  } catch (error) {
    console.log(error);
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updatedOrder = await orderModel.findByIdAndUpdate(orderId);

    if (!updatedOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (updatedOrder.status === "Delivered") {
      updatedOrder.status = "Returned";
      for (item of updatedOrder.items) {
        item.itemStatus = "Returned";
      }
    } else {
      updatedOrder.status = "Cancelled";
      for (item of updatedOrder.items) {
        item.itemStatus = "Cancelled";
      }
    }

    await updatedOrder.save();
    const userId = updatedOrder.userId;

    const totalRefundAmount = updatedOrder.totalPrice;
    for (const item of updatedOrder.items) {
      await productModel.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    const userWallet = await walletModel.findOne({ userId });

    if (!userWallet) {
      return res
        .status(404)
        .json({ success: false, message: "User's wallet not found" });
    }
    let transaction = {};
    if (updatedOrder.paymentMethod !== "COD") {
      userWallet.balance += totalRefundAmount;
      await userWallet.save();

      transaction = new transactionModel({
        userId,
        amount: totalRefundAmount,
        status: "Success",
        type: "Credit",
        date: new Date(),
      });

      await transaction.save();
    }

    res.json({
      success: true,
      message: "Order cancelled successfully, payment refunded to wallet",
      order: updatedOrder,
      refundedAmount: totalRefundAmount,
      newWalletBalance: userWallet.balance,
      transaction,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "An error occurred while cancelling the order",
    });
  }
};
const returnItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await orderModel.findById(orderId).populate("offerApplied");
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    item.itemStatus = "Returned";

    const totalBeforeDiscount = order.items.reduce(
      (sum, i) => sum + i.finalPrice * i.quantity,
      0
    );

    let refundAmount = item.finalPrice * item.quantity;

    if (order.offerApplied) {
      const totalDiscount = order.discountApplied;
      const itemDiscountShare =
        ((item.finalPrice * item.quantity) / totalBeforeDiscount) *
        totalDiscount;
      refundAmount -= itemDiscountShare;
    }

    let remainingAmount = order.totalPrice + order.couponPrice - refundAmount;

    const allItemsCancelled = order.items.every(
      (item) => item.itemStatus === "Cancelled"
    );
    const allItemsReturned = order.items.every(
      (item) => item.itemStatus === "Returned"
    );

    if (allItemsCancelled || allItemsReturned) {
      order.totalPrice = 0;
      order.couponPrice = 0;
      order.discountApplied = 0;
    } else if (remainingAmount <= 0.01) {
      // Added threshold for floating-point errors
      order.totalPrice = 0;
      order.couponPrice = 0;
      order.discountApplied = 0;
    } else if (order.offerApplied) {
      const coupon = order.offerApplied;
      const newDiscountAmount = Math.min(
        (remainingAmount * coupon.discountPercentage) / 100,
        coupon.maxDiscountAmount
      );
      order.couponPrice = newDiscountAmount;
      order.discountApplied = newDiscountAmount;
      order.totalPrice = remainingAmount - newDiscountAmount;
    } else {
      order.totalPrice = remainingAmount;
      order.couponPrice = 0;
      order.discountApplied = 0;
    }

    await order.save();

    await productModel.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity },
    });

    let walletBalance;
    if (["razorpay", "wallet"].includes(order.paymentMethod)) {
      const userWallet = await walletModel.findOneAndUpdate(
        { userId: order.userId },
        { $inc: { balance: refundAmount } },
        { new: true }
      );
      walletBalance = userWallet.balance;
      await new transactionModel({
        userId: order.userId,
        amount: refundAmount,
        status: "Success",
        type: "Credit",
        date: new Date(),
      }).save();
    }

    if (allItemsCancelled || allItemsReturned) {
      order.status = allItemsCancelled ? "Cancelled" : "Returned";
      order.updatedAt = new Date();
      await order.save();
    }

    res.json({
      success: true,
      message: "Item cancelled and refunded successfully",
      updatedOrder: order,
      walletBalance: walletBalance || 0,
    });
  } catch (error) {
    console.error("Error returning item:", error);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred" });
  }
};

// const cancelItem = async (req, res) => {
//   try {
//     const { orderId, itemId } = req.params;
//     const order = await orderModel.findById(orderId).populate("offerApplied");
//     if (!order)
//       return res
//         .status(404)
//         .json({ success: false, message: "Order not found" });

//     const item = order.items.id(itemId);
//     if (!item)
//       return res
//         .status(404)
//         .json({ success: false, message: "Item not found" });

//     item.itemStatus = "Cancelled";
//     let refundAmount = item.finalPrice;
//     let remainingAmount = order.totalPrice + order.couponPrice - refundAmount;

//     if (remainingAmount <= 0) {
//       order.totalPrice = 0;
//       order.couponPrice = 0;
//       order.discountApplied = 0;
//     } else if (order.offerApplied) {
//       const coupon = order.offerApplied;
//       const discountAmount = Math.min(
//         (remainingAmount * coupon.discountPercentage) / 100,
//         coupon.maxDiscountAmount
//       );
//       order.couponPrice = discountAmount;
//       order.discountApplied = discountAmount;
//       order.totalPrice = remainingAmount - discountAmount;
//     } else {
//       order.totalPrice = remainingAmount;
//       order.couponPrice = 0;
//       order.discountApplied = 0;
//     }

//     await order.save();
//     await productModel.findByIdAndUpdate(item.product, {
//       $inc: { stock: item.quantity },
//     });

//     if (["razorpay", "wallet"].includes(order.paymentMethod)) {
//       const userWallet = await walletModel.findOneAndUpdate(
//         { userId: order.userId },
//         { $inc: { balance: refundAmount } },
//         { new: true }
//       );
//       await new transactionModel({
//         userId: order.userId,
//         amount: refundAmount,
//         status: "Success",
//         type: "Credit",
//         date: new Date(),
//       }).save();
//       res.json({
//         success: true,
//         message: "Item cancelled and refunded successfully",
//         updatedOrder: order,
//         walletBalance: userWallet.balance,
//       });
//     }
//     const allItemsDelivered = order.items.every(
//       (item) => item.itemStatus === "Delivered"
//     );
//     if (allItemsDelivered) {
//       await orderModel.findByIdAndUpdate(
//         orderId,
//         { $set: { status: "Delivered" } },
//         { new: true }
//       );
//     }
//     const allItemsReturned = order.items.every(
//       (item) => item.itemStatus === "Returned"
//     );
//     const allItemsCancelled = order.items.every(
//       (item) => item.itemStatus === "Cancelled"
//     );

//     if (allItemsReturned || allItemsCancelled) {
//       order.status = allItemsReturned ? "Returned" : "Cancelled";
//       order.updatedAt = new Date();
//       await order.save();
//     }
//   } catch (error) {
//     console.error("Error cancelling item:", error);
//     return res
//       .status(500)
//       .json({ success: false, message: "An error occurred" });
//   }
// };

const cancelItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const order = await orderModel.findById(orderId).populate("offerApplied");
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const item = order.items.id(itemId);
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });

    item.itemStatus = "Cancelled";

    // Check if all items are cancelled first
    const allItemsCancelled = order.items.every(
      (item) => item.itemStatus === "Cancelled"
    );
    const allItemsReturned = order.items.every(
      (item) => item.itemStatus === "Returned"
    );

    let refundAmount = 0;
    if (!allItemsCancelled && !allItemsReturned) {
      // Only calculate refund and adjust totals if not all items are cancelled/returned
      const totalBeforeDiscount = order.items.reduce(
        (sum, i) => sum + i.finalPrice * i.quantity,
        0
      );
      console.log(totalBeforeDiscount, "totalBeforeDiscount");

      refundAmount = item.finalPrice * item.quantity;
      console.log(refundAmount, "refundAmount");

      if (order.offerApplied) {
        const totalDiscount = order.discountApplied;
        const itemDiscountShare =
          ((item.finalPrice * item.quantity) / totalBeforeDiscount) *
          totalDiscount;
        refundAmount -= itemDiscountShare;
        console.log(itemDiscountShare, "itemDiscountShare");
      }

      let remainingAmount = order.totalPrice + order.couponPrice - refundAmount;
      console.log(remainingAmount, "remainingAmount");

      if (remainingAmount <= 0.01) {
        // Added threshold for floating-point errors
        order.totalPrice = 0;
        order.couponPrice = 0;
        order.discountApplied = 0;
      } else if (order.offerApplied) {
        const coupon = order.offerApplied;
        const newDiscountAmount = Math.min(
          (remainingAmount * coupon.discountPercentage) / 100,
          coupon.maxDiscountAmount
        );
        order.couponPrice = newDiscountAmount;
        order.discountApplied = newDiscountAmount;
        order.totalPrice = remainingAmount - newDiscountAmount;
      } else {
        order.totalPrice = remainingAmount;
        order.couponPrice = 0;
        order.discountApplied = 0;
      }
    } else {
      // If all items are cancelled or returned, reset totals
      order.totalPrice = 0;
      order.couponPrice = 0;
      order.discountApplied = 0;
      refundAmount = item.finalPrice * item.quantity; // Still refund the item's base amount
      if (allItemsCancelled) order.status = "Cancelled";
      else if (allItemsReturned) order.status = "Returned";
      order.updatedAt = new Date();
    }

    await order.save();

    // Restore stock based on the quantity of the cancelled item
    await productModel.findByIdAndUpdate(item.product, {
      $inc: { stock: item.quantity },
    });

    // Handle refund if paid via Razorpay or Wallet
    let walletBalance;
    if (["razorpay", "wallet"].includes(order.paymentMethod)) {
      const userWallet = await walletModel.findOneAndUpdate(
        { userId: order.userId },
        { $inc: { balance: refundAmount } },
        { new: true }
      );
      walletBalance = userWallet.balance;
      await new transactionModel({
        userId: order.userId,
        amount: refundAmount,
        status: "Success",
        type: "Credit",
        date: new Date(),
      }).save();
    }

    // Update order status for Delivered case (if needed)
    const allItemsDelivered = order.items.every(
      (item) => item.itemStatus === "Delivered"
    );
    if (allItemsDelivered) {
      await orderModel.findByIdAndUpdate(
        orderId,
        { $set: { status: "Delivered" } },
        { new: true }
      );
    }

    res.json({
      success: true,
      message: "Item cancelled and refunded successfully",
      updatedOrder: order,
      walletBalance: walletBalance || 0,
    });
  } catch (error) {
    console.error("Error cancelling item:", error);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred" });
  }
};
const orderPlaced = async (req, res) => {
  try {
    const { paymentMethod, addressID, couponCode } = req.body;
    const userId = req.session?.user?._id;

    const cart = await cartModel.findOne({ userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Your cart is empty." });
    }
    for (const item of cart.items) {
      if (!item.product.isListed) {
        return res.status(400).json({
          message: `Product "${item.product.product_title}" is unavailable as it is not listed.`,
        });
      }
    }

    for (const item of cart.items) {
      for (const item of cart.items) {
        if (item.qty > item.product.stock || item.product.stock === 0) {
          if (item.product.stock === 0) {
            await cartModel.deleteOne({ _id: cart._id });
          }
          return res.status(400).json({
            message: `Product "${item.product.product_title}" is unavailable. Available stock: ${item.product.stock}`,
          });
        }
      }
    }

    const userAddresses = await addressModel.findOne(
      { userId },
      "addressDetails"
    );
    const selectedAddress = userAddresses?.addressDetails.find(
      (addr) => addr._id.toString() === addressID.toString()
    );
    if (!selectedAddress) {
      return res.status(400).json({ message: "Invalid address selected." });
    }
    let { totalPrice } = cart;
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await couponModel.findOne({
        couponCode,
        isListed: true,
        expiryDate: { $gte: new Date() },
        usedBy: { $ne: userId },
      });
      if (!coupon) {
        return res.status(400).json({ message: "Invalid or expired coupon." });
      }
      if (totalPrice < coupon.minAmount) {
        return res.status(400).json({
          message: `Minimum order value for this coupon is ${coupon.minAmount}.`,
        });
      }
      couponDiscount = (totalPrice * coupon.discountPercentage) / 100;
      couponDiscount = Math.min(
        couponDiscount,
        coupon.maxDiscountAmount || couponDiscount
      );
      if (cart.couponApplied == true) {
        totalPrice -= couponDiscount;
        appliedCoupon = coupon._id;
      }
    }

    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      price: item.product.price,
      quantity: item.qty,
      discount: item.product.discountedPrice
        ? item.product.price - item.product.discountedPrice
        : 0,
      finalPrice: item.product.discountedPrice || item.product.price,
      discountedPrice: item.product.discountedPrice || null,
      itemStatus: "Pending",
    }));

    if (paymentMethod === "COD") {
      for (const item of cart.items) {
        const product = await productModel.findById(item.product._id);
        if (!product || item.qty > product.stock || product.stock === 0) {
          return res.status(400).json({
            message: `Product "${
              product?.product_title || "Unknown"
            }" is unavailable. Available stock: ${product?.stock || 0}.`,
          });
        }
      }
    }

    if (paymentMethod === "wallet") {
      const wallet = await walletModel.findOne({ userId });
      if (!wallet || wallet.balance < totalPrice) {
        return res
          .status(400)
          .json({ message: "Insufficient wallet balance." });
      }
      wallet.balance -= totalPrice;
      await wallet.save();
      await transactionModel.create({
        userId,
        amount: totalPrice,
        status: "Success",
        type: "Debit",
      });
    }

    // Create Order
    const order = new orderModel({
      userId,
      items: orderItems,
      totalPrice,
      billingDetails: selectedAddress,
      paymentMethod: paymentMethod === "cod" ? "COD" : "wallet",
      status: paymentMethod === "cod" || "wallet" ? "Pending" : "Delivered",
      paymentStatus: paymentMethod === "cod" ? "Pending" : "Paid",
      offerApplied: appliedCoupon,
      discounts: { couponDiscount },
      couponPrice: couponDiscount,
    });
    await order.save();

    for (const item of orderItems) {
      await productModel.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }
    await cartModel.updateOne(
      { userId },
      { $set: { items: [], totalPrice: 0, couponApplied: false } }
    );

    res.status(200).json({ message: "Order placed successfully!", order });
  } catch (error) {
    console.error("Error while placing order:", error);
    res
      .status(500)
      .json({ message: "An error occurred while placing the order." });
  }
};

const loadOrderList = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const order = await orderModel.find({ userId }).populate("items.products");

    if (!order || order.length === 0) {
      return res.render("orderDetails", {
        orders: [],
        message: "No orders found.",
      });
    }

    res.render("orderList", { order });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("An error occurred while fetching order details.");
  }
};

const loadMyOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalOrders = await orderModel.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await orderModel
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("items.product")
      .lean();
    const updatedOrders = await Promise.all(
      orders.map(async (order) => {
        if (order.billingDetails) {
          const address = await addressModel.findOne({ userId: order.userId });

          if (address && address.addressDetails.length > 0) {
            const billingAddress = address.addressDetails.find(
              (addr) => addr._id.toString() === order.billingDetails.toString()
            );
            if (billingAddress) {
              order.billingDetails = { ...billingAddress.toObject() };
            } else {
              order.billingDetails = null;
            }
          } else {
            order.billingDetails = null;
          }
        }
        return order;
      })
    );
    // console.log(updatedOrders[0].status, "stus details of payment ");

    res.render("orderList", {
      order: updatedOrders,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error loading orders:", error.message);

    // res.status(500).render("errorPage", {
    //   message: "Unable to load orders. Please try again later.",
    // });
  }
};
const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(404).render("404"); // Render 404 page for invalid ObjectId
    }

    const order = await orderModel
      .findById(orderId)
      .populate("items.product")
      .lean();

    console.log(orderId, "Order details:", order);
    if (order.billingDetails) {
      const address = await addressModel.findOne({ userId: order.userId });

      if (address && address.addressDetails.length > 0) {
        const billingAddress = address.addressDetails.find(
          (addr) => addr._id.toString() === order.billingDetails.toString()
        );

        if (billingAddress) {
          order.billingDetails = { ...billingAddress.toObject() };
        } else {
          order.billingDetails = null;
        }
      } else {
        order.billingDetails = null;
      }
    }

    res.render("orderDetails", { orders: order });
  } catch (error) {
    console.error("Error loading order details:", error.message);

    res.status(500).render("errorPage", {
      message: "Unable to load order details. Please try again later.",
    });
  }
};

const verifyOrderOwnership = async (req, res, next) => {
  try {
    const userId = req.session?.user?._id;
    const orderId = req.params.orderId;

    const order = await orderModel.findById(orderId).lean();

    if (!order) {
      return res.redirect("/myOrders");
    }

    if (order.userId.toString() !== userId.toString()) {
      return res.redirect("/myOrders");
    }

    next();
  } catch (error) {
    console.error("Error verifying order ownership:", error.message);
    res.status(500).render("404", {
      message: "An error occurred while verifying order ownership.",
    });
  }
};

//------------------------------------------------------------account details-------------------------------------------------------

const loadUserAc = async (req, res) => {
  try {
    res.render("user");
  } catch (error) {
    console.log(error);
  }
};

const loadaccountDetails = async (req, res) => {
  try {
    console.log("raza");

    const id = req.session.user._id;
    const acc = await userModel.findById(id);
    const success = req.flash("success");
    const errorPassword = req.flash("errorPassword");
    const errorConfirm = req.flash("errorConfirm");
    const successPass = req.flash("successPass");
    res.render("accountDetails", {
      acc,
      success,
      errorPassword,
      errorConfirm,
      successPass,
      showAlert: !!success,
    });
  } catch (error) {
    console.log(error);
  }
};

const accountDetails = async (req, res) => {
  console.log("hii");

  console.log(req.body);

  try {
    const { name, number } = req.body;
    console.log(name, "name");

    console.log(req.body, "body");

    const id = req.session.user._id;
    const user = await userModel.findById(id);
    console.log(user, "userr");
    if (name !== user.name || number !== user.number) {
      if (user) {
        user.name = name;
        console.log(user.name, "gggg");
        user.number = number;
        console.log(user.number, "num");

        await user.save();
        req.flash("success", "successfully changed");
        return res.redirect("/accountDetails");
      }
    } else {
      setTimeout(() => {
        return res.redirect("/accountDetails");
      }, 3000);
    }
  } catch (error) {
    console.log(error);
  }
};

const updatePassword = async (req, res) => {
  try {
    const id = req.session.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const user = await userModel.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect current password" });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

const loadAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const address = await addressModel.findOne({ userId });

    const success = req.flash("success");
    const error = req.flash("error");
    const addressSuccess = req.flash("addressSuccess");

    const messages = { success, error, addressSuccess };

    console.log("Messages:", messages);

    res.render("address", { messages, address });
  } catch (error) {
    console.error("Error loading address:", error);
    req.flash("error", "Error loading address");
    return res.redirect("/userAddress"); // Redirect to handle error gracefully
  }
};

const addAddress = async (req, res) => {
  try {
    const id = req.session.user._id;
    const { fullName, email, number, country, postalCode, state, city } =
      req.body;

    let userAddress = await addressModel.findOne({ userId: id });

    if (!userAddress) {
      userAddress = new addressModel({
        userId: id,
        addressDetails: [
          { fullName, email, number, country, postalCode, state, city },
        ],
      });
    } else {
      userAddress.addressDetails.push({
        fullName,
        email,
        number,
        country,
        postalCode,
        state,
        city,
      });
    }

    await userAddress.save();
    req.flash("addressSuccess", "Address added successfully!");
    return res.redirect("/userAddress");
  } catch (error) {
    req.flash("error", "Failed to add address. Please try again.");
    return res.redirect("/userAddress");
  }
};

const editAddress = async (req, res) => {
  try {
    const { fullName, email, number, country, postalCode, state, city, id } =
      req.body;

    // Update the address
    const updatedAddress = await addressModel.updateOne(
      { "addressDetails._id": id },
      {
        $set: {
          "addressDetails.$.fullName": fullName,
          "addressDetails.$.email": email,
          "addressDetails.$.number": number,
          "addressDetails.$.country": country,
          "addressDetails.$.postalCode": postalCode,
          "addressDetails.$.state": state,
          "addressDetails.$.city": city,
        },
      }
    );

    if (updatedAddress.nModified === 0) {
      req.flash("error", "No address found or no changes made.");
      return res.redirect("/userAddress");
    }

    req.flash("addressSuccess", "Address updated successfully!");
    return res.redirect("/userAddress");
  } catch (error) {
    console.error(error);
    req.flash("error", "Failed to update address.");
    return res.redirect("/userAddress");
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.params._id;

    await addressModel.updateOne(
      { userId: userId },
      {
        $pull: { addressDetails: { _id: addressId } },
      }
    );

    req.flash("addressSuccess", "Address deleted successfully!");
    return res.redirect("/userAddress");
  } catch (error) {
    console.log(error);
    req.flash("error", "Failed to delete address.");
    return res.redirect("/userAddress");
  }
};

//------------------------------------------------------------whishlist-------------------------------------------------------

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const wishlist = await whishlistModel
      .findOne({ userId })
      .populate("items.product")
      .lean();

    if (!wishlist) {
      wishlist = { items: [] };
    } else {
      wishlist.items = wishlist.items.filter((item) => item.product !== null);
    }

    res.render("whishlist", { wishlist });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    res.status(500).send("Internal Server Error");
  }
};

const addToWhishlist = async (req, res) => {
  try {
    const productId = req.query.id;
    const id = req.session.user._id;
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const whishlist = await whishlistModel.findOne({ userId: id });
    if (!whishlist) {
      const whishlist = new whishlistModel({
        userId: id,
        items: [{ product: productId }],
      });
      whishlist.save();

      product.inWishlist = true;
      // console.log( product.inWishlist);

      await product.save();
      return res
        .status(200)
        .json({ success: true, message: "Product added to wishlist" });
    }
    console.log("existingProduct");

    const existingProduct = await whishlist.items.find(
      (item) => item.product.toString() === productId.toString()
    );
    console.log(existingProduct);

    if (existingProduct) {
      return res.status(200).json({
        success: false,
        message: "Product already exists in wishlist",
      });
    }
    whishlist.items.push({ product: productId });
    await whishlist.save();

    return res
      .status(200)
      .json({ success: true, message: "Product added to wishlist" });
  } catch (error) {
    console.log(error);
  }
};

const removeFromWhishlist = async (req, res) => {
  const id = req.session.user._id;
  const productId = req.params.productId;

  // console.log(id, "hhukjghy");

  try {
    const whishlist = await whishlistModel.findOne({ userId: id });
    console.log(whishlist, "raza");

    if (!whishlist) {
      return res.status(404).json({ message: "whishlist not found" });
    }

    const itemIndex = whishlist.items.findIndex(
      (item) => item.product.toString() === productId
    );
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Product not found in cart" });
    }
    whishlist.items.splice(itemIndex, 1);

    await whishlist.save();

    res.redirect("/whishlist");
  } catch (error) {
    console.log(error);
  }
};
//------------------------------------------------------------coupon-------------------------------------------------------
const getCoupon = async (req, res) => {
  try {
    const totalPrice = req.query.totalPrice;
    // const userId = req.session.user._id;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    console.log(totalPrice, currentDate, "currentDate,total");

    const coupons = await couponModel.find({
      minAmount: { $lte: totalPrice },
      expiryDate: { $gte: currentDate },
      isListed: true,
      // usedBy: { $ne: userId },
    });

    console.log(couponModel.minAmount, couponModel.expiryDate, "model");
    console.log(coupons, "coupons");
    res.json({ coupons });
  } catch (error) {
    console.log("error fetching coupons : ", error);
  }
};

const applyCoupon = async (req, res) => {
  try {
    const couponCode = req.query.couponCode;
    const totalPrice = parseFloat(req.query.totalPrice);
    const currentDate = new Date();
    const user = req.session.user._id;
    currentDate.setHours(0, 0, 0, 0);
    const cart = await cartModel.findOne({
      userId: user,
    });
    console.log("qwertyuioasdfghj", cart);
    if (cart.couponApplied === true) {
      return res.json({ success: false, message: "coupon already applied" });
    }
    const coupon = await couponModel.findOne({
      couponCode,
      minAmount: { $lte: totalPrice },
      expiryDate: { $gte: currentDate },
      isListed: true,

      // isApplied: false,
    });
    console.log(" v bvb vc cb ", coupon);

    if (!coupon) {
      return res.json({ success: false, message: "Invalid or expired coupon" });
    }
    let discountAmount = totalPrice * (coupon.discountPercentage / 100);

    let newTotal = 0;
    if (discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;

      newTotal = totalPrice - coupon.maxDiscountAmount;
    } else {
      newTotal = totalPrice - discountAmount;
    }
    cart.couponDiscount = discountAmount;
    cart.couponName = couponCode;
    cart.couponApplied = true;

    await cart.save();
    await coupon.save();

    console.log(totalPrice, "totalprice");

    console.log(discountAmount, "discountAmount");

    console.log(newTotal, "newTotal");

    console.log("123456789741852963");
    return res.json({
      success: true,
      discountAmount: discountAmount.toFixed(2),
      newTotal: newTotal.toFixed(2),
    });
  } catch (error) {
    console.error("Error applying coupon: ", error);
    res.status(500).json({ success: false, message: "Error applying coupon" });
  }
};

const cancelCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { couponCode } = req.body;
    const user = req.session.user._id;
    const cart = await cartModel.findOne({
      userId: user,
    });
    const coupon = await couponModel.findOne({ couponCode });
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    cart.couponApplied = false;
    cart.couponName = null;
    cart.couponDiscount = 0;
    await cart.save();

    const userCart = await cartModel.findOne({ userId });
    const totalPrice = userCart ? userCart.totalPrice : 0;

    res.json({ totalPrice, message: "Coupon cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling coupon", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//------------------------------------------------------------Search-------------------------------------------------------

//------------------------------------------------------------wallet-------------------------------------------------------
const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Pagination setup
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = parseInt(req.query.limit) || 10; // Items per page
    const skip = (page - 1) * limit; // Items to skip for pagination

    // Fetch total number of transactions for this user
    const totalOrders = await transactionModel.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages

    // Fetch wallet details
    let wallet = await walletModel.findOne({ userId }).populate("userId");

    // If no wallet exists, create a new one
    if (!wallet) {
      wallet = new walletModel({
        userId: userId,
        balance: 0,
      });
      await wallet.save();
    }

    // Fetch transactions for the current page
    const transactions = await transactionModel
      .find({ userId: userId })
      .sort({ date: -1 }) // Sort by date descending
      .skip(skip) // Skip transactions for previous pages
      .limit(limit); // Limit results to the current page

    // Render the wallet view with pagination variables
    res.render("wallet", {
      wallet,
      transactions,
      totalPages,
      currentPage: page,
      limit,
    });
  } catch (error) {
    console.error("Error loading wallet:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

//------------------------------------------------------------razorpay-------------------------------------------------------

const razorpay = new Razorpay({
  key_id: "rzp_test_VBZkWRTmp72VJq",
  key_secret: "wyVAN68dPmDIg1F7iGU3ZGhS",
});

const createOrder = async (req, res) => {
  const { couponCode, addressID, paymentMethod } = req.body;

  const userId = req.session?.user?._id;
  try {
    const cart = await cartModel.findOne({ userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No items in the cart" });
    }
    for (const item of cart.items) {
      if (!item.product.isListed) {
        return res.status(400).json({
          message: `Product "${item.product.product_title}" is unavailable as it is not listed.`,
        });
      }
      if (item.qty > item.product.stock || item.product.stock === 0) {
        if (item.product.stock === 0) {
          await cartModel.deleteOne({ _id: cart._id });
        }
        return res.status(400).json({
          message: `Product "${item.product.product_title}" is unavailable. Available stock: ${item.product.stock}`,
        });
      }
    }
    for (const item of cart.items) {
      if (!item.product.isListed) {
        return res.status(400).json({
          message: `Product "${item.product.product_title}" is unavailable as it is not listed.`,
        });
      }
    }

    for (const item of cart.items) {
      for (const item of cart.items) {
        if (item.qty > item.product.stock || item.product.stock === 0) {
          if (item.product.stock === 0) {
            await cartModel.deleteOne({ _id: cart._id });
          }
          return res.status(400).json({
            message: `Product "${item.product.product_title}" is unavailable. Available stock: ${item.product.stock}`,
          });
        }
      }
    }
    const userAddresses = await addresses.findOne({ userId }, "addressDetails");
    if (!userAddresses) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const address = userAddresses.addressDetails.find(
      (addr) => addr._id.toString() === addressID.toString()
    );

    if (!address) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid address selected" });
    }

    let { totalPrice } = cart;
    let discountAmount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await couponModel.findOne({
        couponCode,
        isListed: true,
        expiryDate: { $gte: new Date() },
        usedBy: { $ne: userId },
      });

      if (!coupon) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired coupon" });
      }

      if (totalPrice < coupon.minAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum order value for this coupon is ${coupon.minAmount}`,
        });
      }

      discountAmount = (totalPrice * coupon.discountPercentage) / 100;

      if (
        coupon.maxDiscountAmount &&
        discountAmount > coupon.maxDiscountAmount
      ) {
        discountAmount = coupon.maxDiscountAmount;
      }
      if (cart.couponApplied == true) {
        totalPrice -= discountAmount;
        appliedCoupon = coupon._id;
      }
    }

    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      price: item.product.price,
      quantity: item.qty,
      discount: item.product.discountedPrice
        ? item.product.price - item.product.discountedPrice
        : 0,
      finalPrice: item.product.discountedPrice || item.product.price,
      discountedPrice: item.product.discountedPrice || null,
      itemStatus: "Pending",
    }));

    razorpay;
    const order = new orderModel({
      userId,
      items: orderItems,
      totalPrice,
      billingDetails: address,
      paymentMethod,
      status: paymentMethod === "razorpay" ? "Pending" : "Delivered",
      paymentStatus: paymentMethod === "razorpay" ? "Pending" : "Paid",

      offerApplied: appliedCoupon ? appliedCoupon._id : null,
      couponPrice: discountAmount,
    });

    await order.save();
    // for (const item of orderItems) {
    //   await productModel.findByIdAndUpdate(item.product, {
    //     $inc: { stock: -item.quantity },
    //   });
    // }

    await cartModel.updateOne(
      { userId },
      { $set: { items: [], totalPrice: 0, couponApplied: false } }
    );

    if (paymentMethod === "razorpay") {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const cart = await cartModel
        .findOne({ userId })
        .populate("items.product");

      for (const item of cart.items) {
        for (const item of cart.items) {
          if (item.qty > item.product.stock || item.product.stock === 0) {
            if (item.product.stock === 0) {
              await cartModel.deleteOne({ _id: cart._id });
            }
            return res.status(400).json({
              message: `Product "${item.product.product_title}" is unavailable. Available stock: ${item.product.stock}`,
            });
          }
        }
      }

      const razorpayOrder = await razorpay.orders.create({
        amount: totalPrice * 100,
        currency: "INR",
        receipt: `receipt_order_${order._id}`,
      });

      return res.status(200).json({
        success: true,
        order_id: order._id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        razorpayOrderId: razorpayOrder.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Order created successfully",
      order_id: order._id,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// const verifyPayment = async (req, res) => {
//   const {
//     razorpay_payment_id,
//     razorpay_order_id,
//     razorpay_signature,
//     order_id,
//   } = req.body;
//   const userId = req.session?.user?._id;

//   try {
//     const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
//     hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
//     const expectedSignature = hmac.digest("hex");

//     if (razorpay_signature !== expectedSignature) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid payment signature",
//       });
//     }

//     const updatedOrder = await orderModel.findOneAndUpdate(
//       { _id: order_id },
//       {
//         paymentStatus: "Paid",
//         status: "Pending",
//       },
//       { new: true }
//     );

//     if (!updatedOrder) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Payment verified successfully",
//       order: updatedOrder,
//     });
//   } catch (error) {
//     console.error("Payment verification error:", error);
//     res.status(500).json({
//       success: false,
//       message: "An error occurred during payment verification",
//     });
//   }
// };
const verifyPayment = async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    order_id,
  } = req.body;
  const userId = req.session?.user?._id;

  try {
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expectedSignature = hmac.digest("hex");

    if (razorpay_signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const order = await orderModel.findById(order_id).populate("items.product");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    for (const item of order.items) {
      await productModel.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity },
      });
    }

    await cartModel.updateOne(
      { userId },
      { $set: { items: [], totalPrice: 0, couponApplied: false } }
    );

    const updatedOrder = await orderModel.findOneAndUpdate(
      { _id: order_id },
      {
        paymentStatus: "Paid",
        status: "Pending",
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Payment verified successfully, order updated",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during payment verification",
    });
  }
};

// const retryOrder = async (req, res) => {
//   try {
//     const orderId = req.params.orderId;
//     const order = await orderModel.findById(orderId).populate("items.product");
//     console.log(order, order.items.product, "order and products");

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }
//     for (let item of order.items) {
//       console.log("hii orders");
//       console.log();

//       if (item.quantity > item.product.stock) {
//         return res.status(400).json({
//           message: `Product "${item.product.product_title}" is unavailable. Available stock: ${item.product.stock}`,
//         });
//       }
//     }

//     const razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_KEY_SECRET,
//     });
//     console.log(order);
//     const options = {
//       amount: order.totalPrice * 100,
//       currency: "INR",
//       receipt: orderId,
//       payment_capture: 1,
//     };

//     let razorpayOrder;
//     try {
//       razorpayOrder = await razorpay.orders.create(options);
//     } catch (razorpayError) {
//       console.error("Razorpay order creation failed:", razorpayError);
//       return res.status(500).json({
//         message: "Failed to create Razorpay order",
//         error: razorpayError.message,
//       });
//     }

//     return res.json({
//       order_id: orderId,
//       amount: order.amount,
//       currency: "INR",
//       razorpayOrderId: razorpayOrder.id,
//     });
//   } catch (error) {
//     console.error("Error in retry order:", error);
//     return res.status(500).json({
//       message: "Failed to retry order",
//       error: error.message,
//     });
//   }
// };

const retryOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await orderModel.findById(orderId).populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    for (let item of order.items) {
      if (item.quantity > item.product.stock) {
        return res.status(400).json({
          message: `Product "${item.product.product_title}" is unavailable. Available stock: ${item.product.stock}`,
        });
      }
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: order.totalPrice * 100,
      currency: "INR",
      receipt: orderId,
      payment_capture: 1,
    };

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(options);
    } catch (razorpayError) {
      return res.status(500).json({
        message: "Failed to create Razorpay order",
        error: razorpayError.message,
      });
    }

    return res.json({
      order_id: orderId,
      amount: order.amount,
      currency: "INR",
      razorpayOrderId: razorpayOrder.id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retry order",
      error: error.message,
    });
  }
};

const reVerifyPayment = async (req, res) => {
  try {
    console.log("halooo retry");

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      order_id,
    } = req.body;

    // Validate Razorpay signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature === razorpay_signature) {
      const order = await order.findById(order_id);

      if (!order) {
        return res.status(404).json({
          message: "Order not found for payment verification",
        });
      }

      order.payment_status = "success";
      await order.save();

      return res.json({ success: true });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Signature mismatch" });
    }
  } catch (error) {
    console.error("Error in payment verification:", error);
    return res.status(500).json({
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

const applyBestOfferToProduct = async (productId) => {
  try {
    const product = await productModel.findById(productId).populate("category");
    if (!product) {
      throw new Error("Product not found");
    }

    const offers = await offerModel.find({
      isListed: true,
      $or: [
        { applicableProducts: product._id },
        { applicableCategories: product.category._id },
      ],
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (offers.length === 0) {
      product.bestOffer = null;
      product.discountedPrice = null;
    } else {
      offers.sort((a, b) => {
        const discountA =
          a.discountType === "percentage"
            ? (a.discountValue / 100) * product.price
            : a.discountValue;
        const discountB =
          b.discountType === "percentage"
            ? (b.discountValue / 100) * product.price
            : b.discountValue;

        return (
          discountB - discountA || new Date(a.endDate) - new Date(b.endDate)
        );
      });

      const bestOffer = offers[0];
      const discountedPrice =
        bestOffer.discountType === "percentage"
          ? product.price - (bestOffer.discountValue / 100) * product.price
          : product.price - bestOffer.discountValue;

      product.bestOffer = bestOffer._id;
      product.discountedPrice = discountedPrice;
    }

    await product.save();
  } catch (error) {
    console.log(error);
  }
};

const cancelRazorpayOrder = async (req, res) => {
  const { order_id } = req.body;

  try {
    const updatedOrder = await orderModel.findOneAndUpdate(
      { _id: order_id },
      {
        paymentStatus: "Failed",
        status: "Failed",
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Order cancellation error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during order cancellation",
    });
  }
};

//------------------------------------------------------------invoice-------------------------------------------------------

const downloadInvoice = async (req, res) => {
  const { orderId } = req.params;
  const { number } = req.query;

  try {
    const order = await orderModel
      .findById(orderId)
      .populate("items.product")
      .lean();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const address = await addressModel.findOne({ userId: order.userId });
    if (address && address.addressDetails.length > 0) {
      const billingAddress = address.addressDetails.find(
        (addr) => addr._id.toString() === order.billingDetails.toString()
      );
      order.billingDetails = billingAddress
        ? { ...billingAddress.toObject() }
        : null;
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const filePath = path.join("Downloads", `invoice-${order._id}.pdf`);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const drawLine = (y) => {
      doc.moveTo(50, y).lineTo(550, y).stroke("#D3D3D3");
    };

    doc.fillColor("black");
    doc.fontSize(20).font("Helvetica-Bold").text("CozyCubs", 120, 50);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Edapally, Kochi, Kerala, 217231", 120, 75)
      .text("Phone: +91 89893927433 | Email: support@cozyCubs.com", 120, 90);
    drawLine(110);

    doc.fontSize(16).font("Helvetica-Bold").text("INVOICE", 250, 130);

    const detailsTop = 150;
    doc.rect(50, detailsTop, 240, 100).fill("#F0F0F0").stroke();
    doc
      .fillColor("black")
      .fontSize(12)
      .text("Order Details", 60, detailsTop + 10);
    doc
      .fontSize(10)
      .text(`Order Number: ${order._id}`, 60, detailsTop + 30)
      .text(
        `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
        60,
        detailsTop + 50
      );

    doc.rect(310, detailsTop, 240, 100).fill("#F0F0F0").stroke();
    doc
      .fillColor("black")
      .fontSize(12)
      .text("Billing Details", 320, detailsTop + 10);

    if (order.billingDetails) {
      doc
        .fontSize(10)
        .text(`${order.billingDetails.fullName}`, 320, detailsTop + 30)
        .text(`${order.billingDetails.email}`, 320, detailsTop + 45)
        .text(
          `${order.billingDetails.city}, ${order.billingDetails.state}, ${order.billingDetails.postalCode}`,
          320,
          detailsTop + 60
        )
        .text(`${order.billingDetails.country}`, 320, detailsTop + 75);
    } else {
      doc.text("No billing details available", 320, detailsTop + 30);
    }

    drawLine(260);

    const tableTop = 280;
    doc.fontSize(12).text("Product Name", 50, tableTop);
    doc.text("Qty", 250, tableTop);
    doc.text("Price", 320, tableTop);
    doc.text("Total", 420, tableTop);

    drawLine(tableTop + 15);

    let currentY = tableTop + 25;
    doc.fontSize(10);

    order.items.forEach((item) => {
      doc.text(item.product.product_title, 50, currentY);
      doc.text(item.quantity.toString(), 250, currentY);
      doc.text(`INR ${item.price.toFixed(2)}`, 320, currentY);
      doc.text(`INR ${(item.quantity * item.price).toFixed(2)}`, 420, currentY);
      currentY += 15;
    });

    drawLine(currentY);

    currentY += 10;
    doc.fontSize(12).text("Summary:", 350, currentY);
    doc
      .fontSize(10)
      .text(`Subtotal: INR ${order.totalPrice}`, 350, currentY + 15)
      .text(
        `Discount Applied: INR ${order.discountApplied.toFixed(2)}`,
        350,
        currentY + 30
      )
      .text(
        `Coupon Discount: INR ${parseFloat(number).toFixed(2)}`,
        350,
        currentY + 45
      )
      .text(
        `Total: INR ${(order.totalPrice - order.discountApplied).toFixed(2)}`,
        350,
        currentY + 60
      );

    const footerY = doc.page.height - 50;
    doc.fontSize(10).text("Thank you for your purchase!", 50, footerY, {
      align: "center",
      width: doc.page.width - 100,
    });

    doc.end();

    writeStream.on("finish", () => {
      res.download(filePath, `invoice-${order._id}.pdf`, (err) => {
        if (err) {
          console.error("Error downloading the invoice:", err);
        }
        fs.unlinkSync(filePath);
      });
    });

    writeStream.on("error", (err) => {
      console.error("Error writing PDF:", err);
      res.status(500).send("Error generating the invoice.");
    });
  } catch (error) {
    console.error("Error fetching order or generating invoice:", error);
    res.status(500).send("Internal server error.");
  }
};

//------------------------------------------------------------notfound-------------------------------------------------------

const NotFoundPage = async (req, res) => {
  try {
    res.render("404");
  } catch (error) {
    console.log(error);
  }
};
//------------------------------------------------------------logOut-------------------------------------------------------

const logout = async (req, res) => {
  try {
    req.session.user = null;
    res.redirect("/landing-page");
  } catch (error) {
    console.log(error);
  }
};

//------------------------------------------------------------guest user-------------------------------------------------------

const loadLandingPage = async (req, res) => {
  try {
    const products = await productModel
      .find()
      .populate("category", "name")
      .populate("brand", "name")
      .populate("bestOffer");

    const newArrivals = await productModel
      .find({ isNewProduct: true })
      .populate("category", "name")
      .populate("brand", "name");

    const categories = await catagory.find();

    res.render("landingPage", { products, newArrivals, categories });
  } catch (error) {
    console.log("Error loading landing page:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadGuestProductList = async (req, res) => {
  try {
    const currentDate = new Date();
    const { categories, query } = req.query;
    let filterQuery = {};
    if (categories) {
      filterQuery.category = {
        $in: Array.isArray(categories) ? categories : [categories],
      };
    }
    if (query) {
      filterQuery.$or = [
        { product_title: { $regex: query, $options: "i" } },
        { category: { $in: categories ? categories : [] } },
      ];
    }

    const products = await productModel
      .find(filterQuery)
      .populate("bestOffer")
      .populate("category")
      .populate("brand");

    for (const product of products) {
      if (product.bestOffer) {
        const { endDate } = product.bestOffer;

        if (new Date(endDate) < currentDate) {
          product.bestOffer = null;
          product.discountedPrice = null;
          await product.save();

          await cartModel.updateMany(
            { "items.productId": product._id },
            { $pull: { items: { productId: product._id } } }
          );
        }
      }
    }

    const categoriesList = await catagory.find();

    res.render("guestProduct", {
      product: products,
      categories: categoriesList,
      selectedCategories: Array.isArray(categories) ? categories : [categories],
      searchQuery: query || "",
    });
  } catch (error) {
    console.error("Error loading product list:", error);
    res.status(500).send("An error occurred while loading the product list.");
  }
};

const loadGuestProductDetails = async (req, res) => {
  try {
    const id = req.params.id;

    const product = await productModel
      .findById(id)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("bestOffer");

    const cartFail = req.flash("cartFail");
    const msg = req.flash("msg");

    res.render("guestProductDetails", { product, cartFail, msg });
  } catch (error) {
    console.log(error);
  }
};

const aboutUs = async (req, res) => {
  try {
    res.render("aboutUs");
  } catch (error) {
    console.log(error);
  }
};

const pagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = 10; // Items per page
    const totalItems = await SomeModel.countDocuments(); // Get total count
    const totalPages = Math.ceil(totalItems / limit);
    const items = await SomeModel.find()
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("your-view", { items, currentPage: page, totalPages });
  } catch (error) {
    console.error("Error fetching paginated data:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getReferal = async (req, res) => {
  const id = req.session.user;

  console.log("saad");

  try {
    const user = await userModel.findById(id);

    console.log(user);

    if (user.referalCode) {
      res.status(200).send({ success: true, referalcode: user.referalCode });
    } else {
      const generateUniqueCode = () => {
        return `REF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      };

      let newReferalCode = generateUniqueCode();
      console.log(newReferalCode);

      while (await userModel.findOne({ referalCode: newReferalCode })) {
        newReferalCode = generateUniqueCode();
      }
      user.referalCode = newReferalCode;
      await user.save();
      res.status(200).send({ success: true, referralcode: newReferalCode });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  loadRegister,
  registerUser,
  sendOtp,
  loadVerifyOtp,
  verifyOtp,
  resendOtp,
  loadLogin,
  loginUser,
  loadHome,
  googleAuth,
  logout,
  loadForgotPassword,
  forgotPassword,
  forgotResendOtp,
  loadForgotOtp,
  forgotVerifyOtp,
  changePassword,
  changePass,
  loadProductList,
  loadProductDetails,
  loadCart,
  // loadAccount,
  // accPassword,
  // // loadAccountDetails,
  // loadChangePass,
  // accChangePassword,
  loadUserAc,
  loadaccountDetails,
  accountDetails,
  updatePassword,
  loadAddress,
  addAddress,
  editAddress,
  deleteAddress,
  addToCart,
  incrementQty,
  decrementQty,
  deleteCart,
  loadCheckout,
  addCheckoutAddress,
  editCheckoutAddress,
  loadOrderPlaced,
  orderPlaced,
  loadMyOrders,
  loadOrderDetails,
  verifyOrderOwnership,
  cancelOrder,
  // sortProducts,
  loadWishlist,
  addToWhishlist,
  removeFromWhishlist,
  getCoupon,
  applyCoupon,
  cancelCoupon,
  // searchItems,
  loadWallet,
  createOrder,
  verifyPayment,
  // paymentSuccess,
  // orderCancellation,
  NotFoundPage,
  cancelRazorpayOrder,
  // getRetryOrder,
  retryOrder,
  reVerifyPayment,
  // downloadInvoice,
  downloadInvoice,
  loadLandingPage,
  loadGuestProductList,
  loadGuestProductDetails,
  aboutUs,
  pagination,
  cancelItem,
  returnItem,
  getReferal,
};
