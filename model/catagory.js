const mongoose = require("mongoose");
const catagorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  isListed: {
    type: Boolean,
    default: true,
  },
});
module.exports = mongoose.model("Category", catagorySchema);
