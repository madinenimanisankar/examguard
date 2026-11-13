const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUrl, { dbName: env.dbName });
  console.log(`[db] connected to "${mongoose.connection.name}"`);
}

module.exports = connectDB;
