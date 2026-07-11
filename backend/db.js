const { drizzle } = require('drizzle-orm/node-postgres');
const { getMongoDb, closeMongoDb } = require('drizzle-orm');
require('dotenv').config();

const db = drizzle();

// Mock connection pool for health checks and seed end() compatibility
const pool = {
  query: async () => {
    const mongoDb = await getMongoDb();
    await mongoDb.command({ ping: 1 });
    return { rows: [{ '1': 1 }] };
  },
  end: async () => {
    await closeMongoDb();
  }
};

module.exports = { db, pool };
