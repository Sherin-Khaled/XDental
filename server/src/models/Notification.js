import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["PRODUCT_REQUEST", "SUPPORT_MESSAGE", "PRODUCT_AVAILABLE", "ORDER_UPDATE", "QUOTE_UPDATE", "ACCOUNT"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true, maxlength: 1000 },
    readAt: Date,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
