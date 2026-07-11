require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  databaseUrl: process.env.Postgres_URL,
  jwtSecret:
    process.env.JWT_SECRET || "odoocafe-pos-secret-key-change-in-production",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  resendApiKey: process.env.Resend_API_KEY,
};
