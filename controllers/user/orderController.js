import orderModel from '../../models/order.js'
import productModel from '../../models/product.models.js'
import mongoose from 'mongoose'


//^  //  //   //  //          GET ORDER  HistoryPage   //  //  //  //  //  //  //

export const getorderhistoryPage = async (req,res) => {
  try {
    const userId = req.session.userID 
    const orders = await orderModel.find( {user:userId} )
    .populate({
      path:'items.product',
      select:'name image category',
      populate:{path:'category',select:'name'}
    })
    .sort({createdAt:-1}).exec()
    res.render('profile/orderHistory',{orders})
  } catch (error) {
    console.log("get order history page error :",error);
    res.status(500).send('Internal Server Error');
  }
}

//^  //  //   //  //          GET ORDER  historypage   //  //  //  //  //  //  //

export const getOrderDetailpage = async (req,res) => {
  try {
    const userId = req.session.userID;
    const orderId = req.params.orderID;
    const itemId = req.params.itemId;

    // Check for valid ObjectIDs
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).send('Invalid Order ID or Item ID');
    }

    // Find order with user ID and populate product and address details
    const order = await orderModel.findOne({ _id: orderId, user: userId })
      .populate({
        path: 'items.product',
        select: 'name image category',
        populate: { path: 'category', select: 'name' }
      })
      .populate('address');

    // If no order is found, send 404
    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Find specific item within the order
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).send('Item not found');
    }

    // Render order detail page with order and item details
    res.render('profile/orderDetails', { order, item });
  } catch (error) {
    console.error("Error in getOrderDetailpage:", error);
    res.status(500).send('Internal Server Error');
  }
};

//^  //  //   //  //         ORDER  Cancel   //  //  //  //  //  //  //

// export const orderCancel = async (req,res) => {
//   try {
//     console.log('hi from order cancel')

//     const userId = req.session.userID
//     const orderId = req.params.orderID
//     const itemId = req.params.itemId
//     const productId=req.params.productId;
//     console.log('productId',productId)
//     console.log("cancel itemId :",itemId);
//     console.log("cancel orderId :",orderId);
//     console.log("cancel userId :",userId);

//     const order = await orderModel.findOne({ _id: orderId, user: userId})
//     console.log('order in cancel',order)

//     if(!order){
//       return res.status(404).json({message: 'Order not found'})
//     }
   

//     // if(order.orderStatus !== 'Pending' && order.orderStatus !== 'Confirmed'){
//     //   return res.status(400).json({message: 'Order cannot be cancelled'})
//     // }

//     const result= await orderModel.findOneAndUpdate(
//       { _id: orderId, user: userId, 'items._id': itemId },
//       { $set: { 'items.$.itemStatus': 'Cancelled' } },
//       {new: true}
//     );

//     if(!result){
//       return res.status(404).json({message: 'Item not found in the order'})
//     }
  

//     const updatedOrder = await orderModel.findOne({ _id: orderId, user: userId})

//     const allItemsCancelled = updatedOrder.items.every(item => item.itemStatus === 'Cancelled')
//     if(allItemsCancelled){
//       updatedOrder.orderStatus = 'Cancelled'
//       await updatedOrder.save()
//       console.log("order status :",updatedOrder.orderStatus);
//     }

//     const item = result.items.id(itemId)
//     const product = await productModel.findById(item.product._id)
//     if(product) {
//       product.stock += item.quantity;
//       await product.save()
//     } else {
//       console.log('Product not found for item :', item.product._id);
//     }

//     res.status(200).json({message: 'Order cancelled successfully'})
//   } catch (error) {
//     console.log("order cancel error :",error);
//     res.status(500).send('Internal Server Error');
//   }
// }





export const orderCancel = async (req, res) => {
  try {
    console.log('hi from order cancel');

    const userId = req.session.userID;
    const orderId = req.params.orderID;
    const productId = req.params.productId;

    console.log('productId:', productId);
    console.log('cancel orderId:', orderId);
    console.log('cancel userId:', userId);

    if (!userId || !orderId || !productId) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const order = await orderModel.findOne({ _id: orderId, user: userId });
    

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const item = order.items.find(item => item.product._id.toString() === productId);
    

    if (!item) {
      return res.status(404).json({ message: 'Product not found in the order' });
    }

    item.itemStatus = 'Cancelled';

    const product = await productModel.findById(productId);
    if (product) {
      product.stock += item.quantity;
      await product.save();
    } else {
      console.log('Product not found for item:', productId);
    }


    await order.save();
    

    res.status(200).json({ message: 'Product cancelled successfully' });
  } catch (error) {
    console.log('order cancel error:', error);
    res.status(500).send('Internal Server Error');
  }
};

//^  //  //   //  //         RETURN ORDER   //  //  //  //  //  //  //
export const requestReturn = async (req, res) => {
  try {
    const userId = req.session.userID;
    const orderId = req.params.orderID;
    const itemId = req.params.itemId;
    const { returnReason } = req.body;

    const order = await orderModel.findOne({ _id: orderId, user: userId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Update the item with return request details
    item.returnRequested = true;
    item.itemStatus = 'Return Requested';
    item.returnReason = returnReason;
    item.returnDate = new Date();
    await order.save();

    res.status(200).json({ message: 'Return request submitted successfully' });
  } catch (error) {
    console.log("Error in requesting return:", error);
    res.status(500).send('Internal Server Error');
  }
};
