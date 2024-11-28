import cartModel from '../../models/cart.js';
import addressModel from '../../models/address.js';
import orderModel from '../../models/order.js';
import productModel from '../../models/product.models.js';
import Coupon from '../../models/coupon.js';
import {razorpay}  from '../../config/razorpay.js'
import Razorpay from 'razorpay';
import crypto from 'crypto';
import walletModel from '../../models/wallet.js'

//^ //  //  //   //  //          get Checkout page     //  //  //  //  //  //  //
export const getCheckoutPage = async (req, res) => {
  try {
    // Get the user's cart
    const cart = await cartModel.findOne({ user: req.session.userID }).populate('items.product');
    
    const outOfStockItems = cart.items.filter(item => item.product.stock < item.quantity)
    if(outOfStockItems.length > 0){      
      return res.status(400).json({error:'Some of the items in your cart are out of stock.Please update your cart before proceeding to checkout.'})
    }
    // Get the user's saved addresses
    const addresses = await addressModel.find({ userId: req.session.userID });
    
    // calculate the subtotal and total discount of the cart items in the cart for the checkout page for the user for the order 
    const { subtotal, totalDiscount } = calculateSubtotal(cart.items);

    const coupons = await Coupon.find();
    
    // Render the checkout page
    res.render('user/checkout', {
      cart,
      addresses,
      totalDiscount,
      originalPrice: subtotal + totalDiscount,
      user: req.session.userID,
      coupons,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      title:"Checkout"
    });
  } catch (error) {
    console.error('Error loading checkout page:', error);
    res.status(500).send('Server Error');
  }
};


// //^ //  //  //   //  //         POST Order in checkout     //  //  //  //  //  //  //

