import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'signals_db',
});

const dynamicImport = new Function('modulePath', 'return import(modulePath)');

export const getAuth = async () => {
  const { betterAuth } = await dynamicImport('better-auth');
  return betterAuth({
    database: pool,
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000/api/auth',
    trustedOrigins: ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1', 'http://127.0.0.1:3000'],
    emailAndPassword: {
      enabled: true,
    },
  });
};
