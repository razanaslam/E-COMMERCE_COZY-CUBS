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
      const erroremail = req.flash("errorEmail");
      const errorPassword = req.flash("errorPassword");

      res.render("register", { erroremail, errorPassword });
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
  //this section is use for both registreation otp ad for change forgot password
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

const loadHome = (req, res) => {
  try {
    res.render("home");
  } catch (error) {
    console.log(error);
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
    const product = await productModel.find();
    res.render("productList", { product });
  } catch (error) {
    console.log(error);
  }
};

//------------------------------------------------------------product Details-------------------------------------------------------

const loadProductDetails = async (req, res) => {
  try {
    const id = req.params.id;

    const product = await productModel
      .findById(id)
      .populate("category", "name")
      .populate("brand", "name");
    res.render("product_details", { product });
  } catch (error) {
    console.log(error);
  }
};

//------------------------------------------------------------cart Details-------------------------------------------------------

const loadCart = async (req, res) => {
  try {
    res.render("cart");
  } catch (error) {
    console.log(error);
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
    });
  } catch (error) {
    console.log(error);
  }
};

const accountDetails = async (req, res) => {
  try {
    const { name, number } = req.body;
    const id = req.session.user._id;
    const user = await userModel.findById(id);
    if (user) {
      user.name = name;
      user.number = number;
      await user.save();
      req.flash("success", "successfully changed");
      res.redirect("/accountDetails");
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
      req.flash("errorPassword", "Incorrect current password.");
      return res.redirect("/accountDetails");
    }

    if (newPassword !== confirmPassword) {
      req.flash(
        "errorPassword",
        "New password and confirm password do not match."
      );
      return res.redirect("/accountDetails");
    }

    const newPass = await bcrypt.hash(newPassword, 10);

    const userdata = await userModel.findByIdAndUpdate(
      id,
      { $set: { password: newPass } },
      { new: true }
    );

    if (userdata) {
      req.flash("successPass", "Password changed successfully.");
      return res.redirect("/accountDetails");
    }
  } catch (error) {
    req.flash(
      "errorPassword",
      "An error occurred while changing the password."
    );
    res.redirect("/accountDetails");
  }
};

const loadAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const address = await addressModel.findOne({ userId });
    const success = req.flash("success");
    const error = req.flash("error");
    const addressSuccess = req.flash("addressSuccess");
    res.render("address", { success, address, error, addressSuccess });
  } catch (error) {
    console.log(error);
  }
};
// const addAddress = async (req, res) => {
//   try {
//     const id = req.session.user._id;
//     const {
//       fullName,

//       city,
//       state,
//       postalCode,
//       country,
//       number,
//       email,
//     } = req.body;

//     let userAddress = await addressModel.findById(id);
//     if (!userAddress) {
//       userAddress = new addressModel({
//         userId: id,
//         address: [fullName, city, state, postalCode, country, number, email],
//       });
//     } else {
//       userAddress.address.push({
//         fullName,
//         address,
//         city,
//         state,
//         postalCode,
//         country,
//         number,
//         email,
//       });
//     }
//     await userAddress.save();
//     res.redirect("/address");
//   } catch (error) {
//     console.log(error);
//   }
// };
const addAddress = async (req, res) => {
  try {
    const id = req.session.user._id;
    const { fullName, email, number, country, postalCode, state, city } =
      req.body;
    console.log("id:", id);

    let userAddress = await addressModel.findOne({ userId: id });
    console.log("useraddress :", userAddress);

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
    console.log(userAddress);
    await userAddress.save();
    req.flash("success", "address is added successfully");
    return res.redirect("/userAddress");
  } catch (error) {
    req.flash("error", "Failed to add address. Please try again.");
    return res.redirect("/userAddress");
  }
};

const editAddress = async (req, res) => {
  try {
    const userId = req.params._id; // User ID from the URL parameter
    const addressId = req.body.addressId; // Get address ID from request body
    const { fullName, email, number, country, postalCode, state, city } =
      req.body;

    await addressModel.updateOne(
      { userId: userId, "addressDetails._id": addressId }, // Use addressId to find the specific address
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
    res.redirect("/userAddress");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.params._id; // User ID from the URL parameter
    const addressId = req.body.addressId; // Get address ID from request body

    await addressModel.updateOne(
      { userId: userId },
      {
        $pull: { addressDetails: { _id: addressId } }, // Use $pull to remove the address by addressId
      }
    );

    req.flash("addressSuccess", "Address deleted successfully");
    res.redirect("/userAddress");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
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
};
