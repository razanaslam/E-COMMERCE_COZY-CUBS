const mongoose = require("mongoose");
const dayjs = require("dayjs");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    //  success or fail
    type: String,
    required: true,
  },
  type: {
    //  credit or debit
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
    get: function (val) {
      return dayjs(val).format("DD-MM-YYYY");
    },
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
