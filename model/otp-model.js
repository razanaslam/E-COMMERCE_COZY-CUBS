const mongoose = require("mongoose");
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    lowercase: true,
  },
  otp: {
    type: String,
    default: null,
  },
  otpExpiredAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300,
  },
  //   otpLastSend: {
  //     type: Date,
  //     default: Date.now,
  //   },
});
const otpModel = mongoose.model("otpSchema", otpSchema);
module.exports = otpModel;
