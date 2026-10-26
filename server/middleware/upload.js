import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(moduleDirectory, '..', env.uploadDirectory);
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const extensionForMime = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${extensionForMime.get(file.mimetype) || ''}`),
});

export const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Upload a JPEG, PNG, WebP, or GIF image.');
      error.status = 415;
      error.code = 'UNSUPPORTED_MEDIA_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

export { uploadDirectory };
