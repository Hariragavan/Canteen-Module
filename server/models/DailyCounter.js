import mongoose from 'mongoose';

const DailyCounterSchema = new mongoose.Schema(
  {
    counterDate: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastToken: {
      type: Number,
      default: 100,
    },
  },
  {
    timestamps: true,
    collection: 'dailycounters',
  }
);

export const DailyCounter = mongoose.models.DailyCounter || mongoose.model('DailyCounter', DailyCounterSchema);
