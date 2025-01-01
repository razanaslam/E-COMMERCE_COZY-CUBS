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
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
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
  console.log("raza");

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
    let stockAdjusted = false;
    const adjustmentMessages = [];

    if (cart && cartItems.length > 0) {
      for (const item of cartItems) {
        if (item.qty > item.product.stock) {
          stockAdjusted = true;
          adjustmentMessages.push(
            `The quantity of ${item.product.name} was adjusted to match available stock.`
          );

          // Adjust the quantity and total price
          const difference = item.qty - item.product.stock;
          item.qty = item.product.stock;
          cart.totalPrice -= difference * item.price;
        }
      }

      if (stockAdjusted) {
        await cart.save(); // Save changes to the cart if adjustments were made
      }
    }

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
    const deliveryCharge = cart.items.price - 50;
    const totalPrice = cart.totalPrice;
    const cartEmpty = req.flash("cartEmpty");
    const addressSuccess = req.flash("addressSuccess");
    const messages = [];
    // let stockMismatch = false;

    // for (const item of cartItems) {
    //   const product = await productModel.findById(item.product._id);
    //   if (item.qty > product.stock) {
    //     stockMismatch = true;
    //     break;
    //   }
    // }

    // if (stockMismatch) {
    //   return res.json({
    //     error: true,
    //     message: "One or more items in your cart exceed the available stock.",
    //   });
    // }

    res.render("checkout", {
      address,
      cartItems,
      totalPrice,
      cartEmpty,
      addressSuccess,
      messages,
      deliveryCharge,
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
    const id = req.params.id;
    const order = orderModel.findById(id);
    res.render("orderPlaced", { order });
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
    const updatedOrder = await orderModel.findByIdAndUpdate(orderId);
    console.log(updatedOrder.totalPrice, "hy total proce");

    if (!updatedOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (updatedOrder.status === "Delivered") {
      updatedOrder.status = "Returned";
    } else {
      updatedOrder.status = "Cancelled";
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
    const { paymentMethod, addressID, couponCode } = req.body;
    console.log(paymentMethod, addressID, couponCode, "where ?");

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
    console.log(couponCode, "couponcode of this");

    if (couponCode) {
      const coupon = await couponModel.findOne({
        couponCode,
        isListed: true,
        expiryDate: { $gte: new Date() },
        usedBy: { $ne: userId },
      });
      console.log(totalPrice, "total price ");
      console.log(
        totalPrice * coupon.discountPercentage,
        "total price * discount "
      );

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
        couponDiscount > coupon.maxDiscountAmount &&
        coupon.discountPercentage <= 0
      ) {
        couponDiscount = coupon.maxDiscountAmount;
      }

      totalPrice -= couponDiscount;
      appliedCoupon = coupon._id;
    }
    console.log(couponDiscount, "coupon ");

    console.log(totalPrice, "total price of coupon");

    const order = new orderModel({
      userId,
      items: orderItems,
      totalPrice: totalPrice,
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

    for (const item of orderItems) {
      await productModel.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
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
    res.status(500).render("errorPage", {
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
    console.log(newPassword, "hy password");

    const newPass = await bcrypt.hash(newPassword, 10);
    console.log(newPass, "new password");

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
    // await couponModel.findByIdAndUpdate(id, { usedBy: userId });
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
    console.log(userCart, "my cart");

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const coupon = await couponModel.findOne({ couponCode });
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    await cartModel.updateOne({ userId }, { $unset: { appliedCoupon: "" } });

    await couponModel.updateOne({ couponCode }, { $inc: { usageCount: -1 } });

    const totalPrice = userCart.totalPrice;
    console.log(totalPrice, "totalprice");

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
  console.log("haloooo");

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

// const getRetryOrder = async (req, res) => {
//   const { orderId } = req.params;

//   try {
//     const order = await orderModel.findById(orderId);

//     if (!order) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Order not found" });
//     }

//     const razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_KEY_SECRET,
//     });

//     const razorpayOrder = await razorpay.orders.create({
//       amount: order.totalPrice * 100, // Convert to paise
//       currency: "INR",
//       receipt: `receipt_order_${order._id}`,
//     });

//     res.status(200).json({
//       success: true,
//       amount: razorpayOrder.amount,
//       currency: razorpayOrder.currency,
//       razorpayOrderId: razorpayOrder.id,
//     });
//   } catch (error) {
//     console.error("Retry order error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// const retryOrder = async (req, res) => {
//   const { orderId } = req.params;

//   try {
//     // Fetch the existing order
//     const existingOrder = await orderModel.findById(orderId);

//     if (!existingOrder || existingOrder.paymentStatus !== "Failed") {
//       return res.status(400).json({
//         success: false,
//         message: "Order not eligible for retry",
//       });
//     }

//     // Razorpay instance
//     const razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_KEY_SECRET,
//     });

//     // Create a new Razorpay order
//     const razorpayOrder = await razorpay.orders.create({
//       amount: existingOrder.totalPrice * 100, // Amount in paisa
//       currency: "INR",
//       receipt: `retry_order_${orderId}`,
//     });

//     // Update the order status to Pending for retry
//     existingOrder.paymentStatus = "Pending";
//     await existingOrder.save();

//     res.status(200).json({
//       success: true,
//       amount: razorpayOrder.amount,
//       currency: razorpayOrder.currency,
//       razorpayOrderId: razorpayOrder.id,
//     });
//   } catch (error) {
//     console.error("Retry order error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error initiating retry",
//     });
//   }
// };

// const reVerifyPayment = async (req, res) => {
//   const {
//     razorpay_payment_id,
//     razorpay_order_id,
//     razorpay_signature,
//     order_id,
//   } = req.body;

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

//     // Update the order payment status and save
//     const updatedOrder = await orderModel.findOneAndUpdate(
//       { _id: order_id },
//       {
//         paymentStatus: "Paid",
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

// const retryOrder = async (req, res) => {
//   try {
//     const orderId = req.params.orderId; // Get the order ID from the URL
//     const order = await Order.findById(orderId);

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     // Create a Razorpay order for retrying payment
//     const razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_KEY_SECRET,
//     });

//     const options = {
//       amount: order.amount * 100, // Razorpay expects amount in paise
//       currency: "INR",
//       receipt: orderId,
//       payment_capture: 1,
//     };

//     const razorpayOrder = await razorpay.orders.create(options);

//     return res.json({
//       order_id: orderId,
//       amount: order.amount,
//       currency: "INR",
//       razorpayOrderId: razorpayOrder.id,
//     });
//   } catch (error) {
//     console.error("Error in retry order:", error);
//     return res.status(500).json({ message: "Failed to retry order" });
//   }
// };

// const reVerifyPayment = async (req, res) => {
//   try {
//     const {
//       razorpay_payment_id,
//       razorpay_order_id,
//       razorpay_signature,
//       order_id,
//     } = req.body;

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature === razorpay_signature) {
//       // Verify the payment and update the order status
//       const order = await Order.findById(order_id);
//       order.payment_status = "success";
//       await order.save();

//       return res.json({ success: true });
//     } else {
//       return res.json({ success: false });
//     }
//   } catch (error) {
//     console.error("Error in payment verification:", error);
//     return res.status(500).json({ message: "Payment verification failed" });
//   }
// };

// const retryOrder = async (req, res) => {
//   try {
//     const orderId = req.params.orderId; // Get the order ID from the URL
//     const order = await Order.findById(orderId);

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" }); // Return JSON here
//     }

//     // Create a Razorpay order for retrying payment
//     const razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY_ID,
//       key_secret: process.env.RAZORPAY_KEY_SECRET,
//     });

//     const options = {
//       amount: order.amount * 100, // Razorpay expects amount in paise
//       currency: "INR",
//       receipt: orderId,
//       payment_capture: 1,
//     };

//     // Attempt to create the Razorpay order
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

// const reVerifyPayment = async (req, res) => {
//   try {
//     const {
//       razorpay_payment_id,
//       razorpay_order_id,
//       razorpay_signature,
//       order_id,
//     } = req.body;

//     // Validate Razorpay signature
//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature === razorpay_signature) {
//       // Verify the payment and update the order status
//       const order = await Order.findById(order_id);

//       if (!order) {
//         return res.status(404).json({
//           message: "Order not found for payment verification",
//         });
//       }

//       order.payment_status = "success";
//       await order.save();

//       return res.json({ success: true });
//     } else {
//       return res.json({ success: false, message: "Signature mismatch" });
//     }
//   } catch (error) {
//     console.error("Error in payment verification:", error);
//     return res.status(500).json({
//       message: "Payment verification failed",
//       error: error.message,
//     });
//   }
// };

const retryOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId; // Get the order ID from the URL
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" }); // Ensure the response is JSON
    }

    // Create a Razorpay order for retrying payment
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log(order);
    const options = {
      amount: order.totalPrice * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: orderId,
      payment_capture: 1,
    };

    // Attempt to create the Razorpay order
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(options);
    } catch (razorpayError) {
      console.error("Razorpay order creation failed:", razorpayError);
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
    console.error("Error in retry order:", error);
    return res.status(500).json({
      message: "Failed to retry order",
      error: error.message,
    });
  }
};

const reVerifyPayment = async (req, res) => {
  try {
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
      // Verify the payment and update the order status
      const order = await Order.findById(order_id);

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

// const orderCancellation = async (req, res) => {
//   const { order_id } = req.body; // Extract the order ID from the request body
//   console.log("Payment cancellation initiated for order:", order_id);

//   try {
//     // Check if the order exists
//     const order = await orderModel.findById(order_id);
//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found",
//       });
//     }

//     // Update the order status to "Failed"
//     order.paymentStatus = "Failed";
//     order.status = "Failed"; // Mark the order as canceled
//     await order.save();

//     // Optional: Restore the cart if payment fails
//     const userId = order.userId;
//     if (userId) {
//       const cart = await cartModel.findOne({ userId });
//       if (cart) {
//         for (const item of order.items) {
//           // Add items back to the cart
//           await cartModel.updateOne(
//             { userId },
//             {
//               $push: {
//                 items: {
//                   product: item.product,
//                   qty: item.quantity,
//                 },
//               },
//               $inc: { totalPrice: item.price * item.quantity },
//             }
//           );
//         }
//       }
//     }

//     return res.redirect("/order-confirmed");
//   } catch (error) {
//     console.error("Payment cancellation error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error during payment cancellation",
//     });
//   }
// };

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
// const downloadInvoice = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const order = await orderModel.findById(id).populate("items.product");
//     if (!order) {
//       return res.status(404).send("Order not found");
//     }

//     const doc = new PDFDocument({ margin: 30 });

//     const filePath = path.join(
//       __dirname,
//       "downloads",
//       `invoice-${order._id}.pdf`
//     );
//     const writeStream = fs.createWriteStream(filePath);
//     doc.pipe(writeStream);

//     // Heading: Project Name "CozyCubs"
//     doc
//       .fontSize(24)
//       .font("Helvetica-Bold")
//       .text("CozyCubs", { align: "center" })
//       .moveDown(0.5);

//     // Address and contact details
//     doc
//       .fontSize(10)
//       .font("Helvetica")
//       .text("Edapally, Kochi, Kerala, 217231", { align: "center" })
//       .text("Phone: +91 89893927433 | Email: support@eyevogue.com", {
//         align: "center",
//       });

//     doc.moveDown(1.5);

//     // Order Details Section
//     doc
//       .fontSize(12)
//       .font("Helvetica-Bold")
//       .text("Order Details:", { underline: true })
//       .moveDown(0.5);

//     doc
//       .font("Helvetica")
//       .text(`Order Number: ${order._id}`)
//       .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`)
//       .text(`Customer: ${order.billingAddress.name}`)
//       .text(
//         `Address: ${order.billingAddress.address}, ${order.billingAddress.city}, ${order.billingAddress.state}, ${order.billingAddress.country} - ${order.billingAddress.pincode}`
//       );

//     doc.moveDown(1);

//     // Product Table Header
//     const tableTop = doc.y;
//     const tableMarginLeft = 50;

//     doc
//       .fontSize(12)
//       .font("Helvetica-Bold")
//       .text("Product", tableMarginLeft, tableTop, { width: 200, align: "left" })
//       .text("Quantity", tableMarginLeft + 220, tableTop, {
//         width: 80,
//         align: "center",
//       })
//       .text("Price", tableMarginLeft + 320, tableTop, {
//         width: 80,
//         align: "center",
//       })
//       .text("Total", tableMarginLeft + 420, tableTop, {
//         width: 80,
//         align: "center",
//       });

//     // Line Separator for Table Header
//     doc
//       .moveTo(tableMarginLeft, tableTop + 15)
//       .lineTo(550, tableTop + 15)
//       .stroke();

//     let yPosition = tableTop + 25;

//     // Loop through products and add product details in the table
//     order.items.forEach((item) => {
//       const productName = item.product
//         ? item.product.name
//         : "Product not found";
//       doc
//         .fontSize(10)
//         .font("Helvetica")
//         .text(productName, tableMarginLeft, yPosition, {
//           width: 200,
//           align: "left",
//         })
//         .text(item.quantity, tableMarginLeft + 220, yPosition, {
//           width: 80,
//           align: "center",
//         })
//         .text(`Rs ${item.price.toFixed(2)}`, tableMarginLeft + 320, yPosition, {
//           width: 80,
//           align: "center",
//         })
//         .text(
//           `Rs ${(item.price * item.quantity).toFixed(2)}`,
//           tableMarginLeft + 420,
//           yPosition,
//           { width: 80, align: "center" }
//         );
//       yPosition += 20;
//     });

//     yPosition += 10;

//     // Line Separator for Footer
//     const subtotal =
//       order.totalPrice - order.gstAmount - (order.deliveryCharge || 0);
//     doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke().moveDown(0.5);

//     // Footer Details: Subtotal, GST, Delivery Charge, Discount, Total
//     yPosition += 15;
//     doc
//       .fontSize(12)
//       .font("Helvetica")
//       .text(`Subtotal:`, 400, yPosition, { align: "left" })
//       .text(`Rs ${subtotal.toFixed(2)}`, 480, yPosition, { align: "right" });

//     yPosition += 20;
//     doc
//       .text(`GST (18%):`, 400, yPosition, { align: "left" })
//       .text(`Rs ${order.gstAmount.toFixed(2)}`, 480, yPosition, {
//         align: "right",
//       });

//     if (order.deliveryCharge) {
//       yPosition += 20;
//       doc
//         .text(`Delivery Charges:`, 400, yPosition, { align: "left" })
//         .text(`Rs ${order.deliveryCharge.toFixed(2)}`, 480, yPosition, {
//           align: "right",
//         });
//     }

//     yPosition += 20;
//     doc
//       .text(`Discount:`, 400, yPosition, { align: "left" })
//       .text(
//         `Rs ${order.discount ? order.discount.toFixed(2) : "0.00"}`,
//         480,
//         yPosition,
//         { align: "right" }
//       );

//     yPosition += 20;
//     doc
//       .font("Helvetica-Bold")
//       .text(`Total:`, 400, yPosition, { align: "left" })
//       .text(`Rs ${order.totalPrice.toFixed(2)}`, 480, yPosition, {
//         align: "right",
//       });

//     yPosition += 30;

//     doc.end();

//     writeStream.on("finish", () => {
//       res.download(filePath, `invoice-${order._id}.pdf`, (err) => {
//         if (err) {
//           console.error("Error downloading the invoice:", err);
//         }
//         fs.unlinkSync(filePath);
//       });
//     });

//     writeStream.on("error", (err) => {
//       console.error("Error writing PDF:", err);
//       res.status(500).send("Error generating the invoice.");
//     });
//   } catch (error) {
//     console.error("Error fetching order or generating invoice:", error);
//     res.status(500).send("Internal server error.");
//   }
// };

const downloadInvoice = async (req, res) => {
  const { orderId } = req.params;

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

      if (billingAddress) {
        order.billingDetails = { ...billingAddress.toObject() };
      } else {
        order.billingDetails = null;
      }
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const filePath = path.join("Downloads", `invoice-${order._id}.pdf`);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const drawLine = (y) => {
      doc.moveTo(50, y).lineTo(550, y).stroke("#D3D3D3");
    };

    // doc.image("path/to/logo.png", 50, 45, { width: 50 });
    doc.fontSize(20).font("Helvetica-Bold").text("CozyCubs", 120, 50);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Edapally, Kochi, Kerala, 217231", 120, 75);
    doc.text("Phone: +91 89893927433 | Email: support@cozyCubs.com", 120, 90);
    drawLine(110);

    doc.fontSize(16).font("Helvetica-Bold").text("INVOICE", 250, 130);

    const detailsTop = 150;
    doc.rect(50, detailsTop, 240, 100).fill("#F0F0F0");
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Order Details", 60, detailsTop + 10);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("black")
      .text(`Order Number: ${order._id}`, 60, detailsTop + 30)
      .text(
        `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
        60,
        detailsTop + 50
      );

    doc.rect(310, detailsTop, 240, 100).fill("#F0F0F0");
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Billing Details", 320, detailsTop + 10);

    if (order.billingDetails) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("black")
        .text(`${order.billingDetails.fullName}`, 320, detailsTop + 30)
        .text(`${order.billingDetails.email}`, 320, detailsTop + 45)
        .text(
          `${order.billingDetails.city}, ${order.billingDetails.state}, ${order.billingDetails.postalCode}`,
          320,
          detailsTop + 60
        )
        .text(`${order.billingDetails.country}`, 320, detailsTop + 75);
    } else {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("black")
        .text("No billing details available", 320, detailsTop + 30);
    }

    drawLine(260);

    const tableTop = 280;
    doc.fillColor("black").fontSize(12).font("Helvetica-Bold");
    const headers = ["Product Name", "Qty", "Price", "Total"];
    const cols = [50, 250, 320, 420];

    headers.forEach((header, i) => {
      doc.text(header, cols[i], tableTop, { width: 100, align: "left" });
    });

    drawLine(tableTop + 15);

    let currentY = tableTop + 25;
    doc.fontSize(10).font("Helvetica");

    order.items.forEach((item) => {
      const data = [
        item.product.product_title,
        item.quantity.toString(),
        `₹${item.price.toFixed(2)}`,
        `₹${(item.quantity * item.price).toFixed(2)}`,
      ];
      data.forEach((value, index) => {
        doc.text(value, cols[index], currentY, { width: 100, align: "left" });
      });
      currentY += 20;
    });

    drawLine(currentY);

    currentY += 10;
    doc.fontSize(12).font("Helvetica-Bold").text("Summary:", 350, currentY);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Subtotal: ₹${order.totalPrice.toFixed(2)}`, 350, currentY + 15);
    doc.text(
      `Discount Applied: ₹${order.discountApplied.toFixed(2)}`,
      350,
      currentY + 30
    );
    doc
      .font("Helvetica-Bold")
      .text(
        `Total: ₹${(order.totalPrice - order.discountApplied).toFixed(2)}`,
        350,
        currentY + 45
      );

    const footerY = doc.page.height - 50;
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Thank you for your purchase!", 50, footerY, {
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

    // Pass the variables as an object
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
};