export const postOrder = async (req, res) => {
  try {
    const userId = req.session.userID;
    const { addressId, paymentMethod } = req.body;
    console.log('in post order', addressId);
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const cart = await cartModel.findOne({ user: userId }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    const address = await addressModel.findById(addressId);
    if (!address) {
      return res.status(400).json({ message: 'Invalid address' });
    }


    const totalAmount = cart.total
    if (paymentMethod === 'COD'  && totalAmount > 1000) {
      return res.status(400).json({success:false, message:"COD is not available for orders above ₹1000"})
    }

    const items = cart.items.map(item => {
      // const itemTotal = (item.discountPrice * item.quantity) - item.couponDiscountAmount; // Calculate item total
      const itemTotal = (Number(item.discountPrice) || 0) * (Number(item.quantity) || 0) - (Number(item.couponDiscountAmount) || 0);
      const discountAmount = (Number(item.product.price)|| 0) -  (Number(item.discountPrice)|| 0) ||  (Number(item.product.price)|| 0) *  (Number(item.quantity)|| 0);
      const totalDiscount = (Number(discountAmount)|| 0) + (Number(item.couponDiscountAmount) || 0);

      return {
        product: item.product._id, 
        quantity: item.quantity, 
        price: item.product.price, 
        discountPrice: item.discountPrice, 
        itemTotal: itemTotal, 
        discountAmount: discountAmount, 
        couponCode: item.couponCode || null, 
        couponDiscountAmount: item.couponDiscountAmount || 0, 
        totalDiscount: totalDiscount > 0 ? totalDiscount : 0 
      };
    });

    const newOrder = new orderModel({
      user: userId, 
      items, 
      address: address._id, 
      subtotal: cart.subtotal, 
      total: cart.total, 
      paymentMethod: paymentMethod, 
      couponCode: cart.couponCode || null, 
      couponDiscountAmountAll: cart.couponDiscount || 0, 
      totalDiscount: items.reduce((acc, item) => acc + item.totalDiscount, 0) 
    });

    console.log('newOrder',newOrder)

    // // Handle Razorpay Payment
    // if (paymentMethod == 'Razorpay') {
    //   const options = {
    //     amount: (Number(cart.total * 100)||0),
    //     currency: 'INR',
    //     receipt: `receipt_${newOrder._id}`,
    //   };
    // console.log('paymentMethod',paymentMethod)

    //   const razorpayOrder = await razorpay.orders.create(options);
    //   console.log('razorpay.orders:',razorpay.orders)
    //   console.log("razorpayOrder", razorpayOrder);
     
    //   await newOrder.save();
    //   console.log('newOrder',newOrder)
      
    //   await updateStock(items);
    //   console.log('updateStock',updateStock)

    //   await clearCart(userId);
    //   console.log('clearCart',clearCart)

    //   res.status(200).json({ success: true, razorpayOrderId: razorpayOrder.id, OrderId: newOrder._id });

    // } 
    if (paymentMethod === 'Razorpay') {
      // Convert the total amount to paise (multiply by 100) and ensure it's an integer
      const amountInPaise = Math.round(Number(cart.total) * 100);
    
      // Ensure the amount is a valid integer
      if (isNaN(amountInPaise) || amountInPaise <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid order total' });
      }
    
      const options = {
        amount: amountInPaise, // Razorpay expects an integer in paise
        currency: 'INR',
        receipt: `receipt_${newOrder._id}`,
      };
    
      try {
        console.log('paymentMethod', paymentMethod);
        const razorpayOrder = await razorpay.orders.create(options);
        console.log('razorpay.orders:', razorpay.orders);
        console.log('razorpayOrder', razorpayOrder);
    
        await newOrder.save();
        await updateStock(items);
        await clearCart(userId);
    
        res.status(200).json({ success: true, razorpayOrderId: razorpayOrder.id, OrderId: newOrder._id });
      } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred while placing the order.' });
      }
    }
    
    else if (paymentMethod === 'Wallet') {
      const wallet = await walletModel.findOne({ user: userId });

      if (!wallet || wallet.balance < cart.total) {
        return res.status(400).json({ success: false, message: "Insufficient balance in wallet" });
      }

      wallet.balance -= cart.total;
      wallet.transaction.push({
        walletAmount: cart.total,
        transactionType: 'Debited',
        order_id: newOrder._id,
        transactionDate: Date.now()
      });

      await wallet.save();

console.log('wallet',wallet)

      newOrder.paymentStatus = 'Completed';
      await newOrder.save();
      await updateStock(items);
      await clearCart(userId);

      // if coupon is applied then update the used count of the coupon
      if(cart.couponCode) {
        const coupon = await couponModel.findOne({couponCode:cart.couponCode})
        if(coupon) {
          coupon.usedCount += 1;
          await coupon.save();
        }
      }
      res.status(200).json({ success: true, message: "Order placed successfully", order: newOrder });

    } else if (paymentMethod === 'COD') {
      await newOrder.save();
      await updateStock(items);
      await clearCart(userId);

      // if coupon is applied then update the used count of the coupon
      if(cart.couponCode) {
        const coupon = await couponModel.findOne({couponCode:cart.couponCode})
        if(coupon) {
          coupon.usedCount += 1;
          await coupon.save();
        }
      }
      res.status(200).json({ success: true, message: "Order placed successfully", order: newOrder });

    } else {
      res.status(400).json({ success: false, message: "Invalid payment method" });
    }

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).send('Internal server error in post order');
  }
};

//^ //  //  //   //  //         Verify Payment     //  //  //  //  //  //  //

export const verifyPayment = async (req,res) => {
  try {
    const { razorpayOrderId, paymentId, signature, OrderId,address,paymentMethod} = req.body;
    console.log('req.body:0000000',req.body);
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                    .update(`${razorpayOrderId}|${paymentId}`)
                                    .digest('hex');

    if (signature === generatedSignature) {
        const newOrder = await orderModel.findById(OrderId);
        if (newOrder) {
            newOrder.paymentStatus = 'Completed';
            await newOrder.save();
        }
        res.status(200).json({ success: true, message: "Payment verified successfully" });
    } else {
        res.status(400).json({ success: false, message: "Payment verification failed" });
    }
} catch (error) {
    console.error("Error in verify payment:", error);
    res.status(500).send("Internal server error in verify payment");
}
};
//^ //  //  //   //  //         Add New Address     //  //  //  //  //  //  //

