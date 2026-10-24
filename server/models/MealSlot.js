import mongoose from 'mongoose';

const MealSlotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    startTime: {
      type: String,
      default: '07:30',
    },
    endTime: {
      type: String,
      default: '11:00',
    },
    displayName: {
      type: String,
      default: '',
    },
    tamilDisplayName: {
      type: String,
      default: '',
    },
    emoji: {
      type: String,
      default: '🥞',
    },
    category: {
      type: String,
      default: 'Morning',
    },
    description: {
      type: String,
      default: '',
    },
    rate: {
      type: Number,
      default: 40,
    },
    cost: {
      type: Number,
      default: 40,
    },
    isEligible: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'mealslots',
  }
);

export const MealSlot = mongoose.models.MealSlot || mongoose.model('MealSlot', MealSlotSchema);
