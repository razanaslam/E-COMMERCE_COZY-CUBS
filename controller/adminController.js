const bcrypt = require("bcrypt");
const crypto = require("crypto");
const catagoryModel = require("../model/catagory");
const multer = require("multer");
const path = require("path");
const brandModel = require("../model/brand");
const productModel = require("../model/product");
// const product = require("../model/product");
const userModel = require("../model/userModel");
const { session } = require("passport");
// const cloudinary = require("cloudinary").v2;
const orderModel = require("../model/order");
const couponModel = require("../model/coupon");
const walletModel = require("../model/wallet");
const transactionModel = require("../model/transaction");
const offerModel = require("../model/offer");
const catagory = require("../model/catagory");
const addressModel = require("../model/address");
const dayjs = require("dayjs");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const moment = require("moment");
//---------------------------------------------------------------multer----------------------------------------------------------

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "" + Date.now() + "" + file.originalname);
  },
});

let upload = multer({
  storage: storage,
}).array("image_url", 10);

//---------------------------------------------------------------login of Admin----------------------------------------------------------

const loadLogin = (req, res) => {
  try {
    // console.log("haiii");
    if (req.session.admin) {
      res.redirect("/admin/dashboard");
    } else {
      const loginError = req.flash("loginError");
      res.render("adminLogin", { loginError });
    }
  } catch (error) {
    console.log(error);
  }
};

const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // const isMatch = await bcrypt.compare(password, process.env.adminPass);
    if (
      email !== process.env.adminEmail ||
      password !== process.env.adminPass
    ) {
      req.flash("loginError", "Invalid email or password ");
      return res.redirect("/admin");
    }
    req.session.admin = email;
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.log("Error during login:", error);
    req.flash("loginError", "Something went wrong, please try again.");
    res.redirect("/login");
  }
};

//---------------------------------------------------------------Dashboard----------------------------------------------------------

const loadDashboard = async (req, res) => {
  try {
    const { timeRange, startDate, endDate } = req.query;
    let startDateTime, endDateTime;

    switch (timeRange) {
      case "weekly":
        startDateTime = moment().startOf("week");
        endDateTime = moment().endOf("week");
        break;
      case "monthly":
        startDateTime = moment().startOf("month");
        endDateTime = moment().endOf("month");
        break;
      case "yearly":
        startDateTime = moment().startOf("year");
        endDateTime = moment().endOf("year");
        break;
      case "custom":
        startDateTime = moment(startDate);
        endDateTime = moment(endDate);
        break;
      default:
        startDateTime = moment().startOf("day");
        endDateTime = moment().endOf("day");
    }

    // Order status distribution
    const orderStatusDistribution = await orderModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDateTime.toDate(),
            $lte: endDateTime.toDate(),
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Top 10 categories
    const topCategories = await orderModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDateTime.toDate(),
            $lte: endDateTime.toDate(),
          },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo._id",
          name: { $first: "$categoryInfo.name" },
          totalSales: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
    ]);

    // Top 10 products
    const topProducts = await orderModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDateTime.toDate(),
            $lte: endDateTime.toDate(),
          },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo._id",
          name: { $first: "$productInfo.product_title" },
          totalSales: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
    ]);
    console.log(topProducts);

    res.render("dashboard", {
      orderStatusDistribution: JSON.stringify(orderStatusDistribution),
      topCategories: JSON.stringify(topCategories),
      topProducts: JSON.stringify(topProducts),
      timeRange,
      startDate: startDateTime.format("YYYY-MM-DD"),
      endDate: endDateTime.format("YYYY-MM-DD"),
    });
  } catch (error) {
    console.error("Error in loadDashboard:", error);
    res.status(500).render("error", {
      message: "An error occurred while loading the dashboard",
    });
  }
};

//---------------------------------------------------------------Product---------------------------------------------------------------

// const loadProductList = async (req, res) => {
//   try {
//     const products = await productModel.find();
//     res.render("productsList", { products });
//   } catch (error) {
//     console.log(error);
//   }
// };

const loadProductList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const products = await productModel.find().skip(skip).limit(limit);
    const totalProducts = await productModel.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("productsList", {
      products,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while loading products.");
  }
};

const loadAddProduct = async (req, res) => {
  try {
    const category = await catagoryModel.find();
    const brand = await brandModel.find();
    const error = req.flash("error");
    const success = req.flash("success");
    res.render("addProduct", { category, brand, error, success });
  } catch (error) {
    console.log(error);
  }
};

const addProduct = async (req, res) => {
  try {
    // Check if files are uploaded

    // Get other form data
    // console.log("Image URL:", req.body.image_url);
    // console.log("hy");
    const {
      product_title,
      full_description,
      price,
      category,
      brand,
      tax_rate,
      stock,
      size,

      // image_url,
    } = req.body;
    // console.log("Image URL:", req.body.image_url);

    const existingProduct = await productModel.findOne({ product_title });
    if (existingProduct) {
      req.flash("error", "Product already exists");
      return res.redirect("/admin/addProduct");
    }

    const images = req.files.map((file) => file.filename);
    console.log(images, "imgs");

    const newProduct = new productModel({
      product_title,
      full_description,
      price,
      category,
      brand,
      tax_rate,
      stock,
      size,
      image_url: images,
    });
    await newProduct.save();
    req.flash("success", "Product added successfully");

    // console.log(newProduct);
    res.redirect("/admin/productsList");
  } catch (error) {
    console.log(error.message);
    // res.status(500).send("Error uploading images");
  }
};

const loadEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    // console.log(id, "iiiiiiiiidddd");

    const product = await productModel
      .findById(id)
      .populate("category", "name");

    const category = await catagoryModel.find();
    // console.log(category, "caaatttt");
    // console.log(product);
    const brand = await brandModel.find();

    if (!category || !brand) {
      return res.status(404).send("Category or brand data not found");
    }

    if (!product) {
      return res.status(404).send("Product not found");
    }
    // const error = req.flash("error");
    res.render("editProduct", { product, category, brand });
  } catch (error) {
    console.log(error);
  }
};

const editProduct = async (req, res) => {
  const id = req.params.id;
  try {
    const {
      product_title,
      full_description,
      price,
      category,
      brand,
      tax_rate,
      stock,
      size,
      // image_url,
    } = req.body;
    // console.log("hy razz");

    const newImages = req.files.map((file) => file.filename);
    console.log(newImages, "juhuhjh");

    const existingProduct = await productModel.findById(id);

    if (!existingProduct) {
      return res.status(404).send("Product not found");
    }

    const combinedImages =
      newImages.length > 0
        ? [...existingProduct.image_url, ...newImages]
        : existingProduct.image_url;

    const updatedImages = combinedImages.slice(-3);

    await productModel.findByIdAndUpdate(id, {
      product_title,
      full_description,
      price,
      category,
      brand,
      tax_rate,
      stock,
      size,
      image_url: updatedImages,
    });

    // await newProduct.save();
    // console.log(newProduct);
    res.redirect("/admin/productsList");
  } catch (error) {
    console.log(error);
  }
};

const deleteProductImage = async (req, res) => {
  console.log("hy");
  const { id, filename } = req.params;

  try {
    const product = await productModel.findById(id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const updatedImages = product.image_url.filter((img) => img !== filename);

    await productModel.findByIdAndUpdate(id, { image_url: updatedImages });

    // return res.json({ success: true, message: "Image deleted successfully" });
    // res.redirect("/admin/editProduct");
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the image",
    });
  }
};

const listProduct = async (req, res) => {
  try {
    const id = req.params.id;
    await productModel.findByIdAndUpdate(id, {
      isListed: true,
    });
    await productModel.save;
    res.redirect("/admin/productsList");
  } catch (error) {
    console.log(error);
  }
};

const unlistProduct = async (req, res) => {
  try {
    const id = req.params.id;
    await productModel.findByIdAndUpdate(id, {
      isListed: false,
    });
    await productModel.save;
    res.redirect("/admin/productsList");
  } catch (error) {
    console.log(error);
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    await productModel.findByIdAndDelete(id);
    res.redirect("/admin/productsList");
  } catch (error) {
    console.log(error);
  }
  // res.status(500).send("Error deleting product");
};

const isNew = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }
    product.isNewProduct = !product.isNewProduct;
    await product.save();
    return res.status(200).json({
      status: "success",
      message: `Product ${product.product_title} status updated successfully.`,
    });
  } catch (error) {
    console.error("Error toggling isNewProduct:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update product status.",
    });
  }
};
//---------------------------------------------------------------Category----------------------------------------------------------

const loadCatagory = async (req, res) => {
  try {
    const catagory = await catagoryModel.find();
    res.render("catagory", { catagory });
  } catch (error) {
    console.log(error);
  }
};

const loadEditCatagory = async (req, res) => {
  try {
    const id = req.params.id;
    const category = await catagoryModel.findById(id);
    res.render("editCatagory", { category });
  } catch (error) {
    console.log(error);
  }
};

const loadAddCatagory = async (req, res) => {
  try {
    const catagErr = req.flash("catagError");
    const success = req.flash("success");
    console.log("catagErr:", catagErr, "success:", success);

    res.render("addCatagory", { catagErr: catagErr[0], success: success[0] });
  } catch (error) {
    console.log(error);
  }
};

const addCatagory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const existCatag = await catagoryModel.findOne({ name });
    console.log(req.body);
    if (existCatag) {
      req.flash("catagError", "Catagory is already existed");
      return res.redirect("/admin/addCatagory");
    }
    const newCatagory = new catagoryModel({
      name,
      description,
    });
    await newCatagory.save();
    req.flash("success", "Product added successfully");
    res.redirect("/admin/catagory");
  } catch (error) {
    console.log(error);
  }
};

const editCatagory = async (req, res) => {
  try {
    console.log(req.params.id);
    const id = req.params.id;
    const { name, description } = req.body;
    // console.log(name, category);
    // console.log("my id is", id);
    await catagoryModel.findByIdAndUpdate(id, {
      name,
      description,
    });
    res.redirect("/admin/catagory");
  } catch (error) {
    console.log(error);
  }
};

const listCategory = async (req, res) => {
  try {
    const id = req.params.id;
    await catagoryModel.findByIdAndUpdate(id, { isListed: true });
    res.redirect("/admin/catagory");
  } catch (error) {
    console.log(error);
  }
};

