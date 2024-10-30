const express = require("express");
const adminRoute = express.Router();
const session = require("express-session");
adminRoute.use(express.urlencoded({ extended: true }));
const adminController = require("../controller/adminController");
const { isAdmin } = require("../middleware/adminAuth");
const { logout } = require("../controller/userController");
// const upload = require("../config/multer");??
// const fileUpload = require("express-fileupload");
// adminRoute.use(fileUpload());
// const upload = require("../path-to-your-multer-setup");

adminRoute.use(
  session({
    secret: "your_secret",
    resave: false,
    saveUninitialized: true,
  })
);

/// authentication

adminRoute.get("/", adminController.loadLogin);
adminRoute.post("/", adminController.adminLogin);
adminRoute.get("/dashboard", isAdmin, adminController.loadDashboard);

//products

adminRoute.get("/productsList", isAdmin, adminController.loadProductList);
adminRoute.get("/addProduct", isAdmin, adminController.loadAddProduct);
// adminRoute.post("/upload", adminController.upload);
adminRoute.post(
  "/addProduct",
  adminController.upload,
  adminController.addProduct
);
adminRoute.get("/editProduct/:id", isAdmin, adminController.loadEditProduct);
adminRoute.post(
  "/editProduct/:id",
  adminController.upload,
  adminController.editProduct
);
adminRoute.post("/listProduct/:id", adminController.listProduct);
adminRoute.post("/unlistProduct/:id", adminController.unlistProduct);
adminRoute.post("/deleteProduct/:id", adminController.deleteProduct);
// adminRoute.post(
//   "/addProduct",
//   upload.array("product_image", 3),
//   adminController.addProduct
// );
// adminRoute.post("/addProduct", adminController.addProduct);

// category

adminRoute.post("/addCatagory", adminController.addCatagory);
adminRoute.get("/catagory", isAdmin, adminController.loadCatagory);
adminRoute.get("/editCatagory/:id", isAdmin, adminController.loadEditCatagory);
adminRoute.get("/addCatagory", isAdmin, adminController.loadAddCatagory);
adminRoute.post("/editCatagory/:id", adminController.editCatagory);
adminRoute.post("/list/:id", adminController.listCategory);
adminRoute.post("/unlist/:id", adminController.unlistCategory);

// brand

adminRoute.get("/brand", isAdmin, adminController.loadBrand);
adminRoute.get("/addBrand", isAdmin, adminController.loadAddBrand);
adminRoute.post("/addBrand", adminController.addBrand);
adminRoute.get("/editBrand/:id", isAdmin, adminController.loadEditBrand);
adminRoute.post("/editBrand/:id", adminController.editBrand);
adminRoute.post("/listBrand/:id", adminController.listBrand);
adminRoute.post("/unListBrand/:id", adminController.unlistBrand);

//userList

adminRoute.get("/userList", isAdmin, adminController.loadUser);
adminRoute.post("/blockUser/:id", adminController.blockUser);
adminRoute.post("/unblockUser/:id", adminController.unblockUser);

//logout

adminRoute.get("/logout", adminController.logout);
module.exports = adminRoute;
