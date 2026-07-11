const { DrizzleDb } = require('./index');

function drizzle() {
  return new DrizzleDb();
}

module.exports = {
  drizzle,
};
