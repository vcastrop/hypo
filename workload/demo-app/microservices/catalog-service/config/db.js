import mongoose from 'mongoose';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async (retries = 30) => {
  const uri = process.env.MONGO_URI || 'mongodb://mongodb:27017/catalog_db';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log('Connected to MongoDB (catalog_db)');
      return;
    } catch (err) {
      console.error(`MongoDB catalog not ready (${attempt}/${retries}):`, err.message);
      if (attempt === retries) process.exit(1);
      await sleep(2000);
    }
  }
};

export default connectDB;
