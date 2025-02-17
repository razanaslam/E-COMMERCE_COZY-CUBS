const mongoose = require("mongoose");
const cartSchema = new mongoose.Schema({
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
        default: 0,
      },
      qty: {
        type: Number,
        require: true,
        default: 1,
      },
    },
  ],
  totalPrice: {
    type: Number,
    default: 0,
  },
  couponApplied: { type: Boolean, default: false },
  couponName: { type: String },
  couponDiscount: { type: Number, default: 0 },
});

module.exports = mongoose.model("Cart", cartSchema);
