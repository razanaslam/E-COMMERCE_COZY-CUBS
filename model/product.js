const mongoose = require("mongoose");
const productSchema = new mongoose.Schema({
  image_url: {
    type: [String],
    required: false,
  },

  product_title: {
    type: String,
    required: true,
  },
  full_description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    require: true,
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  isListed: {
    type: Boolean,
    default: true,
  },
  stock: {
    type: Number,
    default: 0,
  },
  inWishlist: {
    type: Boolean,
    default: false,
  },
  bestOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Offer",
    default: null,
  },
  discountedPrice: {
    type: Number,
    default: null,
  },
  name: String,
  price: Number,
  isNewProduct: { type: Boolean, default: false },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});
module.exports = mongoose.model("products", productSchema);
