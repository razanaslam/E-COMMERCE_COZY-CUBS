// const User = require("../model/userModel");
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
  const { name, email, number, password, confirmPassword } = req.body;

  try {
    const existUser = await userModel.findOne({ email });
    // console.log(existUser);
    if (existUser) {
      // console.log(existUser);
      console.log("email already existed");
      req.flash("errorEmail", "User already exists");
      res.redirect("/register");
    } else {
      if (password !== confirmPassword) {
        req.flash("errorPassword", "hyy Passwords do not match");
        console.log("password is already existed");
        return res.redirect("/register");
      }
      // res.redirect("/verify-otp");

      const secPass = await bcrypt.hash(password, 10);
      const newUser = {
        name,
        email,
        number,
        password: secPass,
      };
      // await newUser.save();
      req.session.user = newUser;
      console.log(req.session.user, "register");

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
      // req.session.otp = otp;
      // console.log(req.session.otp);

      // req.session.otpExpiration = expirationTime;
      // req.session.email = email;
      res.redirect(`/verify-otp/${newOtpModel._id}`);
    }
  } catch (error) {
    console.log(error);
  }
};

//------------------------------------------------------------OTP-------------------------------------------------------

const sendOtp = async (toEmail, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.emailUser,
        pass: process.env.emailPass,
      },
    });

    const mailOptions = {
      from: process.env.emailUser,
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

    // console.log(otp);
    // console.log(id);

    const isOtp = await otpModel.findById(id);
    if (!isOtp) {
      return res.redirect(`/verify-otp/${id}`);
    }

    if (isOtp.otp === otp) {
      if (isOtp.otpExpiredAt < currentOtpTime) {
        return res.redirect(`/verify-otp/${id}`);
      }
      const { name, email, number, password } = req.session.user;
      const newUser = new userModel({
        name,
        email,
        number,
        password,
      });

      await newUser.save();
    } else {
      req.flash("invalidOtp", "invalid otp");
      return res.redirect(`/verify-otp/${id}`);
    }

    // if (req.session.otpExpiration < currentOtpTime) {
    //   req.flash("errorOtp", "OTP has expired. Please try again.");
    //   return res.redirect("/verify-otp");
    // }
    // const sessionOtp = req.session.otp;

    req.session.user = null;
    // req.session.otp = null;
    // req.session.otpExpiration = null;
    await otpModel.findByIdAndDelete(id);

    req.flash("success", "OTP verified successfully!");
    res.redirect("/login");
  } catch (error) {
    console.log(error);
  }
};

