import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

export async function createNotification(input) {
  return Notification.create(input);
}

export async function notifyStaff(input) {
  const staff = await User.find({ role: { $in: ["admin", "support"] } }).select("_id").lean();
  if (staff.length === 0) return [];

  return Notification.insertMany(staff.map(({ _id }) => ({ ...input, user: _id })));
}
