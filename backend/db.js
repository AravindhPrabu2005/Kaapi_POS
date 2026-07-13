const { MongoClient } = require('mongodb');
require('dotenv').config();

let client = null;
let dbInstance = null;

async function connectToDatabase() {
  if (dbInstance) return dbInstance;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }

  let dbName = 'odoocafe';
  try {
    const urlObj = new URL(uri);
    const pathname = urlObj.pathname.replace(/^\//, '');
    if (pathname) {
      dbName = pathname.split('?')[0];
    }
  } catch (err) {
    // ignore
  }

  dbInstance = client.db(dbName || 'odoocafe');
  return dbInstance;
}

async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
  }
}

// Chainable thenable Proxy helper for MongoDB Cursors
class CursorProxy {
  constructor(collectionName, initialMethod, initialArgs) {
    this.collectionName = collectionName;
    this.calls = [[initialMethod, initialArgs]];
  }

  sort(...args) {
    this.calls.push(['sort', args]);
    return this;
  }

  skip(...args) {
    this.calls.push(['skip', args]);
    return this;
  }

  limit(...args) {
    this.calls.push(['limit', args]);
    return this;
  }

  project(...args) {
    this.calls.push(['project', args]);
    return this;
  }

  toArray(...args) {
    this.calls.push(['toArray', args]);
    return this;
  }

  async execute() {
    const instance = await connectToDatabase();
    let target = instance.collection(this.collectionName);

    for (const [method, args] of this.calls) {
      target = target[method](...args);
    }

    if (target && typeof target.then === 'function') {
      return await target;
    }
    return target;
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Export a dynamic Proxy for `db` so routes can call `db.collection(...)` directly
const db = new Proxy({}, {
  get(target, prop) {
    if (prop === 'collection') {
      return (name) => {
        return new Proxy({}, {
          get(colTarget, method) {
            // For cursor-returning methods, return a CursorProxy to allow chaining
            if (method === 'find' || method === 'aggregate') {
              return (...args) => new CursorProxy(name, method, args);
            }
            // For other CRUD operations, run directly
            return async (...args) => {
              const instance = await connectToDatabase();
              return instance.collection(name)[method](...args);
            };
          }
        });
      };
    }
    if (prop === 'command') {
      return async (...args) => {
        const instance = await connectToDatabase();
        return instance.command(...args);
      };
    }
    return target[prop];
  }
});

// Mock connection pool for health checks and seed end() compatibility
const pool = {
  query: async () => {
    const instance = await connectToDatabase();
    await instance.command({ ping: 1 });
    return { rows: [{ '1': 1 }] };
  },
  end: async () => {
    await closeDatabase();
  }
};

module.exports = { db, pool, connectToDatabase, closeDatabase };
