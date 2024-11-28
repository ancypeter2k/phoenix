import productModel from "../../models/product.models.js"
import categoryModel from "../../models/category.models.js"
import cloudinary from "../../config/cloudinary.js"
import fs from "fs"

// //  //  //   //  //          GET PRODUCT LIST PAGE  //  //  //  //  //  //  //
const getProduct=async(req,res)=>{
  try{
    const page=parseInt(req.query.page) || 1;
    const limit=7;
    const skip=(page -1) * limit

    const productList=await productModel.find({isDeleted:false})
    .populate('category', 'name')
    .sort({createdAt: -1})
    .skip(skip)
    .limit(limit)

    const totalproducts=await productModel.countDocuments({isDeleted:false})
    const totalPages=Math.ceil(totalproducts / limit)
    const startIndex = skip + 1;
   
    res.render("admin/productsList",{
      productList,
      currentPage: page,
      totalPages,
      startIndex
    })

  }catch(error){
    console.log(error);
    res.status(500)
  }
}
// //  //  //   //  //          GET ADD PRODUCT PAGE   //  //  //  //  //  //  //

const getAddProduct = async (req, res) => {
  try {
    const categorylist = await categoryModel.find({ isBlocked: false });
    res.render('admin/addProducts', { categorylist });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

 // //  //  //   //  //          POST ADD PRODUCT   //  //  //  //  //  //  //

const postAddProduct = async (req, res) => {
  const files = req.files || [];
  try {
    const { productName, description, category, price, stock, SKU, discount, discountedPrice } = req.body;
    

    // validation
    const errors = [];

    //  Validate Product Name
    const productNameRegex = /^[a-zA-Z][a-zA-Z0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{2,49}$/;
    if (!productName || !productNameRegex.test(productName)) {
      errors.push("Product name must be between 3 and 50 characters.");
    }

    //  Validate Description
    const descriptionRegex = /^[a-zA-Z][\s\S]{9,999}$/;
    if (!description || !descriptionRegex.test(description.trim())) {
      errors.push("Description must be between 10 and 1000 characters.");
    }

    //  Validate Category
    if (!category) {
      errors.push("Please select a category.");
    }

    //  Validate Price
    const Price = parseFloat(price);
    if (isNaN(Price) || Price <= 0) {
      errors.push("Price must be a number greater than zero.");
    }

    //  Validate Stock
    const Stocks = parseFloat(stock);
    if (isNaN(Stocks) || Stocks < 0 || !Number.isInteger(Stocks)) {
      errors.push("Stock must be a number and zero or greater.");
    }

    //  Validate SKU
    const skuRegex = /^[a-zA-Z0-9\-]+$/;
    if (!SKU || !skuRegex.test(SKU)) {
      errors.push("Invalid SKU format. Only letters, numbers, and dashes are allowed.");
    }

    if (files.length === 0) {
      errors.push('Please upload at least one image')
    } else if (files.length > 3) {
      errors.push('You can upload up to 3 images')
    } else {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
      const maxSize = 10 * 1024 * 1024; // 10 MB
      for (let  file of files) {
        if (!allowedTypes.includes(file.mimetype)) {
          errors.push(`Invalid file type ${file.originalname}. Only jpeg, png, jpg, gif, webp and svg are allowed.`)
        }

        if (file.size > maxSize) {
          errors.push(`File ${file.originalname} is too large. Maximum size is 10 MB`)
        }
      }
    }
     
    //  Check for existing product with same name or SKU
    const existingProduct = await productModel.findOne({ $or: [{ SKU: SKU }, {name: productName}] })
    if(existingProduct) {
      errors.push('A product is already exists with this name or SKU')
    }

    
    // If there are validation errors, return them
    if (errors.length > 0) {
      req.flash('error',errors)
      return res.redirect('/admin/addProducts')
    }

    // Upload each image to Cloudinary
    const imageUrls = [];
    for (let file of files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "Products",
        use_filename: true,
      });
      imageUrls.push(result.secure_url);
    }
    console.log("Image:",imageUrls.length)

    // Create the product
    const newProduct = new productModel({
      name: productName,
      description: description,
      image: imageUrls, // Save the array of image URLs
      price: Price,
      stock: Stocks,
      category: category,
      discount:discount,
      discountedPrice:discountedPrice,
      SKU: SKU,
    });

    // Save the product to the database
    await newProduct.save();

    res.redirect('/admin/products');
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).send('Error adding product');
  } finally {
    // Clean up the local uploaded files after uploading to Cloudinary
    files.forEach(file => {
      if(file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path)
      }
    });
  }
};


// //  //  //   //  //          soft DELETE PRODUCT   //  //  //  //  //  //  //

const softDeleteProduct=async(req,res)=>{
try{
  const productId=req.params.id;
  const product=await productModel.findByIdAndUpdate(productId,{isDeleted:true})
  console.log(product);
  if(!product){
    return res.status(404).send("Product not found")
  }
  res.redirect("/admin/products")

}catch(error){
  console.log(error);
  res.status(500).send("Error deleting product")
}
}


// //  //  //   //  //         GET EDIT PRODUCT   //  //  //  //  //  //  //

const getEditProduct = async (req, res) => {
  try {
      const id = req.params.id;
      const product = await productModel.findById(id).populate('category');
      const categorylist = await categoryModel.find();
      
      if (!product) {
          return res.status(404).send('Product not found');
      }

      console.log('Product:', product); // Add this for debugging
      res.render('admin/editProducts', { product, categorylist });
  } catch (error) {
      console.error('Error in getEditProduct:', error);
      res.status(500).send('Internal server error');
  }
};

// //  //  //   //  //          POST EDIT PRODUCT   //  //  //  //  //  //  //

  const postEditProduct = async (req, res) => {
  try {
    
    const productId  = req.params.id;

    console.log(`productId:`,productId);

    let product = await productModel.findById(productId)

    console.log(`product = ${product}`);
    if (!product) {
      return res.status(404).send('Product not found');
  }
  product.name = req.body.name||product.name;
  product.description = req.body.description||product.description;
  product.price = req.body.price||product.price;
  product.category =req.body.category||product.category;
  product.stock=req.body.stock;
  product.SKU = req.body.SKU;
  product.discount = req.body.discount;
  product.discountedPrice = req.body.discountedPrice;

  await product.save();
  res.redirect('/admin/products')

    
  } catch (error) {
    console.log(`error from postEditProduct ${error}`)
  }
  }

export default {
  getProduct,
  getAddProduct,
  postAddProduct,
  softDeleteProduct,
  getEditProduct,
  postEditProduct
};