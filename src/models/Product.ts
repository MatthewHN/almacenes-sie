import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor provee un nombre para el producto.'],
    unique: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Por favor provee la cantidad cantidad.'],
    default: 0,
  },
});

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
