import mongoose from "mongoose";



export const connectToMongo = async () => {
  try {
    
    //  let url="mongodb://mongo:cFDrjTszcvKtTnlqYYAfDdIlLMzPsEHh@roundhouse.proxy.rlwy.net:48576"
    let url="mongodb://mongo:oLPKNwJgoekCxJOfAiksTbuQZMInmFaX@kodama.proxy.rlwy.net:43793"
    // let url="mongodb://127.0.0.1:27017/Promax"
    // await mongoose.connect('mongodb://127.0.0.1:27017/Promax');
    await mongoose.connect(process.env.MONGO_URI);

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
