import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100, unique: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    pricingUnit: { type: String, required: true, enum: ['kg', 'item'] },
    price: { type: Number, required: true, min: 0.01 },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

const Service = mongoose.model('Service', serviceSchema);

export default Service;
