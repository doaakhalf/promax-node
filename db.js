import mongoose from "mongoose";

export function getMongoUri() {
  // const url="mongodb+srv://root_db_user:yc3aty3C-ntf4L2@cluster0.wt669lu.mongodb.net/PromaxNode?appName=Cluster0"
  // const url="mongodb://127.0.0.1:27017/promax"
     let url="mongodb://mongo:cFDrjTszcvKtTnlqYYAfDdIlLMzPsEHh@roundhouse.proxy.rlwy.net:48576"


  const uri = process.env.MONGO_URI  || url;
  if (!uri) {
    throw new Error("Missing Mongo connection string. Set MONGO_URI (or MONGODB_URI) in your environment.");
  }
  return uri;
}

// export async function connectToMongo(mongoUri = getMongoUri()) {
//   await mongoose.connect(mongoUri);
//   return mongoose.connection;
// }

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
