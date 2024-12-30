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