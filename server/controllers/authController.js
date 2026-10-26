import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

function createToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, { subject: String(user._id), expiresIn: env.jwtExpiresIn });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = await User.exists({ email: normalizedEmail });
  if (exists) {
    const error = new Error('An account with this email already exists.');
    error.status = 409;
    error.code = 'EMAIL_IN_USE';
    throw error;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash, role: 'citizen' });
  return res.status(201).json({ success: true, data: { user: publicUser(user), token: createToken(user) } });
}

export async function login(req, res) {
  const email = String(req.body.email).trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user ? await user.comparePassword(req.body.password) : false;
  if (!user || !passwordMatches || !user.isActive) {
    const error = new Error('Email or password is incorrect.');
    error.status = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }
  return res.json({ success: true, data: { user: publicUser(user), token: createToken(user) } });
}

export async function me(req, res) {
  return res.json({ success: true, data: { user: publicUser(req.user) } });
}
