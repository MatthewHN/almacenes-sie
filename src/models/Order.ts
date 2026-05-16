import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);