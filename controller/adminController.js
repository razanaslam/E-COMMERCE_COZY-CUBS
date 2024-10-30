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
    res.render("dashboard");
  } catch (error) {
    console.log(error);
  }
};

//---------------------------------------------------------------Product---------------------------------------------------------------

const loadProductList = async (req, res) => {
  try {
    const products = await productModel.find();
    res.render("productsList", { products });
  } catch (error) {
    console.log(error);
  }
};

const loadAddProduct = async (req, res) => {
  try {
    const category = await catagoryModel.find();
    const brand = await brandModel.find();
    res.render("addProduct", { category, brand });
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

    // Create the new product document

    const images = req.files.map((file) => file.filename);
    console.log(images, "bhugsygf");

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
    console.log(newProduct);
    res.redirect("/admin/productsList");
  } catch (error) {
    console.log(error.message);
    // res.status(500).send("Error uploading images");
  }
};

const loadEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    console.log(id, "iiiiiiiiidddd");

    const product = await productModel
      .findById(id)
      .populate("category", "name");

    const category = await catagoryModel.find();
    console.log(category, "caaatttt");
    console.log(product);
    const brand = await brandModel.find();

    if (!category || !brand) {
      return res.status(404).send("Category or brand data not found");
    }

    // Ensure product is valid before passing to the view
    if (!product) {
      return res.status(404).send("Product not found");
    }

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
      image_url,
    } = req.body;
    console.log("hy razz");

    const images = req.files.map((file) => file.filename);
    console.log(images, "juhuhjh");

    await productModel.findByIdAndUpdate(id, {
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

    // await newProduct.save();
    // console.log(newProduct);
    res.redirect("/admin/productsList");
  } catch (error) {
    console.log(error);
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
    res.render("addCatagory", { catagErr });
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
      req.flash("catagErr", "Catagory is already existed");
      res.redirect("/admin/addCatagory");
    }
    const newCatagory = new catagoryModel({
      name,
      description,
    });
    await newCatagory.save();
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
    const catagErr = req.flash("catagError");
    res.render("addBrand", { catagErr });
  } catch (error) {
    console.log(error);
  }
};

const addBrand = async (req, res) => {
  const { name, description } = req.body;
  try {
    const existBrand = await brandModel.findOne({ name });
    if (existBrand) {
      req.flash("brandError", "Already Existed");
      res.redirect("/admin/addBrand");
    }
    const newBrand = new brandModel({
      name,
      description,
    });
    await newBrand.save();
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

const loadUser = async (req, res) => {
  try {
    const user = await userModel.find();
    res.render("userList", { user });
  } catch (error) {
    console.log(error);
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
  listProduct,
  unlistProduct,
  deleteProduct,
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
  logout,
};
