import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
  {
    thread: { type: mongoose.Schema.Types.ObjectId, ref: "SupportThread", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    senderRole: {
      type: String,
      enum: ["CUSTOMER", "SUPPORT", "ADMIN", "SYSTEM"],
      required: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: Date,
  },
  { timestamps: true, versionKey: false }
);

supportMessageSchema.index({ thread: 1, createdAt: 1 });

export const SupportMessage = mongoose.model("SupportMessage", supportMessageSchema);
