const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

let cachedClient = null;
let cachedDb = null;

async function getMongoDb() {
  if (cachedDb) return cachedDb;
  require('dotenv').config();
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/odoocafe';
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  cachedClient = client;

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

  cachedDb = client.db(dbName || 'odoocafe');
  return cachedDb;
}

async function closeMongoDb() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}

function convertConditionToMongoFilter(cond) {
  if (!cond) return {};

  if (cond.type === 'eq') {
    return { [cond.field]: cond.value };
  }

  if (cond.type === 'ne') {
    return { [cond.field]: { $ne: cond.value } };
  }

  if (cond.type === 'lte') {
    return { [cond.field]: { $lte: cond.value } };
  }

  if (cond.type === 'gte') {
    return { [cond.field]: { $gte: cond.value } };
  }

  if (cond.type === 'isNull') {
    return { [cond.field]: null };
  }

  if (cond.type === 'like') {
    if (cond.field && cond.field.type === 'sql') {
      const pattern = cond.value;
      let term = pattern;
      if (term.startsWith('%')) term = term.slice(1);
      if (term.endsWith('%')) term = term.slice(0, -1);
      const num = parseInt(term, 10);
      if (!isNaN(num)) {
        return { tableNumber: num };
      }
      return { $expr: { $regexMatch: { input: { $toString: "$tableNumber" }, regex: term, options: "i" } } };
    }

    let pattern = cond.value;
    if (pattern.startsWith('%')) pattern = pattern.slice(1);
    if (pattern.endsWith('%')) pattern = pattern.slice(0, -1);
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { [cond.field]: new RegExp(escaped, 'i') };
  }

  if (cond.type === 'and') {
    const filters = cond.conditions
      .map(c => convertConditionToMongoFilter(c))
      .filter(f => Object.keys(f).length > 0);
    if (filters.length === 0) return {};
    if (filters.length === 1) return filters[0];
    return { $and: filters };
  }

  if (cond.type === 'or') {
    const filters = cond.conditions
      .map(c => convertConditionToMongoFilter(c))
      .filter(f => Object.keys(f).length > 0);
    if (filters.length === 0) return {};
    if (filters.length === 1) return filters[0];
    return { $or: filters };
  }

  if (cond.type === 'sql') {
    const chunks = cond.queryChunks || [];
    const values = cond.values || [];
    const sqlText = chunks.map(c => typeof c === 'string' ? c : '?').join('');

    if (sqlText.includes('::text LIKE')) {
      const val = values[0];
      let pattern = val || '';
      if (pattern.startsWith('%')) pattern = pattern.slice(1);
      if (pattern.endsWith('%')) pattern = pattern.slice(0, -1);
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { createdAt: new RegExp(escaped, 'i') };
    }

    if (sqlText.includes('>=') && sqlText.includes('timestamp')) {
      return { openedAt: { $gte: values[0] } };
    }
    if (sqlText.includes('<=') && sqlText.includes('timestamp')) {
      return { openedAt: { $lte: values[0] } };
    }

    if (sqlText.includes('DATE(') && sqlText.includes('=')) {
      const val = values[0];
      return { openedAt: { $regex: `^${val}` } };
    }
  }

  return {};
}

function convertOrderByToMongoSort(orderByVal) {
  if (Array.isArray(orderByVal)) {
    const sort = {};
    for (const item of orderByVal) {
      if (item && item.field) {
        sort[item.field] = item.direction;
      }
    }
    return sort;
  }
  if (orderByVal && orderByVal.field) {
    return { [orderByVal.field]: orderByVal.direction };
  }
  if (orderByVal && orderByVal.name) {
    return { [orderByVal.name]: 1 };
  }
  return {};
}

class SelectQuery {
  constructor(fields) {
    this.fields = fields;
    this.tableName = null;
    this.whereCondition = null;
    this.limitVal = null;
    this.offsetVal = null;
    this.orderByVal = null;
  }

  from(table) {
    this.tableName = table.tableName || table.name;
    return this;
  }

  where(condition) {
    this.whereCondition = condition;
    return this;
  }

  limit(val) {
    this.limitVal = val;
    return this;
  }

  offset(val) {
    this.offsetVal = val;
    return this;
  }

  orderBy(...vals) {
    this.orderByVal = vals.flat();
    return this;
  }

