const serverless = require('serverless-http');
const app = require('./index');
const { connectToDatabase } = require('./db');

let initialized = false;

module.exports.handler = async (event, context) => {
  if (!initialized) {
    await connectToDatabase();
    initialized = true;
  }

  return serverless(app)(event, context);
};
