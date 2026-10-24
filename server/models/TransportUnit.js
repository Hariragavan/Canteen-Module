import mongoose from 'mongoose';

const TransportUnitSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      default: '',
    },
    contactPerson: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'transportunits',
  }
);

export const TransportUnit = mongoose.models.TransportUnit || mongoose.model('TransportUnit', TransportUnitSchema);
