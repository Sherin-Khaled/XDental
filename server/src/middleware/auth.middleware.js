import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { AUTH_COOKIE_NAME } from "../utils/createToken.js";

export async function requireAuth(request, response, next) {
  const token = request.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return response.status(401).json({ message: "Authentication required." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return response.status(401).json({ message: "Invalid or expired session." });
  }

  if (typeof payload !== "object" || typeof payload.sub !== "string") {
    return response.status(401).json({ message: "Invalid or expired session." });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    return response.status(401).json({ message: "Invalid or expired session." });
  }

  request.user = user;
  return next();
}