export const addNewAddress = async (req, res) => {
  try {
    const { name, buildingName, street, city, state, country, pincode, mobile } = req.body;

    const newAddress = new addressModel({
        userId: req.session.userID,
      name,
      buildingName,
      street,
      city,
      state,
      country,
      pincode,
      mobile,
    });

    await newAddress.save();
    res.redirect('/checkout');
  } catch (error) {
    console.error('Error adding new address:', error);
    res.status(500).send('Server Error');
  }
};


//^ //  //  //   //  //         Order Confirmation Page     //  //  //  //  //  //  //

export const orderConfirmation = async (req,res) => {
  try {
    const userId = req.session.userID;
    const newOrder = await orderModel.findOne({user:userId}).sort({createdAt:-1}).populate('items.product');

    if(!newOrder) {
      return res.status(400).json({message:"No orders found"})
    }
    res.render('user/orderConfirmation', {order:newOrder,title:"Order Confirmation"})
  }catch (error) {
    console.error('Error loading order confirmation:', error);
    res.status(500).send('Server Error');
  }
}
//^ //  //  //   //  //         Updating selected Address     //  //  //  //  //  //  //

export const updateSelectedAddress = async (req,res) => {
  try {
    const {addressId} = req.body;
    const userId = req.session.userID;

    const address = await addressModel.findOne({_id:addressId, userId:userId});
    if(!address) {
      return res.status(400).json({message:"Invalid address"})
    }
  res.status(200).json({success:true, message:"Address selected successfully"})
  } catch (error) {
    console.log("error in update selected address", error);
    res.status(500).send("Internal server error in update selected address");
  }
}
//^ //  //  //   //  //         Payment Method selection     //  //  //  //  //  //  //

export const updatePaymentMethod = async (req,res) => {
  try {
    const {paymentMethod} = req.body;
    const userId = req.session.userID;

    if(!['COD','Razorpay','Wallet'].includes(paymentMethod)) {
      return res.status(400).json({message:"Invalid payment method"})
    }
   res.status(200).json({success:true, message:"Payment method selected successfully"})
  } catch (error) {
    console.log('error in update payment method', error);
    res.status(500).send('Internal server error in update payment method');
  }
}

//^ //  //  //   //  //         Repay Order     //  //  //  //  //  //  //

export const repayOrder = async (req,res) => {
  try {
    const orderId = req.params.orderId;
    const order = await orderModel.findById(orderId)
    if(!order) {
      return res.status(400).json({success:false, message:"Order not found"})
    }

    const options = {
      amount: order.total * 100,
      currency: 'INR',
      receipt: `repay_${order._id}`,
    }

    const razorpayOrder = await razorpay.orders.create(options);
    console.log("razorpayOrder", razorpayOrder);

   res.status(200).json({success:true, razorpayOrderId:razorpayOrder.id, OrderId:order._id})

  }catch (error) {
    console.log("error in repay order", error);
    res.status(500).send("Internal server error in repay order");
  }
}

//^ //  //  //   //  //         Failed Order Page     //  //  //  //  //  //  //

export const failedOrderPage = async (req,res) => {
  try {
    res.render('user/failedOrder', {title:"Order Failed"})
  } catch (error) {
    console.log("error in failed order page", error);
    res.status(500).send("Internal server error in failed order page");
  }
}
// //^ //  //  //   //  //         Add Coupon     //  //  //  //  //  //  //

