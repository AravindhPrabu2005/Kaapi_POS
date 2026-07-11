const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  schema: './src/db/schema/index.js',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.Postgres_URL,
  },
});
