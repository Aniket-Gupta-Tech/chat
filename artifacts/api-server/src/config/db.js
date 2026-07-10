import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('⚠️  MONGO_URI is not set. Database features will not work.');
    console.warn('   Set MONGO_URI in your environment to enable full functionality.');
    console.warn('   Example: MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/chatapp');
    return; // Don't crash — let the server start for health checks
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.warn('   Database features will not work. Check MONGO_URI and retry.');
    // Don't crash — server stays up for health checks
  }
};

export const checkConnection = () => isConnected;

export default connectDB;