const unlistCategory = async (req, res) => {
  try {
    const id = req.params.id;
    await catagoryModel.findByIdAndUpdate(id, { isListed: false });
    res.redirect("/admin/catagory");
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------Brand----------------------------------------------------------

const loadBrand = async (req, res) => {
  try {
    const brand = await brandModel.find();
    res.render("brand", { brand });
  } catch (error) {
    console.log(error);
  }
};

const loadAddBrand = async (req, res) => {
  try {
    const brandError = req.flash("brandError");
    const success = req.flash("success");
    res.render("addBrand", { brandError, success });
  } catch (error) {
    console.log(error);
  }
};

const addBrand = async (req, res) => {
  const { name, description } = req.body;
  console.log(req.body);

  try {
    const existBrand = await brandModel.findOne({ name });
    if (existBrand) {
      req.flash("brandError", "Already Existed");
      return res.redirect("/admin/addBrand");
    }
    const newBrand = new brandModel({
      name,
      description,
    });
    await newBrand.save();
    req.flash("success", "Brand added successfully");
    res.redirect("/admin/brand");
  } catch (error) {
    console.log(error);
  }
};

const loadEditBrand = async (req, res) => {
  try {
    const id = req.params.id;
    const brand = await brandModel.findById(id);
    res.render("editBrand", { brand });
  } catch (error) {
    console.log(error);
  }
};

const editBrand = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;
    await brandModel.findByIdAndUpdate(id, {
      name,
      description,
    });
    res.redirect("/admin/brand");
  } catch (error) {
    console.log(error);
  }
};

const listBrand = async (req, res) => {
  try {
    const id = req.params.id;
    const brand = await brandModel.findByIdAndUpdate(id, { isListed: true });
    console.log(brand);
    await brand.save();
    res.redirect("/admin/brand");
  } catch (error) {
    console.log(error);
  }
};

const unlistBrand = async (req, res) => {
  try {
    const id = req.params.id;
    console.log(id);
    await brandModel.findByIdAndUpdate(id, { isListed: false });
    res.redirect("/admin/brand");
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------UserList----------------------------------------------------------

// const loadUser = async (req, res) => {
//   try {
//     const user = await userModel.find();
//     res.render("userList", { user });
//   } catch (error) {
//     console.log(error);
//   }
// };

const loadUser = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const user = await userModel.find().skip(skip).limit(limit);
    const totalUsers = await userModel.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    res.render("userList", {
      user,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while loading users.");
  }
};

const blockUser = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await userModel.findByIdAndUpdate(id, { isBlocked: true });
    await user.save();
    res.redirect("/admin/userList");
  } catch (error) {
    console.log(error);
  }
};

const unblockUser = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await userModel.findByIdAndUpdate(id, { isBlocked: false });
    await user.save();
    res.redirect("/admin/userList");
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------orders----------------------------------------------------------

// const loadOrder = async (req, res) => {
//   try {
//     const order = await orderModel.find();
//     console.log(order);

//     res.render("orders", { order });
//   } catch (error) {
//     console.log(error.message);
//   }
// };
const loadOrder = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const orders = await orderModel
      .find()
      .skip(skip)
      .limit(limit)
      .populate("items.product")
      .lean();

    const updatedOrders = await Promise.all(
      orders.map(async (order) => {
        if (order.billingDetails) {
          const address = await addressModel.findOne({ userId: order.userId });

          if (address && address.addressDetails.length > 0) {
            const billingAddress = address.addressDetails.find(
              (addr) => addr._id.toString() === order.billingDetails.toString()
            );

            if (billingAddress) {
              order.billingDetails = { ...billingAddress.toObject() };
            } else {
              order.billingDetails = null;
            }
          } else {
            order.billingDetails = null;
          }
        }
        return order;
      })
    );

    const totalOrders = await orderModel.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders", {
      order: updatedOrders,
      currentPage: page,
      totalPages,
      limit,
      maxPagesToShow: 5,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("An error occurred while loading orders.");
  }
};

const loadadminOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await orderModel
      .findById(orderId)
      .populate("items.product")
      .lean();

    console.log(orderId, "Order details:", order);

    if (order.billingDetails) {
      const address = await addressModel.findOne({ userId: order.userId });

      if (address && address.addressDetails.length > 0) {
        const billingAddress = address.addressDetails.find(
          (addr) => addr._id.toString() === order.billingDetails.toString()
        );

        if (billingAddress) {
          order.billingDetails = { ...billingAddress.toObject() };
        } else {
          order.billingDetails = null;
        }
      } else {
        order.billingDetails = null;
      }
    }
    console.log(order);

    res.render("adminOrderDetails", { order });
  } catch (error) {
    console.error("Error fetching admin order details:", error.message);
    res.status(500).send("An error occurred while loading the order details.");
  }
};

// const adminCancelOrder = async (req, res) => {

//   try {
//     const orderId = req.params.id;
//     const updatedOrder = await orderModel.findByIdAndUpdate(
//       orderId,
//       { status: "Cancelled" },
//       { new: true }
//     );

//     if (!updatedOrder) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Order not found" });
//     }

//     for (const item of updatedOrder.items) {
//       await productModel.findByIdAndUpdate(item.product, {
//         $inc: { stock: item.quantity },
//       });
//     }

//     res.json({
//       success: true,
//       message: "Order cancelled successfully",
//       order: updatedOrder,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       success: false,
//       message: "An error occurred while cancelling the order",
//     });
//   }
// };

const adminUpdateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { status } = req.body;
    console.log(orderId, status);
    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: "Status is required" });
    }

    const order = await orderModel.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (status === "Cancelled") {
      const refundAmount = order.totalPrice;

      if (!refundAmount || isNaN(refundAmount) || refundAmount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid refund amount" });
      }

      for (const item of order.items) {
        await productModel.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });
      }

      let wallet = await walletModel.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = new walletModel({
          userId: order.userId,
          balance: 0,
        });
        await wallet.save();
      }

      wallet.balance += refundAmount;
      await wallet.save();

      const transaction = new transactionModel({
        userId: order.userId,
        amount: refundAmount,
        status: "Success",
        type: "Credited",
      });
      await transaction.save();
    }
    if (status === "Delivered") {
      if (order.paymentStatus !== "Paid") {
        order.paymentStatus = "Paid";
      }
    }

    order.status = status;
    await order.save();

    res.json({ success: true, message: "Order status updated successfully." });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the order status.",
    });
  }
};

const verifyReturn = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { approval } = req.body;

    if (approval === "Approved") {
      const order = await orderModel.findById(orderId);
      const userId = order.userId;
      const wallet = await walletModel.findOne({ userId: userId });

      for (const item of order.items) {
        const product = await productModel.findById(item.product._id);

        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }

      const refundAmount = order.totalPrice;
      wallet.balance += refundAmount;
      await wallet.save();

      order.status = "Returned";
      order.returnStatus = "Approved";
      await order.save();

      const transaction = new transactionModel({
        userId: userId,
        amount: order.totalPrice,
        status: "Success",
        type: "Credited",
      });
      await transaction.save();
    } else if (approval === "Rejected") {
      const order = await orderModel.findById(orderId);
      order.returnStatus = "Rejected";
      await order.save();
    }

    return res.redirect("/order");
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------coupons----------------------------------------------------------

const loadCoupons = async (req, res) => {
  try {
    const coupons = await couponModel.find();
    res.render("coupons", { coupons });
  } catch (error) {
    console.log(error);
  }
};

const loadAddCoupons = async (req, res) => {
  try {
    res.render("addCoupons");
  } catch (error) {
    console.log(error);
  }
};

const addCoupons = async (req, res) => {
  const {
    couponCode,
    discountPercentage,
    maxDiscountAmount,
    minAmount,
    expiryDate,
    description,
  } = req.body;

  try {
    const existCoupon = await couponModel.findOne({ couponCode });
    console.log(req.body, "hy", existCoupon);
    if (existCoupon) {
      req.flash("existed", "Coupon is already existed");
      return res.redirect("/admin/addCoupons");
    }
    const newCoupons = new couponModel({
      couponCode,
      discountPercentage,
      maxDiscountAmount,
      minAmount,
      expiryDate,
      description,
    });
    await newCoupons.save();
    req.flash("success", "coupon added successfully");
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);
  }
};

const deleteCoupons = async (req, res) => {
  try {
    const id = req.params.id;
    await couponModel.findByIdAndDelete(id);
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);
  }
};

const listCoupons = async (req, res) => {
  try {
    const id = req.params.id;
    const coupon = await couponModel.findByIdAndUpdate(id, { isListed: true });
    coupon.save();
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);
  }
};

