import mongoose from 'mongoose';

const FoodTransportSchema = new mongoose.Schema(
  {
    unitName: {
      type: String,
      required: true,
    },
    mealType: {
      type: String,
      required: true,
    },
    menuItems: {
      type: String,
      default: '',
    },
    personCount: {
      type: Number,
      default: 1,
    },
    primaryQuantity: {
      type: Number,
      default: 0,
    },
    primaryUnit: {
      type: String,
      enum: ['kg', 'count'],
      default: 'kg',
    },
    items: {
      type: Array,
      default: [],
    },
    dispatchDate: {
      type: String,
      required: true,
      index: true,
    },
    dispatchTime: {
      type: String,
      required: true,
    },
    vehicleOrDriver: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['DISPATCHED', 'DELIVERED', 'IN_TRANSIT'],
      default: 'DISPATCHED',
    },
    notes: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Number,
      default: () => Date.now(),
    },
  },
  {
    timestamps: true,
    collection: 'foodtransports',
  }
);

export const FoodTransport = mongoose.models.FoodTransport || mongoose.model('FoodTransport', FoodTransportSchema);
