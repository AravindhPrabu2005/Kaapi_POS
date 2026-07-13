const serverless = require('serverless-http');
const app = require('./index');
const { connectToDatabase } = require('./db');

// AWS Lambda handler wrapping the Express application
const handler = serverless(app, {
  request: async (request) => {
    // Ensure the MongoDB connection is established before routing requests
    await connectToDatabase();
  }
});

module.exports.handler = handler;
