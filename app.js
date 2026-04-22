import "dotenv/config";
import express from "express";
import os from "os";
import { connectToMongo } from "./db.js";
import registerModels from "./registerModels.js";
import apiRouter from "./Routes/api.js";
import signUpRouter from "./Routes/signUp.js";
import path from "path";
import { fileURLToPath } from "url";
import ExerciseRouter from "./Routes/Exercise.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));


app.use("/api", signUpRouter);
app.use("/api", apiRouter);

// exercises
app.use("/api/exercise", ExerciseRouter);




app.use((err, req, res, next) => {
      console.error("Error:", err);
      res.status(500).json({ 
        message: "Server error", 
        error: err?.message || err,
        stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function getLocalIP() {
  const nets = os.networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

async function start() {
  await connectToMongo();
  registerModels();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