export const applyCoupon = async (req, res) => {
  try {
    const { couponCode, totalAmount } = req.body;

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon || totalAmount <= 0) {
      return res.json({
        success: false,
        message: 'Invalid or expired coupon code',
      });
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.json({
        success: false,
        message: 'Coupon usage limit has been reached',
      });
    }

    if (totalAmount < coupon.minimumPurchase) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPurchase} required`,
      });
    }

    let discount = 0;
    switch (coupon.discountType) {
      case 'percentage':
        discount = (totalAmount * coupon.discountAmount) / 100;
        break;
      case 'fixed':
        discount = Math.min(coupon.discountAmount, totalAmount);
        break;
      default:
        return res.json({
          success: false,
          message: 'Invalid coupon type',
        });
    }

    discount = Math.round(discount * 100) / 100;

    coupon.usedCount += 1;
    await coupon.save();

    const newTotal = Math.round((totalAmount - discount) * 100) / 100;

    return res.json({
      success: true,
      discountAmount: discount,
      newTotal: newTotal,
      message: 'Coupon applied successfully',
    });

  } catch (error) {
    console.error('Coupon validation error:', error);
    return res.json({
      success: false,
      message: 'Coupon validation failed',
    });
  }
};

// export const applyCoupon = async (req, res) => {
//   try {
//       const { couponCode, totalAmount } = req.body;

//       const coupon = await Coupon.findOne({
//           code: couponCode.toUpperCase(),
//           isActive: true,
//           validFrom: { $lte: new Date() },
//           validUntil: { $gte: new Date() }
//       });

//       if (!coupon || totalAmount <= 0) {
//           return res.json({
//               success: false,
//               message: 'Invalid or expired coupon code'
//           });
//       }

//       if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
//           return res.json({
//               success: false,
//               message: 'Coupon usage limit has been reached'
//           });
//       }

//       if (totalAmount < coupon.minimumPurchase) {
//           return res.json({
//               success: false,
//               message: `Minimum purchase of ₹${coupon.minimumPurchase} required`
//           });
//       }

//       let discount = 0;
//       switch (coupon.discountType) {
//           case 'percentage':
//               discount = (totalAmount * coupon.discountAmount) / 100;
//               break;
//           case 'fixed':
//               discount = Math.min(coupon.discountAmount, totalAmount);
//               break;
//           default:
//               return res.json({
//                   success: false,
//                   message: 'Invalid coupon type'
//               });
//       }

//       discount = Math.round(discount * 100) / 100;

//       coupon.usedCount += 1;
//       await coupon.save();
//       console.log('coupon:***********', coupon);

//       const flashMessage = {
//         success: true,
//         discount: discount,
//         message: 'Coupon applied successfully',
//         discountType: coupon.discountType
//     };

//     // Store the flash message in the session
//     req.session.flashMessage = flashMessage;

//     return res.redirect(`/checkout`);
    
//   } catch (error) {
//       console.error('Coupon validation error:', error);
//       return res.json({
//           success: false,
//           message: 'Coupon validation failed'
//       });
//   }
// };

// //  //  //   //  //         Calculate Subtotal     //  //  //  //  //  //  //
const calculateSubtotal = (items) => {
  let subtotal = 0;
  let totalDiscount = 0;

  items.forEach(item => {
    const itemTotal = (item.discountPrice || 0) * (item.quantity || 0);
    subtotal += itemTotal;
    totalDiscount += (item.price - item.discountPrice) * item.quantity; 
  });

  return { subtotal, totalDiscount }; 
}

// //  //  //   //  //         Calculate Total     //  //  //  //  //  //  //
const calculateTotal = (subtotal, discount) => {
  const discountAmount = (subtotal * discount) / 100;
  return subtotal - discountAmount;
}


// //  //  //   //  //         Helper Function Update Stock     //  //  //  //  //  //
const updateStock = async (items) => {
  for (const item of items) {
    const product = await productModel.findById(item.product);
    if(product && product.stock >= item.quantity) {
      product.stock -= item.quantity;
      product.sold += item.quantity;
      await product.save();
    } else {
      throw new Error(`Insufficient stock for product: ${product.name}`);
    }
  }
}

// //  //  //   //  //         Helper Function Clear Cart     //  //  //  //  //  //
const clearCart = async (userId) => {
  await cartModel.findOneAndUpdate({user:userId}, {items:[], total:0, subtotal:0, couponCode:null, couponDiscount:0});
}