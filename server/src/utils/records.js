import mongoose from "mongoose";

export function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export function cleanText(value, maxLength = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, maxLength);
}

export function safeUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function nextPublicNumber(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}
