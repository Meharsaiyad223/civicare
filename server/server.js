import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { uploadDirectory } from './middleware/upload.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import mapRoutes from './routes/map.js';
import officerRoutes from './routes/officer.js';
import weeklyRoutes from './routes/weekly.js';
import memoryRoutes from './routes/memory.js';
import repairRoutes from './routes/repairs.js';
import workOrderRoutes from './routes/workOrders.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin, credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/api', apiRateLimit);

app.get('/api/health', (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const status = databaseConnected ? 'ok' : 'degraded';
  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    data: { status, service: 'civiccare-api', database: databaseConnected ? 'connected' : 'disconnected', time: new Date().toISOString() },
  });
});
app.use('/uploads', express.static(uploadDirectory, { fallthrough: false, maxAge: env.nodeEnv === 'production' ? '1d' : 0 }));
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/weekly', weeklyRoutes);
app.use('/api/memory', memoryRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export async function startServer() {
  await connectDatabase();
  return app.listen(env.port, () => {
    console.log(`CivicCare API listening on http://localhost:${env.port}`);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.join(moduleDirectory, 'server.js');
if (isMain) {
  startServer().catch((error) => {
    console.error('Failed to start CivicCare API:', error.message);
    process.exitCode = 1;
  });
}

export default app;
