import mongoose from 'mongoose';

const FeedbackSchema = new mongoose.Schema(
  {
    mealSlot: {
      type: String,
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Number,
      default: () => Date.now(),
    },
    dateStr: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'feedbacks',
  }
);

export const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);
