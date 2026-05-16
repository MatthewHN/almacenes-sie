import mongoose from 'mongoose';

const WasteSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, default: 'Caducidad' },
  date: { type: Date, default: Date.now },
});

export default mongoose.models.Waste || mongoose.model('Waste', WasteSchema);