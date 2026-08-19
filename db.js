import mongoose from "mongoose";



export const connectToMongo = async () => {
  try {
    
 
    // await mongoose.connect(process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,      // بدل 100
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected  ✅');
    return mongoose.connection;
    
  } catch (err) {
    console.error('Connection error ❌', err);
  }

};
export function getmongoconnect(){
    return connectToMongo()
}


export async function disconnectFromMongo() {
  await mongoose.disconnect();
}
