import mongoose from "mongoose";

const teamUpdateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    url: { type: String, trim: true, maxlength: 1000 },
    mimeType: { type: String, trim: true, maxlength: 120 },
    size: { type: Number, min: 0 },
  },
  { _id: false }
);

const productRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: String, trim: true, maxlength: 200 },
    externalProductId: { type: String, trim: true, maxlength: 200 },
    productName: { type: String, required: true, trim: true, maxlength: 300 },
    brand: { type: String, trim: true, maxlength: 200 },
    sku: { type: String, trim: true, maxlength: 120 },
    category: { type: String, trim: true, maxlength: 200 },
    quantity: { type: Number, min: 1 },
    branch: { type: String, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 2000 },
    notes: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["Under Review", "Available", "Searching Supplier", "Not Available", "Canceled"],
      default: "Under Review",
      index: true,
    },
    source: {
      type: String,
      enum: ["PRODUCT_PAGE", "ACCOUNT_PAGE", "CHAT"],
      default: "ACCOUNT_PAGE",
    },
    chatThread: { type: mongoose.Schema.Types.ObjectId, ref: "SupportThread" },
    teamUpdates: { type: [teamUpdateSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    externalSystemName: { type: String, trim: true, maxlength: 200 },
    externalStatus: { type: String, trim: true, maxlength: 200 },
    syncStatus: { type: String, trim: true, maxlength: 100 },
    lastSyncedAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true, versionKey: false }
);

productRequestSchema.index({ user: 1, createdAt: -1 });

export const ProductRequest = mongoose.model("ProductRequest", productRequestSchema);