  async execute() {
    const mongoDb = await getMongoDb();
    const collection = mongoDb.collection(this.tableName);
    const filter = convertConditionToMongoFilter(this.whereCondition);

    if (this.fields && this.fields.count) {
      const count = await collection.countDocuments(filter);
      return [{ count }];
    }

    if (this.fields && this.fields.total) {
      const docs = await collection.find(filter).toArray();
      const sum = docs.reduce((acc, doc) => acc + parseFloat(doc.total || 0), 0);
      return [{ total: sum.toFixed(2) }];
    }

    let cursor = collection.find(filter);

    if (this.orderByVal) {
      const sortDoc = convertOrderByToMongoSort(this.orderByVal);
      if (Object.keys(sortDoc).length > 0) {
        cursor = cursor.sort(sortDoc);
      }
    }

    if (this.offsetVal !== null && this.offsetVal !== undefined) {
      cursor = cursor.skip(this.offsetVal);
    }

    if (this.limitVal !== null && this.limitVal !== undefined) {
      cursor = cursor.limit(this.limitVal);
    }

    return await cursor.toArray();
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class InsertQuery {
  constructor(table) {
    this.tableName = table.tableName || table.name;
    this.data = null;
  }

  values(data) {
    this.data = data;
    return this;
  }

  returning() {
    return this;
  }

  async execute() {
    const mongoDb = await getMongoDb();
    const collection = mongoDb.collection(this.tableName);

    const assignIds = (doc) => {
      const copy = { ...doc };
      if (!copy.id) {
        copy.id = uuidv4();
      }
      if (!copy.createdAt) {
        copy.createdAt = new Date().toISOString();
      }
      if (!copy.updatedAt) {
        copy.updatedAt = new Date().toISOString();
      }
      return copy;
    };

    if (Array.isArray(this.data)) {
      const docs = this.data.map(assignIds);
      if (docs.length > 0) {
        await collection.insertMany(docs);
      }
      return docs;
    } else {
      const doc = assignIds(this.data);
      await collection.insertOne(doc);
      return [doc];
    }
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class UpdateQuery {
  constructor(table) {
    this.tableName = table.tableName || table.name;
    this.updates = null;
    this.whereCondition = null;
  }

  set(updates) {
    this.updates = updates;
    return this;
  }

  where(condition) {
    this.whereCondition = condition;
    return this;
  }

  returning() {
    return this;
  }

  async execute() {
    const mongoDb = await getMongoDb();
    const collection = mongoDb.collection(this.tableName);
    const filter = convertConditionToMongoFilter(this.whereCondition);

    const updatesDoc = { ...this.updates };
    if (!updatesDoc.updatedAt) {
      updatesDoc.updatedAt = new Date().toISOString();
    }

    const docsToUpdate = await collection.find(filter).toArray();
    if (docsToUpdate.length === 0) {
      return [];
    }

    const ids = docsToUpdate.map(d => d._id);
    await collection.updateMany(
      { _id: { $in: ids } },
      { $set: updatesDoc }
    );

    return await collection.find({ _id: { $in: ids } }).toArray();
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class DeleteQuery {
  constructor(table) {
    this.tableName = table.tableName || table.name;
    this.whereCondition = null;
  }

  where(condition) {
    this.whereCondition = condition;
    return this;
  }

  returning() {
    return this;
  }

  async execute() {
    const mongoDb = await getMongoDb();
    const collection = mongoDb.collection(this.tableName);
    const filter = convertConditionToMongoFilter(this.whereCondition);

    const docsToDelete = await collection.find(filter).toArray();
    if (docsToDelete.length === 0) {
      return [];
    }

    const ids = docsToDelete.map(d => d._id);
    await collection.deleteMany({ _id: { $in: ids } });

    return docsToDelete;
  }

  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class DrizzleDb {
  select(fields) {
    return new SelectQuery(fields);
  }
  insert(table) {
    return new InsertQuery(table);
  }
  update(table) {
    return new UpdateQuery(table);
  }
  delete(table) {
    return new DeleteQuery(table);
  }
}

const eq = (field, value) => ({ type: 'eq', field: field.name || field, value });
const ne = (field, value) => ({ type: 'ne', field: field.name || field, value });
const lte = (field, value) => ({ type: 'lte', field: field.name || field, value });
const gte = (field, value) => ({ type: 'gte', field: field.name || field, value });
const isNull = (field) => ({ type: 'isNull', field: field.name || field });
const like = (field, value) => ({ type: 'like', field: field.name || field, value });
const and = (...conditions) => ({ type: 'and', conditions });
const or = (...conditions) => ({ type: 'or', conditions });
const desc = (field) => ({ field: field.name || field, direction: -1 });
const asc = (field) => ({ field: field.name || field, direction: 1 });
const sql = (chunks, ...values) => ({ type: 'sql', queryChunks: chunks, values });
const relations = () => ({});

module.exports = {
  DrizzleDb,
  getMongoDb,
  closeMongoDb,
  eq,
  ne,
  lte,
  gte,
  isNull,
  like,
  and,
  or,
  desc,
  asc,
  sql,
  relations,
};
