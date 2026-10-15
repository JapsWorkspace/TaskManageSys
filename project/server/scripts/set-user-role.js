const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/authModel');

function resolveMongoUri(env = process.env) {
  return env.MONGO_URI || env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/project';
}

async function setUserRole(username, role = 'admin') {
  await mongoose.connect(resolveMongoUri());
  const user = await User.findOneAndUpdate(
    { username },
    { $set: { role } },
    { new: true },
  );
  if (!user) throw new Error(`User "${username}" was not found.`);
  return user;
}

async function main() {
  const username = process.argv[2];
  const role = process.argv[3] || 'admin';

  if (!username || !['admin', 'manager', 'member'].includes(role)) {
    console.error('Usage: node scripts/set-user-role.js <username> <admin|manager|member>');
    process.exit(1);
  }

  try {
    const user = await setUserRole(username, role);
    console.log(`${user.username} is now ${user.role}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  resolveMongoUri,
  setUserRole,
};
