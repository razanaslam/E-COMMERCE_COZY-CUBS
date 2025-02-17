const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  googleId: {
    type: String,
  },
  number: {
    type: String,
  },
  password: {
    type: String,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  referalCode: {
    type: String,
  },
});
module.exports = mongoose.model("User", userSchema);
