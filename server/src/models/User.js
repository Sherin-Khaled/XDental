import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    professionalRole: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    role: {
      type: String,
      enum: ["customer", "admin", "support"],
      default: "customer",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const User = mongoose.model("User", userSchema);
