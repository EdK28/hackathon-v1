import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from './config.js';

mongoose.set('strictQuery', true);

// mongodb+srv:// needs a DNS SRV lookup that some home routers refuse
// ("querySrv ECONNREFUSED"). Set MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1 to fix.
if (process.env.MONGO_DNS_SERVERS) {
  const servers = process.env.MONGO_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  dns.setServers(servers);
  dns.promises.setServers(servers);
}

export async function connectDb(uri = config.mongoUri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

export const disconnectDb = () => mongoose.disconnect();
