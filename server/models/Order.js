import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    token: {
      type: Number,
      required: true,
      index: true,
    },
    orderUuid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    dept: {
      type: String,
      required: true,
    },
    meal: {
      type: String,
      required: true,
      index: true,
    },
    items: {
      type: Array,
      default: [],
    },
    rate: {
      type: Number,
      default: 40,
    },
    qty: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['PRINTED', 'SERVED', 'CANCELLED'],
      default: 'PRINTED',
      index: true,
    },
    issuedAt: {
      type: String,
      default: '',
    },
    servedAt: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Number,
      default: () => Date.now(),
      index: true,
    },
    dateStr: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'orders',
  }
);

export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
