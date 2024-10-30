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
  size: {
    type: String,
  },
});
module.exports = mongoose.model("products", productSchema);
