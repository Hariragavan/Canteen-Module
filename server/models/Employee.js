import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dept: {
      type: String,
      required: true,
      trim: true,
    },
    photo_url: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['Employee', 'Staff'],
      default: 'Employee',
    },
    face_descriptor: {
      type: [Number],
      default: null, // 128-dimensional floating point vector
    },
    confidence_score: {
      type: Number,
      default: 0.98,
    },
    subsidy_rate: {
      type: Number,
      default: 1.0,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'employees',
  }
);

export const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
