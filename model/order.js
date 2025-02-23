const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "products",
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      discount: {
        type: Number,
        default: 0,
      },
      discountedPrice: {
        type: Number,
        default: null,
      },
      finalPrice: {
        type: Number,
        required: true,
      },
      itemStatus: {
        type: String,
        enum: [
          "Pending",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
          "Failed",
          "Returned",
        ],
        default: "Pending",
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  billingDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address",
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["razorpay", "COD", "wallet"],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending",
  },
  status: {
    type: String,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Failed",
      "Returned",
    ],
    default: "Pending",
  },
  offerApplied: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Coupon",
    default: null,
  },
  discountApplied: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  couponPrice: { type: Number, default: 0 },
});

module.exports = mongoose.model("Order", orderSchema);
