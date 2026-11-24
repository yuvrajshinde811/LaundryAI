import mongoose from 'mongoose';

const bookingItemSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true },
    pricingUnit: { type: String, enum: ['kg', 'item'], required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0.01 },
    subtotal: { type: Number, required: true, min: 0.01 },
  },
  { _id: false },
);

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'picked_up', 'processing', 'ready', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'],
      required: true,
    },
    changedAt: { type: Date, required: true, default: Date.now },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [bookingItemSchema], required: true, validate: items => items.length > 0 },
    pickupAt: { type: Date, required: true },
    pickupAddress: { type: String, required: true, trim: true, maxlength: 300 },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 300 },
    instructions: { type: String, trim: true, maxlength: 500, default: '' },
    estimatedTotal: { type: Number, required: true, min: 0.01 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'picked_up', 'processing', 'ready', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'],
      default: 'pending',
      required: true,
    },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
  },
  { timestamps: true },
);

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
