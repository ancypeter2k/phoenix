import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      discountPrice: {
        type: Number,
      },
      discountAmount: {
        type: Number,
      },
      itemTotal: {
        type: Number,
        required: true
      },
      itemStatus: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'],
        default: 'Pending',
      },
    },
  ],
  address: {
    name:{
      type:String,
      required:true
    },
    buildingName:{
      type:String,
      required:true
    },
    street:{
      type:String,
      required:true
    },
    city:{
      type:String,
      required:true
    },
    state:{
      type:String,
      required:true
    },
    country:{
      type:String,
      required:true
    },
    pincode:{
      type:String,
      required:true
    },
    mobile:{
      type:String,
      required:true
    },
  },
  subtotal: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Razorpay', 'Wallet'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'],
    default: 'Pending',
  },
  orderedAt: {
    type: Date,
    default: Date.now,
  },
  deliveredAt: {
    type: Date,
  },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;