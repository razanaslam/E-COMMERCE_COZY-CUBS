const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  couponCode: {
    required: true,
    type: String,
    unique: true,
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  expiryDate: {
    type: Date,
  },
  isListed: {
    type: Boolean,
    default: true,
  },
  usedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  maxDiscountAmount: {
    type: Number,
    min: 0,
  },
  minAmount: {
    type: Number,
    min: 0,
  },
  description: {
    type: String,
  },
  isApplied: { type: Boolean, default: false },
});

module.exports = mongoose.model("Coupon", couponSchema);
