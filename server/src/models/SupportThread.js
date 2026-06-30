import mongoose from "mongoose";

const supportThreadSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productRequest: { type: mongoose.Schema.Types.ObjectId, ref: "ProductRequest", index: true },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    type: {
      type: String,
      enum: ["PRODUCT_REQUEST", "GENERAL_SUPPORT", "ORDER", "QUOTE"],
      default: "GENERAL_SUPPORT",
    },
    related: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ["Open", "Waiting for Support", "Waiting for Customer", "Resolved"],
      default: "Open",
      index: true,
    },
    priority: { type: String, enum: ["Normal", "Urgent"], default: "Normal" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

supportThreadSchema.index({ user: 1, lastMessageAt: -1 });

export const SupportThread = mongoose.model("SupportThread", supportThreadSchema);