const resendOtp = async (req, res) => {
  console.log("hy");

  const user = req.session.user;
  console.log(user, "gfghjkl");

  try {
    const { otp } = generateOtp();
    const emailSent = await sendOtp(user.email, otp);
    console.log(req.session.user);

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
  // console.log(req.session.user);
  try {
    if (!req.session.user) {
      // console.log(req.session.user);

      const loginError = req.flash("loginError");
      const blocked = req.flash("blocked");
      res.render("login", { loginError, blocked });
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

    if (user.isBlocked) {
      // console.log("hhhh");

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
      .find({ isNewProduct: true })
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
      console.log("otp match");

      if (isOtp.otpExpiredAt < currentOtpTime) {
        console.log("expired");

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
//     const product = await productModel
//       .find()
//       .populate("bestOffer")
//       .populate("category")
//       .populate("brand");

//     res.render("productList", { product });
//   } catch (error) {
//     console.error("Error loading product list:", error);
//     res.status(500).send("An error occurred while loading the product list.");
//   }
// };

// const loadProductList = async (req, res) => {
//   try {
//     const currentDate = new Date();

//     const products = await productModel
//       .find()
//       .populate("bestOffer")
//       .populate("category")
//       .populate("brand");

//     for (const product of products) {
//       if (product.bestOffer) {
//         const { endDate } = product.bestOffer;

//         // Check if the offer has expired
//         if (new Date(endDate) < currentDate) {
//           // Remove expired offer from the product
//           product.bestOffer = null;
//           product.discountedPrice = null;
//           await product.save();

//           // Remove the product with the expired offer from all carts
//           await cartModel.updateMany(
//             { "items.productId": product._id },
//             { $pull: { items: { productId: product._id } } }
//           );
//         }
//       }
//     }

//     // Render the product list with valid offers
//     res.render("productList", { product: products });
//   } catch (error) {
//     console.error("Error loading product list:", error);
//     res.status(500).send("An error occurred while loading the product list.");
//   }
// };

// const loadProductList = async (req, res) => {
//   try {
//     const currentDate = new Date();

//     // Extract selected categories from query params
//     const { categories } = req.query;

//     // Build the filter query dynamically
//     const filterQuery = {};
//     if (categories) {
//       filterQuery.category = {
//         $in: Array.isArray(categories) ? categories : [categories],
//       };
//     }

//     const products = await productModel
//       .find(filterQuery)
//       .populate("bestOffer")
//       .populate("category")
//       .populate("brand");

//     for (const product of products) {
//       if (product.bestOffer) {
//         const { endDate } = product.bestOffer;

//         // Check if the offer has expired
//         if (new Date(endDate) < currentDate) {
//           // Remove expired offer from the product
//           product.bestOffer = null;
//           product.discountedPrice = null;
//           await product.save();

//           // Remove the product with the expired offer from all carts
//           await cartModel.updateMany(
//             { "items.productId": product._id },
//             { $pull: { items: { productId: product._id } } }
//           );
//         }
//       }
//     }

//     // Fetch all categories for the filter
//     const categoriesList = await catagory.find();

//     // Render the product list with valid offers and selected filters
//     res.render("productList", {
//       product: products,
//       categories: categoriesList,
//       selectedCategories: Array.isArray(categories) ? categories : [categories],
//     });
//   } catch (error) {
//     console.error("Error loading product list:", error);
//     res.status(500).send("An error occurred while loading the product list.");
//   }
// };

const loadProductList = async (req, res) => {
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

    res.render("productList", {
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

// const loadProductList = async (req, res) => {
//   try {
//     const { sort } = req.query; // Get the filter/sort option from the query string
//     let sortCriteria;

//     // Define sorting options based on the selected filter
//     switch (sort) {
//       case "popularity":
//         sortCriteria = { popularity: -1 }; // Adjust based on your model's fields
//         break;
//       case "nameAsc":
//         sortCriteria = { product_title: 1 };
//         break;
//       case "nameDesc":
//         sortCriteria = { product_title: -1 };
//         break;
//       case "priceLowHigh":
//         sortCriteria = { price: 1 };
//         break;
//       case "priceHighLow":
//         sortCriteria = { price: -1 };
//         break;
//       default:
//         sortCriteria = {}; // Default sorting (no specific order)
//         break;
//     }

//     // Fetch products from the database according to the sorting criteria
//     const products = await productModel.find().sort(sortCriteria);

//     // Render only the product list partial
//     res.render("productList", { products });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send("An error occurred while loading products.");
//   }
// };
// const loadProductList = async (req, res) => {
//   try {
//     // Retrieve the sorting option from query parameters (default to 'featured' if none provided)
//     const sortOption = req.query.sort || "featured";
//     const categories = await catagory.find({ isListed: true });

//     // Prepare the sorting criteria based on the selected option
//     let sortCriteria;
//     switch (sortOption) {
//       case "priceLowHigh":
//         sortCriteria = { salePrice: 1 }; // Ascending order
//         break;
//       case "priceHighLow":
//         sortCriteria = { salePrice: -1 }; // Descending order
//         break;
//       case "nameAZ":
//         sortCriteria = { productName: 1 }; // Alphabetical order
//         break;
//       case "nameZA":
//         sortCriteria = { productName: -1 }; // Reverse alphabetical
//         break;
//       default:
//         sortCriteria = {}; // Default sorting (featured, etc.)
//     }

//     // Fetch filtered and sorted products with pagination (example: 12 products per page)
//     const page = parseInt(req.query.page) || 1;
//     const limit = 12;
//     const product = await productModel
//       .find({
//         isBlocked: false,
//         category: { $in: categories.map((category) => category._id) },
//         quantity: { $gt: 0 },
//       })
//       .sort(sortCriteria)
//       .skip((page - 1) * limit)
//       .limit(limit);

//     // Count total products for pagination calculation
//     const totalProducts = await productModel.countDocuments({
//       isBlocked: false,
//       category: { $in: categories.map((category) => category._id) },
//       quantity: { $gt: 0 },
//     });

//     const totalPages = Math.ceil(totalProducts / limit);

//     return res.render("productList", {
//       product,
//       categories,
//       currentPage: page,
//       totalPages,
//       sortOption,
//     });
//   } catch (error) {
//     console.error("Error loading shop page:", error);
//     res.status(500).send("Server Error");
//   }
// };

// const loadProductList = async (req, res) => {
//   try {
//     const sortOption = req.query.sort || "featured";
//     const categories = await catagory.find({ isListed: true });

//     let sortCriteria;
//     switch (sortOption) {
//       case "priceLowHigh":
//         sortCriteria = { salePrice: 1 };
//         break;
//       case "priceHighLow":
//         sortCriteria = { salePrice: -1 };
//         break;
//       case "nameAZ":
//         sortCriteria = { productName: 1 };
//         break;
//       case "nameZA":
//         sortCriteria = { productName: -1 };
//         break;
//       default:
//         sortCriteria = {};
//     }

//     const page = parseInt(req.query.page) || 1;
//     const limit = 12;
//     const products = await productModel
//       .find({
//         isListed: false,
//         category: { $in: categories.map((category) => category._id) },
//         quantity: { $gt: 0 },
//       })
//       .sort(sortCriteria)
//       .skip((page - 1) * limit)
//       .limit(limit);

//     const totalProducts = await productModel.countDocuments({
//       isListed: false,
//       category: { $in: categories.map((category) => category._id) },
//       quantity: { $gt: 0 },
//     });

//     const totalPages = Math.ceil(totalProducts / limit);

//     return res.render("productList", {
//       products,
//       categories,
//       currentPage: page,
//       totalPages,
//       sortOption,
//     });
//   } catch (error) {
//     console.error("Error loading shop page:", error);
//     res.status(500).send("Server Error");
//   }
// };
const sortProducts = async (req, res) => {
  const { sortType } = req.body;

  try {
    let sortedProducts;

    switch (sortType) {
      case "a-z":
        sortedProducts = await productModel.find().sort({ product_title: 1 });
        break;
      case "z-a":
        sortedProducts = await productModel.find().sort({ product_title: -1 });
        break;
      case "low-to-high":
        sortedProducts = await productModel.find().sort({ price: 1 });
        break;
      case "high-to-low":
        sortedProducts = await productModel.find().sort({ price: -1 });
        break;
      default:
        sortedProducts = await productModel.find();
    }

    console.log("Sorted Products:", sortedProducts);

    res.json({ sortedProducts });
  } catch (error) {
    console.error("Error sorting products:", error);
    res.status(500).send("Error sorting products");
  }
};

//------------------------------------------------------------product Details-------------------------------------------------------

const loadProductDetails = async (req, res) => {
  try {
    const id = req.params.id;

    const product = await productModel
      .findById(id)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("bestOffer");

    const cartFail = req.flash("cartFail");
    const msg = req.flash("msg");

    res.render("product_details", { product, cartFail, msg });
  } catch (error) {
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
    // console.log(cart);

    const coupons = await couponModel.find();
    const cartItems = cart ? cart.items : [];
    console.log(cartItems, "haloohgfjkl;do");
    // userCart = cart.items;

    const totalPrice = cart ? cart.totalPrice : [];
    const discount = cart ? cart.discount : [];

    res.render("cart", {
      cart,
      cartItems,
      cartEmpty,
      coupons,
      discount,
      totalPrice,
    });
  } catch (error) {
    console.log(error);
  }
};

// const addToCart = async (req, res) => {
//   try {
//     const productId = req.query.id;
//     const id = req.session.user._id;
//     // console.log(productId, id);

//     const product = await productModel.findById(productId);
//     // console.log(product);

//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }
//     let price;
//     if (product.discountedPrice) {
//       price = product.discountedPrice;
//     } else {
//       price = product.price;
//     }

//     let cart = await cartModel.findOne({ userId: id });
//     if (!cart) {
//       cart = new cartModel({
//         userId: id,
//         items: [
//           {
//             product: productId,
//             price: price,
//             qty: 1,
//           },
//         ],
//         totalPrice: price,
//       });
//     } else {
//       const existingProduct = cart.items.find(
//         (item) => item.product.toString() === productId
//       );
//       if (existingProduct) {
//         return res.status(409).json({ message: "Product already in cart" });
//       }
//       cart.items.push({
//         product: productId,
//         price: price,
//         qty: 1,
//       });
//       cart.totalPrice += price;
//     }
//     await cart.save();
//     res.status(200).json({ message: "Product added to cart" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "An error occurred" });
//   }
// };

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
    const item = cart.items.find((i) => i.product.toString() === productId);

    if (item) {
      const product = await productModel.findById(productId);

      if (item.qty < product.stock) {
        item.qty += 1;
        cart.totalPrice += item.price;
        await cart.save();

        res.json({ newQty: item.qty, newTotal: item.price * item.qty });
      } else {
        res.status(400).json({ message: "Stock limit reached" });
      }
    } else {
      res.status(404).json({ message: "Item not found in cart" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating quantity" });
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

// const deleteCart = async (req, res) => {
//   try {
//     const productId = req.params.productId;
//     const id = req.session.user._id;
//     await cartModel.updateOne(
//       { userId: id },
//       { $pull: { items: { product: productId } } }
//     );
//     res.redirect("/cart");
//   } catch (error) {
//     console.log(error);
//   }
// };
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

// const loadCheckout = async (req, res) => {
//   try {
//     const id = req.session.user._id;
//     const cart = await cartModel
//       .findOne({ userId: id })
//       .populate("items.product");
//     const address = await addressModel.find({ userId: id });

//     if (!cart || cart.items.length === 0) {
//       req.flash("cartEmpty", "Your cart is empty");
//       return res.redirect("/cart");
//     }
//     const cartItems = cart.items;
//     const totalPrice = cart.totalPrice;
//     const cartEmpty = req.flash("cartEmpty");
//     const addressSuccess = req.flash("addressSuccess");

//     res.render("checkout", {
//       address,
//       cartItems,
//       totalPrice,
//       cartEmpty,
//       addressSuccess,
//     });
//   } catch (error) {
//     console.log(error);
//   }
// };

const loadCheckout = async (req, res) => {
  try {
    const id = req.session.user._id;
    const cart = await cartModel
      .findOne({ userId: id })
      .populate("items.product");
    const address = await addressModel.find({ userId: id });

    if (!cart || cart.items.length === 0) {
      req.flash("cartEmpty", "Your cart is empty");
      return res.redirect("/cart");
    }

    const cartItems = cart.items;
    const totalPrice = cart.totalPrice;
    const cartEmpty = req.flash("cartEmpty");
    const addressSuccess = req.flash("addressSuccess");
    const messages = [];

    res.render("checkout", {
      address,
      cartItems,
      totalPrice,
      cartEmpty,
      addressSuccess,
      messages,
      razorpayKey: "rzp_test_VBZkWRTmp72VJq",
    });
  } catch (error) {
    console.log(error);
  }
};

// const addCheckoutAddress = async (req, res) => {
//   try {
//     const id = req.session.user._id;
//     const {
//       fullName,
//       email,
//       number,
//       country,
//       postalCode,
//       state,
//       city,
//       // context,
//     } = req.body;
//     // console.log("id:", id);

//     let userAddress = await addressModel.findOne({ userId: id });
//     // console.log("useraddress :", userAddress);

//     if (!userAddress) {
//       userAddress = new addressModel({
//         userId: id,
//         addressDetails: [
//           { fullName, email, number, country, postalCode, state, city },
//         ],
//       });
//     } else {
//       userAddress.addressDetails.push({
//         fullName,
//         email,
//         number,
//         country,
//         postalCode,
//         state,
//         city,
//       });
//     }
//     // console.log(userAddress);
//     await userAddress.save();
//     req.flash("success", "address is added successfully");
//     // return res.redirect(context === "checkout" ? "/checkout" : "/userAddress");
//     return res.redirect("/checkout");
//   } catch (error) {
//     req.flash("error", "Failed to add address. Please try again.");
//     // return res.redirect(context === "checkout" ? "/checkout" : "/userAddress");
//     return res.redirect("/checkout");
//   }
// };

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
    res.render("orderPlaced");
  } catch (error) {
    console.log(error);
  }
};

// const cancelOrder = async (req, res) => {
//   try {
//     const orderId = req.params.id;
//     const updatedOrder = await orderModel.findByIdAndUpdate(
//       orderId,
//       { status: "Cancelled" },
//       { new: true }
//     );

//     if (!updatedOrder) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Order not found" });
//     }

//     for (const item of updatedOrder.items) {
//       await productModel.findByIdAndUpdate(item.product, {
//         $inc: { stock: item.quantity },
//       });
//     }

//     res.json({
//       success: true,
//       message: "Order cancelled successfully",
//       order: updatedOrder,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       success: false,
//       message: "An error occurred while cancelling the order",
//     });
//   }
// };

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      { status: "Cancelled" },
      { new: true }
    );

    if (!updatedOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const userId = updatedOrder.userId;

    const totalRefundAmount = updatedOrder.items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);

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

    userWallet.balance += totalRefundAmount;
    await userWallet.save();

    const transaction = new transactionModel({
      userId,
      amount: totalRefundAmount,
      status: "Success",
      type: "Credit",
      date: new Date(),
    });

    await transaction.save();

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
const orderPlaced = async (req, res) => {
  try {
    console.log("hi");

    const { paymentMethod, addressID, couponCode } = req.body;
    const userId = req.session?.user?._id;

    const cart = await cartModel.findOne({ userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Your cart is empty." });
    }

    const userAddresses = await addressModel.findOne({ userId });
    const selectedAddress = userAddresses?.addressDetails.find(
      (address) => address._id.toString() === addressID.toString()
    );
    if (!selectedAddress) {
      return res.status(400).json({ message: "Invalid address selected." });
    }

    let totalPrice = 0;
    const orderItems = cart.items.map((item) => {
      const product = item.product;
      const basePrice = product.price;
      const discountAmount =
        product.discountedPrice != null
          ? basePrice - product.discountedPrice
          : 0;
      const finalPrice = basePrice - discountAmount;

      totalPrice += finalPrice * item.qty;

      return {
        product: product._id,
        price: basePrice,
        discountAmount,
        finalPrice,
        quantity: item.qty,
      };
    });

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = await couponModel.findOne({
        couponCode,
        isListed: true,
        expiryDate: { $gte: new Date() },
        usedBy: { $ne: userId },
      });
      console.log(coupon);

      if (!coupon) {
        return res.status(400).json({ message: "Invalid or expired coupon." });
      }

      if (totalPrice < coupon.minAmount) {
        return res.status(400).json({
          message: `Minimum order value for this coupon is ${coupon.minAmount}.`,
        });
      }

      couponDiscount = (totalPrice * coupon.discountPercentage) / 100;
      if (
        coupon.maxDiscountAmount &&
        couponDiscount > coupon.maxDiscountAmount
      ) {
        couponDiscount = coupon.maxDiscountAmount;
      }

      totalPrice -= couponDiscount;
      appliedCoupon = coupon._id;
    }

    const order = new orderModel({
      userId,
      items: orderItems,
      totalPrice,
      billingDetails: selectedAddress,
      paymentMethod: paymentMethod === "cod" ? "COD" : "wallet",
      status: paymentMethod === "cod" ? "Pending" : "Delivered",
      paymentStatus: paymentMethod === "cod" ? "Pending" : "Paid",
      offerApplied: appliedCoupon,
      discounts: {
        couponDiscount,
        productDiscounts: orderItems.reduce(
          (acc, item) => acc + item.discountAmount * item.quantity,
          0
        ),
      },
    });

    await order.save();

    for (const item of cart.items) {
      await productModel.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.qty },
      });
    }

    await cartModel.updateOne(
      { userId },
      { $set: { items: [], totalPrice: 0 } }
    );

    res.status(200).json({
      message: "Order placed successfully!",
      order,
    });
  } catch (error) {
    console.error("Error while placing order:", error);
    res
      .status(500)
      .json({ message: "An error occurred while placing the order.", error });
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

// const orderList = async (req, res) => {
//   const { orderId } = req.params;
//   const { status } = req.body;

//   try {
//     const updatedOrder = await orderModel.findByIdAndUpdate(
//       orderId,
//       { status },
//       { new: true }
//     );
//     if (updatedOrder) {
//       res.json({ success: true });
//     } else {
//       res.json({ success: false, error: "Order not found" });
//     }
//   } catch (error) {
//     console.error(error);
//     res.json({ success: false, error: "Error updating order status" });
//   }
// };

const loadMyOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalOrders = await orderModel.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await orderModel
      .find()
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

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.log("hyyy");
      req.flash("errorPassword", "Incorrect current password.");
      setTimeout(() => {
        return res.redirect("/accountDetails");
      }, 3000);
    }

    // if (newPassword !== confirmPassword) {
    //   req.flash(
    //     "errorPassword",
    //     "New password and confirm password do not match."
    //   );
    //   return res.redirect("/accountDetails");
    // }

    const newPass = await bcrypt.hash(newPassword, 10);

    const userdata = await userModel.findByIdAndUpdate(
      id,
      { $set: { password: newPass } },
      { new: true }
    );

    if (userdata) {
      req.flash("successPass", "Password changed successfully.");
      setTimeout(() => {
        return res.redirect("/accountDetails");
      }, 3000);
    }
  } catch (error) {
    req.flash(
      "errorPassword",
      "An error occurred while changing the password."
    );
    setTimeout(() => {
      return res.redirect("/accountDetails");
    }, 3000);
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
// const loadAccount = async (req, res) => {
//   try {
//     const id = req.session.user._id;
//     console.log(id, "jkehfjh");
//     const acc = await userModel.findById(id);
//     console.log(acc);
//     const passError = req.flash("passError");
//     const passError2 = req.flash("passError2");

//     res.render("accountDetails", { acc, passError, passError2 });
//   } catch (error) {
//     console.log(error);
//   }
// };

// const accPassword = async (req, res) => {
//   try {
//     const id = req.session.user._id;
//     const { password, newPassword, confirmPassword } = req.body;
//     const userPass = await userModel.findById(id);
//     const isMatch = await bcrypt.compare(password, userPass.password);
//     if (!isMatch) {
//       req.flash("passError", "Incorrect password !");
//       // return res.redirect("/userAccount");
//     }
//     if (newPassword !== confirmPassword) {
//       res.flash(
//         "passError2",
//         "password and confirm password is not matching !"
//       );
//       // return res.redirect("/userAccount");
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };

// // const loadAccountDetails=async(req,res)=>{
// //   try {
// //     res.render("accountDetails")
// //   } catch (error) {
// //     console.log(error);

// //   }
// // }

// const loadChangePass = async (req, res) => {
//   try {
//     const id = req.session.user._id;
//     const acc = await userModel.findById(id);
//     res.render("accChangePassword", { acc });
//   } catch (error) {
//     console.log(error);
//   }
// };

// const accChangePassword = async (req, res) => {
//   try {
//     const id = req.session.user._id;
//     const acc = await userModel.findById(id);
//     res.render("userAcc", { acc });
//   } catch (error) {
//     console.log(error);
//   }
// };

//------------------------------------------------------------whishlist-------------------------------------------------------

// const loadWishlist = async (req, res) => {
//   try {
//     console.log(req.session.user._id);

//     const id = req.session.user._id;
//     // const cartEmpty = req.flash("cartEmpty");
//     const whishlist = await whishlistModel
//       .findOne({ userId: id })
//       .populate("items.product");
//     // const product = await productModel
//     //   .findById(_id)
//     //   .populate("category", "name")
//     //   .populate("brand", "name");

//     const items = whishlist ? whishlist.items : [];
//     console.log(
//       whishlist,
//       "whishlist",
//       items,
//       "whishlist",
//       // product,
//       "whishlist"
//     );

//     res.render("whishlist", { whishlist, items });
//   } catch (error) {
//     console.log(error);
//   }
// };

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user._id;

    const wishlist = await whishlistModel
      .findOne({ userId })
      .populate("items.product")
      .lean();

    if (wishlist) {
      // Filter out items with null or undefined product
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
    const userId = req.session.user._id;
    const currentDate = new Date();
    console.log(totalPrice, "hay");
    console.log(totalPrice, "hay");
    console.log(totalPrice, "hay");

    const coupons = await couponModel.find({
      minAmount: { $lte: totalPrice },
      expiryDate: { $gte: currentDate },
      isListed: true,
      usedBy: { $ne: userId },
    });

    // console.log(coupons)
    console.log(coupons);
    res.json({ coupons });
  } catch (error) {
    console.log("error fetching coupons : ", error);
  }
};

const applyCoupon = async (req, res) => {
  try {
    const couponCode = req.query.couponCode;
    const totalPrice = parseFloat(req.query.totalPrice);
    const userId = req.session.user._id;
    const currentDate = new Date();
    console.log(couponCode, "jg", totalPrice, userId, currentDate);

    const coupon = await couponModel.findOne({
      couponCode: couponCode,
      minAmount: { $lte: totalPrice },
      expiryDate: { $gte: currentDate },
      isListed: true,
      usedBy: { $ne: userId },
    });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid or expired coupon" });
    }
    console.log(coupon);

    const discountAmount = totalPrice * (coupon.discountPercentage / 100);
    const newTotal = totalPrice - discountAmount;
    console.log(discountAmount);
    // coupon.usedBy.push(userId);
    await coupon.save();

    res.json({
      success: true,
      discountAmount: discountAmount.toFixed(2),
      newTotal: newTotal.toFixed(2),
    });
  } catch (error) {
    console.log("Error applying coupon: ", error);
    res.status(500).json({ success: false, message: "Error applying coupon" });
  }
};

// const cancelCoupon = async (req, res) => {
//   try {
//     const userId = req.session.user._id;
//     const userCart = await cartModel.findOne({ userId });
//     const { couponCode } = req.body;

//     console.log(couponCode, userId);
//     console.log(userCart);

//     if (!userCart) {
//       return res.json({ message: "cart not found" });
//     }

//     const coupon = await couponModel.findOne({ couponCode });
//     if (!coupon) {
//       return res.json({ message: "coupon not found or not used by user" });
//     }

//     await coupon.save();
//     const totalPrice = userCart.totalPrice;

//     return res.json({ totalPrice });
//   } catch (error) {
//     console.log("error cancelling coupon", error);
//   }
// };

const cancelCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { couponCode } = req.body;

    const userCart = await cartModel.findOne({ userId });
    if (!userCart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const coupon = await couponModel.findOne({ couponCode });
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // Remove coupon from cart
    await cartModel.updateOne({ userId }, { $unset: { appliedCoupon: "" } });
    // Update coupon usage
    await couponModel.updateOne({ couponCode }, { $inc: { usageCount: -1 } });

    const totalPrice = userCart.totalPrice; // Update logic if needed
    res.json({ totalPrice, message: "Coupon cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling coupon", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//------------------------------------------------------------Search-------------------------------------------------------
// const searchItems = async (req, res) => {
//   try {
//     const searchQuery = req.query.query;

//     if (!searchQuery) {
//       return res.render("searchResults", { searchResults: [] });
//     }

//     const searchResults = await productModel
//       .find({ product_title: { $regex: searchQuery, $options: "i" } })
//       .populate("brand")
//       .populate("category");

//     const categorySearchResults = await productModel
//       .find({ "category.name": { $regex: searchQuery, $options: "i" } })
//       .populate("brand")
//       .populate("category");

//     const allSearchResults = [...searchResults, ...categorySearchResults];

//     res.render("searchResults", { searchResults: allSearchResults });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Error occurred during product search");
//   }
// };

//------------------------------------------------------------wallet-------------------------------------------------------

const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user._id;
    let wallet = await walletModel
      .findOne({ userId: userId })
      .populate("userId");

    const transactions = await transactionModel
      .find({ userId: userId })
      .sort({ date: -1 });

    // console.log("User ID:", userId, "Wallet:", wallet);

    if (!wallet) {
      wallet = new walletModel({
        userId: userId,
        balance: 0,
      });
      await wallet.save();
    }

    res.render("wallet", { wallet, transactions });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

//------------------------------------------------------------razorpay-------------------------------------------------------

const razorpay = new Razorpay({
  key_id: "rzp_test_VBZkWRTmp72VJq",
  key_secret: "wyVAN68dPmDIg1F7iGU3ZGhS",
});

// const createOrder = async (req, res) => {
//   const { amount, paymentDetails } = req.body; // `paymentDetails` contains Razorpay payment response (optional)
//   console.log("Order Amount:", amount);

//   try {
//     if (!paymentDetails) {
//       // Step 1: Create a new order
//       const options = {
//         amount: amount * 100, // Convert to paise
//         currency: "INR",
//         receipt: `receipt_order_${Date.now()}`,
//         payment_capture: 1,
//       };

//       const order = await razorpay.orders.create(options);
//       res.json({
//         success: true,
//         order_id: order.id,
//         amount: order.amount,
//         currency: order.currency,
//       });
//     } else {
//       // Step 2: Handle payment success
//       const { order_id, razorpay_payment_id, razorpay_signature } =
//         paymentDetails;

//       // Update order in the database
//       await orderModel.findOneAndUpdate(
//         { razorpayOrderId: order_id },
//         { status: "Paid", paymentId: razorpay_payment_id }
//       );

//       // Clear the user's cart
//       const a = await cartModel.findOne({ userId: req.session.user._id });
//       console.log(a);

//       res.status(200).json({ message: "Payment confirmed and order updated." });
//     }
//   } catch (error) {
//     console.error("Payment error:", error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while processing payment." });
//   }
// };

// const createOrder = async (req, res) => {
//   const { couponCode, addressID, paymentMethod } = req.body; // Includes Razorpay payment response and address/payment method details
//   const userId = req.session.user._id;
//   console.log(req.body, "body");

//   try {
//     const cart = await cartModel
//       .findOne({ userId: userId })
//       .populate("items.product");
//     if (!cart || cart.length === 0) {
//       return res
//         .status(404)
//         .json({ success: false, message: "No items in cart" });
//       return res
//         .status(404)
//         .json({ success: false, message: "No items in cart" });
//     }

//     console.log(cart, "cart");

//     const address = await addressModel.findOne({ userId });
//     const addresses = address.addressDetails.find(
//       (addr) => addr.id.toString() === addressID
//     );

//     console.log(addresses);

//     const totalPrice = cart.totalPrice;
//     let discountAmount = 0;
//     if (couponCode) {
//       const coupon = await couponModel.findOne({
//         couponCode: couponCode,
//         isListed: true,
//         expiryDate: { $gte: new Date() },
//         usedBy: { $ne: userId },
//       });

//       if (!coupon) {
//         return res
//           .status(404)
//           .json({ success: false, message: "Invalid or expired coupon" });
//       }
//       if (totalPrice < minAmount) {
//         return res.status(400).json({
//           success: false,
//           message: `This coupon requires a minimum order value  .`,
//         });
//       }

//       discountAmount = (totalPrice * discountPercentage) / 100;

//       totalPrice -= discountAmount;
//     }

//     const order = new orderModel({
//       userId: userId,
//       items: cart.items,
//       totalPrice,
//       billingDetails: addresses,
//       paymentMethod: paymentMethod,
//       status: paymentMethod === "razorpay" ? "Pending" : "Delivered",
//       paymentStatus: paymentMethod === "razorpay" ? "Paid" : "Pending",
//     });

//     await order.save();

//     console.log(order, "ooooo");

//     if (paymentMethod === "razorpay") {
//       try {
//         const razorpayOrder = await razorpay.orders.create({
//           amount: totalPrice * 100,
//           currency: "INR",
//           receipt: `receipt_order_${Date.now()}`,
//         });

//         console.log(razorpayOrder.amount);
//         console.log(razorpayOrder);
//         console.log(order._id, "dddds");

//         return res.json({
//           order_id: order._id,
//           amount: razorpayOrder.amount,
//           currency: razorpayOrder.currency,
//           razorpayOrderId: razorpayOrder.id,
//         });
//       } catch (error) {
//         console.log(error);
//       }
//     }

//     // if (!paymentDetails) {
//     //   // Step 1: Create a new Razorpay order
//     //   const options = {
//     //     amount: amount * 100, // Convert to paise
//     //     currency: "INR",
//     //     receipt: `receipt_order_${Date.now()}`,
//     //     payment_capture: 1,
//     //   };

//     //   const order = await razorpay.orders.create(options);
//     //   return res.json({
//     //     success: true,
//     //     order_id: order.id,
//     //     amount: order.amount,
//     //     currency: order.currency,
//     //   });
//     // } else {
//     //   // Step 2: Handle payment success
//     //   const { order_id, razorpay_payment_id, razorpay_signature } =
//     //     paymentDetails;

//     //   // Update Razorpay order status
//     //   await orderModel.findOneAndUpdate(
//     //     { razorpayOrderId: order_id },
//     //     { status: "Paid", paymentId: razorpay_payment_id }
//     //   );

//     //   // Fetch user cart
//     //   const cart = await cartModel
//     //     .findOne({ userId })
//     //     .populate({ path: "items.products", strictPopulate: false });

//     //   if (!cart || cart.items.length === 0) {
//     //     return res.status(400).json({ message: "Your cart is empty." });
//     //   }

//     //   // Fetch selected address
//     //   const addressDoc = await addressModel.findOne({ userId });
//     //   const selectedAddress = addressDoc?.addressDetails.find(
//     //     (address) => address._id.toString() === addressID
//     //   );

//     //   if (!selectedAddress) {
//     //     return res.status(400).json({ message: "Selected address not found." });
//     //   }

//     //   let totalPrice = 0;
//     //   const cartItems = cart.items.map((item) => {
//     //     const price = item.price || 0;
//     //     const quantity = item.quantity || 1;
//     //     totalPrice += price * quantity;

//     //     return {
//     //       product: item.product._id,
//     //       price: price,
//     //       quantity: quantity,
//     //     };
//     //   });

//     //   // Create a new order in the database
//     //   const newOrder = new orderModel({
//     //     userId,
//     //     items: cartItems,
//     //     totalPrice,
//     //     status: "Pending",
//     //     billingDetails: {
//     //       name: selectedAddress.fullName,
//     //       email: selectedAddress.email,
//     //       phno: selectedAddress.number,
//     //       address: selectedAddress.address,
//     //       pincode: selectedAddress.postalCode,
//     //       country: selectedAddress.country,
//     //       state: selectedAddress.state,
//     //       city: selectedAddress.city,
//     //     },
//     //     paymentMethod,
//     //     paymentStatus: "Paid",
//     //   });

//     //   let saveOrder = await newOrder.save();

//     //   if (saveOrder) {
//     //     for (const item of cart.items) {
//     //       const quantity = item.quantity || 1;
//     //       await productModel.findByIdAndUpdate(item.product._id, {
//     //         $inc: { stock: -quantity },
//     //       });
//     //     }
//     //   }

//     //   // Clear the user's cart
//     //   await cartModel.findOneAndDelete({ userId });

//     //   res.status(200).json({
//     //     message: "Order placed successfully and payment confirmed!",
//     //     order: newOrder,
//     //   });
//     // }
//   } catch (error) {
//     console.error("Payment or Order error:", error);
//     res.status(500).json({
//       error: "An error occurred while processing the payment or order.",
//     });
//   }
// };

const createOrder = async (req, res) => {
  const { couponCode, addressID, paymentMethod } = req.body;
  console.log(req.body);
  const userId = req.session?.user?._id;
  console.log("fafdfa");
  try {
    const cart = await cartModel.findOne({ userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      console.log("no itm");

      return res
        .status(404)
        .json({ success: false, message: "No items in the cart" });
    }

    const userAddresses = await addresses.findOne({ userId }, "addressDetails");
    console.log(userAddresses);
    if (!userAddresses) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const address = userAddresses.addressDetails.find(
      (addr) => addr._id.toString() === addressID.toString()
    );

    if (!address) {
      console.log("Invalid address selected");
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
        console.log("no c");

        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired coupon" });
      }

      if (totalPrice < coupon.minAmount) {
        console.log("no asfdfaf");

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

      totalPrice -= discountAmount;

      appliedCoupon = coupon;
    }

    const orderItems = [];
    for (let item of cart.items) {
      console.log(item);

      const product = item.product;
      let itemPrice = product.discountedPrice || product.price;
      let itemDiscount = 0;

      if (product.bestOffer) {
        const offer = await offerModel.findById(product.bestOffer);
        if (offer && offer.discountPercentage) {
          itemDiscount = (itemPrice * offer.discountPercentage) / 100;
          itemPrice -= itemDiscount;
        }
      }

      console.log(item);

      orderItems.push({
        product: product._id,
        price: product.price,
        quantity: item.qty,
        discount: itemDiscount,
        finalPrice: itemPrice,
      });
    }

    const order = new orderModel({
      userId,
      items: orderItems,
      totalPrice,
      billingDetails: address,
      paymentMethod,
      status: paymentMethod === "razorpay" ? "Pending" : "Delivered",
      paymentStatus: paymentMethod === "razorpay" ? "Pending" : "Paid",
      offerApplied: appliedCoupon ? appliedCoupon._id : null,
    });

    await order.save();

    await cartModel.updateOne(
      { userId },
      { $set: { items: [], totalPrice: 0 } }
    );

    if (paymentMethod === "razorpay") {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      const razorpayOrder = await razorpay.orders.create({
        amount: totalPrice * 100,
        currency: "INR",
        receipt: `receipt_order_${order._id}`,
      });
      console.log(razorpayOrder.amount, razorpayOrder.currency);
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

const verifyPayment = async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    order_id,
  } = req.body;

  console.log(req.body, "bb");

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

    const updatedOrder = await orderModel.findOneAndUpdate(
      { _id: order_id },
      {
        paymentStatus: "Paid",
        status: "Pending",
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
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

//------------------------------------------------------------logOut-------------------------------------------------------

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
    res.redirect("/login");
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
  cancelOrder,
  sortProducts,
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
  NotFoundPage,
};
