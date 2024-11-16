import orderModel from '../../models/order.js';
import productModel from '../../models/product.models.js'
import userModel from '../../models/User.js'
import addressModel from '../../models/address.js';

//^ // // //  // // // Get order list ---> Order Management // // // // // // // // //

export const getOrderList = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;
  
      const orderlist = await orderModel.find({})
        .populate({
          path: 'items.product',
          select: 'name image'
        })
        .populate('user', 'name')
        .populate('address')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const totalorders = await orderModel.countDocuments({});
      const totalPages = Math.ceil(totalorders / limit);
      const startIndex = skip + 1;
  
      res.render('admin/orderList', {
        orderlist,
        currentPage: page,
        totalPages,
        startIndex
      });
    } catch (error) {
      console.error("Error fetching order list:", error.message, error.stack);
      res.status(500).send('Internal Server Error');
    }
  };

  //^ // // //  // // // Change in item status in Order Management // // // // // // // // //

  export const changeItemStatus = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const itemId = req.params.itemId;
      const status = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
  
      // Fetch the order and find the specific item
      const order = await orderModel.findOne({
        _id: orderId,
        'items._id': itemId
      });
  
      if (!order) {
        return res.status(404).json({ success: false, message: "Order or item not found" });
      }
  
      // Locate the item and determine its current status index
      const item = order.items.id(itemId);
      const currentStatusIndex = status.indexOf(item.itemStatus);
  
      // Check if status is already at the last stage
      if (currentStatusIndex === -1 || currentStatusIndex >= status.length - 1) {
        return res.status(400).json({ success: false, message: "Cannot change item status further" });
      }
  
      // Move to the next status
      const newStatus = status[currentStatusIndex + 1];
  
      // Update the item’s status in the order
      item.itemStatus = newStatus;
      await order.save();
  
      // Re-fetch the updated order to check all items' statuses
      const updatedOrder = await orderModel.findById(orderId);
  
      // Check if all items have the same status as the newStatus
      const allItemStatuses = updatedOrder.items.map((itm) => itm.itemStatus);
      if (allItemStatuses.every((itemStatus) => itemStatus === newStatus)) {
        updatedOrder.orderStatus = newStatus;
        await updatedOrder.save();
      }
  
      res.status(200).json({ success: true, newStatus });
    } catch (error) {
      console.log("Error changing item status:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
  
  //^ // // //  // // // Order details // // // // // // // // //

  export const orderDetails = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const order = await orderModel.findById(orderId)
        .populate('user', 'name email')
        .populate('address')
        .populate({
          path: 'items.product',
          select: 'name image price' // Ensure 'image' matches the field in your Product schema
        });
  
      if (!order) {
        return res.status(404).send("Order not found");
      }
  
      console.log(order.items[0].product.image); 
      res.render('admin/orderDetailsModal', {order , layout :false})

    } catch (error) {
      console.log("Error getting order details:", error);
      res.status(500).send("Internal server error");
    }
  };
  