const unlistCoupons = async (req, res) => {
  try {
    const id = req.params.id;
    const coupon = await couponModel.findByIdAndUpdate(id, { isListed: false });
    coupon.save();
    res.redirect("/admin/coupons");
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------offers----------------------------------------------------------
const loadOffers = async (req, res) => {
  try {
    const offers = await offerModel.find();
    res.render("offer", { offers });
  } catch (error) {
    console.log(error);
  }
};

const loadAddOffer = async (req, res) => {
  try {
    const products = await productModel.find();
    const categories = await catagoryModel.find();
    res.render("addoffers", { products, categories });
  } catch (error) {
    console.log(error);

    res.status(500).send("Server Error");
  }
};

// const insertOffer = async (req, res) => {
//   try {
//     const {
//       offerName,
//       offerType,
//       discountPercentage,
//       startDate,
//       endDate,
//       applicableProducts,
//       applicableCategories,
//     } = req.body;

//     const offer = new Offer({
//       offerName,
//       offerType,
//       discountPercentage,
//       startDate,
//       endDate,
//       applicableProducts,
//       applicableCategories,
//     });

//     const offerAdded = await offer.save();
//     const percentage = offerAdded.discountPercentage;
//     if (offerAdded.offerType === "product") {
//       for (const product of offerAdded.applicableProducts) {
//         let productOffer = await productModel.findById(product);
//         if (productOffer) {
//           productOffer.isDiscounted = true;
//           productOffer.offerId = offerAdded._id;
//           productOffer.offerPercentage = percentage;
//           await productOffer.save();
//         }
//       }
//     } else {
//       for (const category of offerAdded.applicableCategories) {
//         let categoryProducts = await Product.find({ category });
//         for (const productOffer of categoryProducts) {
//           productOffer.isDiscounted = true;
//           productOffer.offerId = offerAdded._id;
//           productOffer.offerPercentage = percentage;
//           await productOffer.save();
//         }
//       }
//     }

//     if (offerAdded) res.redirect("/offer");
//   } catch (error) {
//     console.log(error);
//   }
// };

const createOffers = async (req, res) => {
  const {
    offerName,
    offerType,
    discountType,
    discountValue,
    startDate,
    endDate,
    applicableProducts,
    applicableCategories,
  } = req.body;

  try {
    const isListed = req.body.isListed === "on";

    const newOffer = new offerModel({
      offerName,
      offerType,
      discountType,
      discountValue,
      startDate,
      endDate,
      applicableProducts: offerType === "product" ? applicableProducts : [],
      applicableCategories:
        offerType === "category" ? applicableCategories : [],
      isListed,
    });

    await newOffer.save();

    if (isListed) {
      if (
        offerType === "product" &&
        applicableProducts &&
        applicableProducts.length > 0
      ) {
        const products = await productModel.find({
          _id: { $in: applicableProducts },
        });
        for (let product of products) {
          await applyBestOfferToProduct(product._id);
        }
      }

      if (
        offerType === "category" &&
        applicableCategories &&
        applicableCategories.length > 0
      ) {
        const products = await productModel.find({
          category: { $in: applicableCategories },
        });
        for (let product of products) {
          await applyBestOfferToProduct(product._id);
        }
      }
    }

    return res.redirect("/admin/offer");
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).send("An error occurred while creating the offer.");
  }
};

const applyBestOfferToProduct = async (productId) => {
  try {
    const product = await productModel.findById(productId).populate("category");
    if (!product) {
      throw new Error("Product not found");
    }

    const offers = await offerModel.find({
      isListed: true,
      $or: [
        { applicableProducts: product._id },
        { applicableCategories: product.category._id },
      ],
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (offers.length === 0) {
      product.bestOffer = null;
      product.discountedPrice = null;
    } else {
      offers.sort((a, b) => {
        const discountA =
          a.discountType === "percentage"
            ? (a.discountValue / 100) * product.price
            : a.discountValue;
        const discountB =
          b.discountType === "percentage"
            ? (b.discountValue / 100) * product.price
            : b.discountValue;

        return (
          discountB - discountA || new Date(a.endDate) - new Date(b.endDate)
        );
      });

      let bestOffer = null;
      let discountedPrice = null;

      for (const offer of offers) {
        const calculatedDiscountedPrice =
          offer.discountType === "percentage"
            ? product.price - (offer.discountValue / 100) * product.price
            : product.price - offer.discountValue;

        if (calculatedDiscountedPrice >= 0) {
          bestOffer = offer;
          discountedPrice = calculatedDiscountedPrice;
          break;
        }
      }
      if (bestOffer) {
        product.bestOffer = bestOffer._id;
        product.discountedPrice = discountedPrice;
      } else {
        product.bestOffer = null;
        product.discountedPrice = null;
      }
    }

    await product.save();
  } catch (error) {
    console.log(error);
  }
};

const offerListUnlist = async (req, res) => {
  const offerId = req.params.id;

  try {
    const offer = await offerModel.findById(offerId);
    if (!offer) {
      return res.status(404).send("Offer not found");
    }

    offer.isListed = !offer.isListed;
    await offer.save();

    let products = [];
    if (offer.offerType === "product" && offer.applicableProducts?.length > 0) {
      products = await productModel.find({
        _id: { $in: offer.applicableProducts },
      });
    } else if (
      offer.offerType === "category" &&
      offer.applicableCategories?.length > 0
    ) {
      products = await productModel.find({
        category: { $in: offer.applicableCategories },
      });
    }

    if (products.length > 0) {
      if (offer.isListed) {
        for (let product of products) {
          await applyBestOfferToProduct(product._id);
        }
      } else {
        for (let product of products) {
          product.bestOffer = null;
          product.discountedPrice = null;
          await product.save();
        }
      }
    }

    res.redirect("/admin/offer");
  } catch (error) {
    console.error("Error toggling offer listing:", error);
    res.status(500).send("Server Error");
  }
};

const deleteOffer = async (req, res) => {
  const id = req.params.id;
  try {
    const offer = await offerModel.findByIdAndDelete(id);
    if (!offer) {
      if (!offer) {
        req.flash("error-message", "Offer not found.");
        return res.redirect("/admin/offer");
      }

      const products = await productModel.find({
        $or: [
          { bestOffer: id },
          { category: { $in: offer.applicableCategories } },
          { _id: { $in: offer.applicableProducts } },
        ],
      });

      for (const product of products) {
        await applyBestOfferToProduct(product._id);
      }

      req.flash(
        "success-message",
        "Offer deleted and products updated successfully."
      );
      return res.redirect("/admin/offer");
    }
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------sales report----------------------------------------------------------

const loadSalesReport = async (req, res) => {
  try {
    const { filter = "all", startDate, endDate, page = 1 } = req.query;
    const limit = 5;
    const skip = (page - 1) * limit;

    let filterOptions = {};
    const today = dayjs().startOf("day");
    console.log(today, "toooo");

    if (filter === "daily") {
      filterOptions.createdAt = {
        $gte: today.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "weekly") {
      const lastWeek = today.subtract(7, "days");
      filterOptions.createdAt = {
        $gte: lastWeek.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "monthly") {
      const lastMonth = today.subtract(1, "month");
      filterOptions.createdAt = {
        $gte: lastMonth.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "yearly") {
      const lastYear = today.subtract(1, "year");
      filterOptions.createdAt = {
        $gte: lastYear.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "custom") {
      if (startDate && endDate) {
        const parsedStartDate = dayjs(startDate).startOf("day");
        const parsedEndDate = dayjs(endDate).endOf("day");

        if (parsedStartDate.isValid() && parsedEndDate.isValid()) {
          filterOptions.createdAt = {
            $gte: parsedStartDate.toDate(),
            $lte: parsedEndDate.toDate(),
          };
        } else {
          return res.status(400).send("Invalid date range.");
        }
      } else {
        return res.status(400).send("Custom date range is required.");
      }
    }

    console.log("Filter options:", filterOptions);

    const totalOrders = await orderModel.countDocuments(filterOptions);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await orderModel
      .find(filterOptions)
      .populate("userId", "email")
      .populate("items.product", "name")
      .populate("billingDetails", "address")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log("Orders fetched:", orders);

    res.render("salesReport", {
      orders,
      filter,
      startDate,
      endDate,
      currentPage: parseInt(page),
      totalPages,
      // currentPage: page,
      // totalPages,
      limit,
      maxPagesToShow: 10,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
};
// const downloadSalesReportPDF = async (req, res) => {
//   try {
//     const { filter = "all", startDate, endDate } = req.query;

//     // Generate the filter options
//     let filterOptions = {};
//     const today = dayjs().startOf("day");

//     if (filter === "daily") {
//       filterOptions.createdAt = {
//         $gte: today.toDate(),
//         $lte: today.endOf("day").toDate(),
//       };
//     } else if (filter === "weekly") {
//       const lastWeek = today.subtract(7, "days");
//       filterOptions.createdAt = {
//         $gte: lastWeek.toDate(),
//         $lte: today.endOf("day").toDate(),
//       };
//     } else if (filter === "monthly") {
//       const lastMonth = today.subtract(1, "month");
//       filterOptions.createdAt = {
//         $gte: lastMonth.toDate(),
//         $lte: today.endOf("day").toDate(),
//       };
//     } else if (filter === "custom" && startDate && endDate) {
//       const parsedStartDate = dayjs(startDate).startOf("day");
//       const parsedEndDate = dayjs(endDate).endOf("day");
//       filterOptions.createdAt = {
//         $gte: parsedStartDate.toDate(),
//         $lte: parsedEndDate.toDate(),
//       };
//     }

//     // Fetch data from the database
//     const orders = await orderModel
//       .find(filterOptions)
//       .populate("userId", "email")
//       .populate("items.product", "name")
//       .populate("billingDetails", "address");

//     // Setup PDF document
//     const doc = new PDFDocument({ margin: 50, size: "A4" });
//     res.setHeader(
//       "Content-Disposition",
//       "attachment; filename=sales-report.pdf"
//     );
//     res.setHeader("Content-Type", "application/pdf");

//     // Helper function to draw table cell
//     const drawTableCell = (x, y, width, height, text, isHeader = false) => {
//       doc.rect(x, y, width, height).stroke();
//       doc
//         .font(isHeader ? "Helvetica-Bold" : "Helvetica")
//         .fontSize(isHeader ? 12 : 10)
//         .fillColor(isHeader ? "#ffffff" : "#000000")
//         .text(text, x + 5, y + 5, {
//           width: width - 10,
//           height: height - 10,
//           align: isHeader ? "center" : "left",
//           valign: "center",
//         });
//     };

//     // Add title
//     doc
//       .fontSize(24)
//       .font("Helvetica-Bold")
//       .fillColor("#333333")
//       .text("Sales Report", { align: "center" })
//       .moveDown(1);

//     // Add filter information
//     doc
//       .fontSize(12)
//       .font("Helvetica")
//       .fillColor("#666666")
//       .text(`Filter: ${filter}`, { align: "center" })
//       .moveDown(0.5);

//     if (filter === "custom" && startDate && endDate) {
//       doc
//         .text(`Date Range: ${startDate} to ${endDate}`, { align: "center" })
//         .moveDown(1);
//     } else {
//       doc.moveDown(1);
//     }

//     // Table settings
//     const tableTop = 180;
//     const tableLeft = 50;
//     const colWidths = [100, 200, 100, 100];
//     const rowHeight = 30;
//     const headers = ["Order ID", "Customer", "Total Amount", "Date"];

//     // Draw table header
//     doc.fillColor("#4a90e2");
//     headers.forEach((header, i) => {
//       let x =
//         tableLeft +
//         colWidths.slice(0, i).reduce((sum, width) => sum + width, 0);
//       drawTableCell(x, tableTop, colWidths[i], rowHeight, header, true);
//     });

//     // Render table rows
//     let currentTop = tableTop + rowHeight;
//     const itemsPerPage = 10;
//     let rowCount = 0;

//     orders.forEach((order, index) => {
//       if (rowCount >= itemsPerPage) {
//         doc.addPage();
//         currentTop = 50;
//         rowCount = 0;

//         // Re-add headers on new page
//         doc.fillColor("#4a90e2");
//         headers.forEach((header, i) => {
//           let x =
//             tableLeft +
//             colWidths.slice(0, i).reduce((sum, width) => sum + width, 0);
//           drawTableCell(x, currentTop, colWidths[i], rowHeight, header, true);
//         });
//         currentTop += rowHeight;
//       }

//       doc.fillColor("#000000");

//       // Order ID
//       drawTableCell(
//         tableLeft,
//         currentTop,
//         colWidths[0],
//         rowHeight,
//         order._id.toString().slice(-6)
//       );

//       // Customer
//       drawTableCell(
//         tableLeft + colWidths[0],
//         currentTop,
//         colWidths[1],
//         rowHeight,
//         order.userId.email || "N/A"
//       );

//       // Total Amount
//       drawTableCell(
//         tableLeft + colWidths[0] + colWidths[1],
//         currentTop,
//         colWidths[2],
//         rowHeight,
//         `$${order.totalPrice.toFixed(2) || "0.00"}`,
//         false
//       );

//       // Date
//       drawTableCell(
//         tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
//         currentTop,
//         colWidths[3],
//         rowHeight,
//         dayjs(order.createdAt).format("DD/MM/YYYY")
//       );

//       currentTop += rowHeight;
//       rowCount++;
//     });

//     // Add total sales
//     const totalSales = orders.reduce(
//       (sum, order) => sum + (order.totalPrice || 0),
//       0
//     );
//     doc
//       .font("Helvetica-Bold")
//       .fontSize(14)
//       .fillColor("#333333")
//       .text(
//         `Total Sales: $${totalSales.toFixed(2)}`,
//         tableLeft,
//         currentTop + 20,
//         {
//           width: colWidths.reduce((sum, width) => sum + width, 0),
//           align: "right",
//         }
//       );

//     // End the document
//     doc.pipe(res);
//     doc.end();
//   } catch (error) {
//     console.error("Error generating PDF:", error);
//     res.status(500).send("Failed to generate PDF report.");
//   }
// };

const downloadSalesReportPDF = async (req, res) => {
  try {
    const { filter = "all", startDate, endDate } = req.query;

    // Generate the filter options
    let filterOptions = {};
    const today = dayjs().startOf("day");

    if (filter === "daily") {
      filterOptions.createdAt = {
        $gte: today.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "weekly") {
      const lastWeek = today.subtract(7, "days");
      filterOptions.createdAt = {
        $gte: lastWeek.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "monthly") {
      const lastMonth = today.subtract(1, "month");
      filterOptions.createdAt = {
        $gte: lastMonth.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "custom" && startDate && endDate) {
      const parsedStartDate = dayjs(startDate).startOf("day");
      const parsedEndDate = dayjs(endDate).endOf("day");
      filterOptions.createdAt = {
        $gte: parsedStartDate.toDate(),
        $lte: parsedEndDate.toDate(),
      };
    }

    // Fetch data from the database
    const orders = await orderModel
      .find(filterOptions)
      .populate("userId", "email")
      .populate("items.product", "name")
      .populate("billingDetails", "address")
      .sort({ createdAt: -1 }); // Sort by creation date, newest first

    // Setup PDF document
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.pdf"
    );
    res.setHeader("Content-Type", "application/pdf");

    // Helper function to draw table cell
    const drawTableCell = (
      x,
      y,
      width,
      height,
      text,
      isHeader = false,
      align = "left"
    ) => {
      doc.rect(x, y, width, height).stroke();
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(isHeader ? 12 : 10)
        .fillColor("#000000")
        .text(text, x + 5, y + 5, {
          width: width - 10,
          height: height - 10,
          align: isHeader ? "center" : align,
          valign: "center",
        });
    };

    // Add title and heading
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .fillColor("#333333")
      .text("Sales Report", { align: "center" })
      .moveDown(0.5);

    // Add filter information
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Filter: ${filter}`, { align: "center" })
      .moveDown(0.5);

    if (filter === "custom" && startDate && endDate) {
      doc
        .text(`Date Range: ${startDate} to ${endDate}`, { align: "center" })
        .moveDown(0.5);
    }

    // Add report generation date
    doc
      .fontSize(10)
      .text(`Report generated on: ${dayjs().format("DD/MM/YYYY HH:mm")}`, {
        align: "center",
      })
      .moveDown(1);

    // Table settings
    const tableTop = 180;
    const tableLeft = 50;
    const colWidths = [40, 200, 110, 110];
    const rowHeight = 30;
    const headers = ["No.", "Customer", "Total Amount", "Date"];

    // Draw table header
    doc.fillColor("#e6f2ff");
    headers.forEach((header, i) => {
      let x =
        tableLeft +
        colWidths.slice(0, i).reduce((sum, width) => sum + width, 0);
      drawTableCell(x, tableTop, colWidths[i], rowHeight, header, true);
    });

    // Render table rows
    let currentTop = tableTop + rowHeight;
    const itemsPerPage = 10;
    let rowCount = 0;

    orders.forEach((order, index) => {
      if (rowCount >= itemsPerPage) {
        doc.addPage();
        currentTop = 50;
        rowCount = 0;

        // Re-add headers on new page
        doc.fillColor("#e6f2ff");
        headers.forEach((header, i) => {
          let x =
            tableLeft +
            colWidths.slice(0, i).reduce((sum, width) => sum + width, 0);
          drawTableCell(x, currentTop, colWidths[i], rowHeight, header, true);
        });
        currentTop += rowHeight;
      }

      doc.fillColor("#ffffff");

      // No.
      drawTableCell(
        tableLeft,
        currentTop,
        colWidths[0],
        rowHeight,
        (index + 1).toString(),
        false,
        "center"
      );

      // Customer
      drawTableCell(
        tableLeft + colWidths[0],
        currentTop,
        colWidths[1],
        rowHeight,
        order.userId.email || "N/A"
      );

      // Total Amount
      drawTableCell(
        tableLeft + colWidths[0] + colWidths[1],
        currentTop,
        colWidths[2],
        rowHeight,
        `$${order.totalPrice.toFixed(2) || "0.00"}`,
        false,
        "right"
      );

      // Date
      drawTableCell(
        tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
        currentTop,
        colWidths[3],
        rowHeight,
        dayjs(order.createdAt).format("DD/MM/YYYY"),
        false,
        "center"
      );

      currentTop += rowHeight;
      rowCount++;
    });

    // Add total sales
    const totalSales = orders.reduce(
      (sum, order) => sum + (order.totalPrice || 0),
      0
    );
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#333333")
      .text(
        `Total Sales: $${totalSales.toFixed(2)}`,
        tableLeft,
        currentTop + 20,
        {
          width: colWidths.reduce((sum, width) => sum + width, 0),
          align: "right",
        }
      );

    // End the document
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Failed to generate PDF report.");
  }
};

const downloadSalesReportExcel = async (req, res) => {
  try {
    const { filter = "all", startDate, endDate } = req.query;

    // Generate the filter options
    let filterOptions = {};
    const today = dayjs().startOf("day");

    if (filter === "daily") {
      filterOptions.createdAt = {
        $gte: today.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "weekly") {
      const lastWeek = today.subtract(7, "days");
      filterOptions.createdAt = {
        $gte: lastWeek.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "monthly") {
      const lastMonth = today.subtract(1, "month");
      filterOptions.createdAt = {
        $gte: lastMonth.toDate(),
        $lte: today.endOf("day").toDate(),
      };
    } else if (filter === "custom" && startDate && endDate) {
      const parsedStartDate = dayjs(startDate).startOf("day");
      const parsedEndDate = dayjs(endDate).endOf("day");
      filterOptions.createdAt = {
        $gte: parsedStartDate.toDate(),
        $lte: parsedEndDate.toDate(),
      };
    }

    // Fetch data from the database
    const orders = await orderModel
      .find(filterOptions)
      .populate("userId", "email")
      .populate("items.product", "name")
      .populate("billingDetails", "address");

    // Generate Excel content (use a library like `exceljs`)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.columns = [
      { header: "No", key: "_id", width: 30 },
      { header: "Customer", key: "email", width: 30 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Date", key: "createdAt", width: 20 },
    ];
    let count = 1;
    orders.forEach((order) => {
      worksheet.addRow({
        _id: count++,
        email: order.userId.email,
        totalAmount: order.totalPrice,
        createdAt: order.createdAt,
      });
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel:", error);
    res.status(500).send("Failed to generate Excel report.");
  }
};

//------------------------------------------------------------logOut-------------------------------------------------------

const NotFoundPage = async (req, res) => {
  try {
    res.render("404");
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------LogOut----------------------------------------------------------

const logout = async (req, res) => {
  try {
    req.session.admin = null;
    res.redirect("/admin/");
  } catch (error) {
    console.log(error);
  }
};

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "./public/uploads"); // Path to the uploads folder
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname));
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif/;
//   const extname = allowedTypes.test(
//     path.extname(file.originalname).toLowerCase()
//   );
//   const mimetype = allowedTypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb(new Error("Only images are allowed!"));
//   }
// };

// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: { fileSize: 1024 * 1024 * 5 }, // Limit file size to 5MB
// });

// --------------------------------------------------------

// const addCatagory = async (req, res) => {
//   const { name, description } = req.body;
//   console.log(req.body);
//   try {
//     const existCatag = await Catagory.findOne({ name });
//     if (!name || !description) {
//       req.flash("catagErr", "Name and description are required.");
//       return res.redirect("/admin/addCatagory");
//     }
//     if (existCatag) {
//       req.flash("catagErr", "Catagory already exists.");
//       return res.redirect("/admin/addCatagory"); // Redirect back to the form
//     }

//     const newCatagory = new Catagory({ name, description });
//     await newCatagory.save();
//     res.redirect("/admin/catagory"); // Redirect to the category list page
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Something went wrong!");
//   }
// };

module.exports = {
  loadLogin,
  adminLogin,
  loadDashboard,
  loadProductList,
  loadAddProduct,
  addProduct,
  loadEditProduct,
  editProduct,
  deleteProductImage,
  listProduct,
  unlistProduct,
  deleteProduct,
  isNew,
  loadCatagory,
  loadEditCatagory,
  loadAddCatagory,
  addCatagory,
  editCatagory,
  listCategory,
  unlistCategory,
  loadBrand,
  loadAddBrand,
  addBrand,
  loadEditBrand,
  editBrand,
  listBrand,
  unlistBrand,
  upload,
  loadUser,
  blockUser,
  unblockUser,
  loadOrder,
  loadadminOrderDetails,
  // adminCancelOrder,
  logout,
  loadCoupons,
  loadAddCoupons,
  addCoupons,
  deleteCoupons,
  listCoupons,
  unlistCoupons,
  adminUpdateOrderStatus,
  verifyReturn,
  loadOffers,
  loadAddOffer,
  createOffers,
  offerListUnlist,
  deleteOffer,
  loadSalesReport,
  NotFoundPage,
  downloadSalesReportPDF,
  downloadSalesReportExcel,
};

// const user = async (req, res) => {
//   try {
//     const userId = req.params._id;
//     const user = await userModel.findById({ userId });
//     if (!user) {
//       return res.status(404).json({ success: false, message: "no user found" });
//     }
//     user.isBlocked = !user.isBlocked;
//     await user.save();
//   } catch (error) {
//     console.log(error);
//   }
// };
