import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import {
  clearAuthCookie,
  createToken,
  setAuthCookie,
} from "../utils/createToken.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    professionalRole: user.professionalRole ?? null,
  };
}

function validateCredentials(email, password) {
  if (!email || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }

  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }

  return null;
}

export async function register(request, response) {
  const name = normalizeText(request.body?.name);
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  const phone = normalizeText(request.body?.phone);
  const professionalRole = normalizeText(request.body?.professionalRole);

  if (name.length < 2 || name.length > 100) {
    return response.status(400).json({ message: "Name must be between 2 and 100 characters." });
  }

  const credentialsError = validateCredentials(email, password);
  if (credentialsError) {
    return response.status(400).json({ message: credentialsError });
  }

  if (password.length < 8 || password.length > 128) {
    return response.status(400).json({ message: "Password must be between 8 and 128 characters." });
  }

  if (phone.length > 30) {
    return response.status(400).json({ message: "Phone number must be 30 characters or fewer." });
  }

  if (professionalRole.length > 100) {
    return response.status(400).json({ message: "Professional role must be 100 characters or fewer." });
  }

  const existingUser = await User.exists({ email });
  if (existingUser) {
    return response.status(409).json({ message: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await User.create({
      name,
      email,
      passwordHash,
      ...(phone ? { phone } : {}),
      ...(professionalRole ? { professionalRole } : {}),
    });

    setAuthCookie(response, createToken(user.id));
    return response.status(201).json({ user: toSafeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ message: "An account with this email already exists." });
    }
    throw error;
  }
}

export async function login(request, response) {
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  const credentialsError = validateCredentials(email, password);

  if (credentialsError) {
    return response.status(400).json({ message: credentialsError });
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  setAuthCookie(response, createToken(user.id));
  return response.json({ user: toSafeUser(user) });
}

export function logout(_request, response) {
  clearAuthCookie(response);
  return response.json({ message: "Signed out successfully." });
}

export function me(request, response) {
  return response.json({ user: toSafeUser(request.user) });
}
