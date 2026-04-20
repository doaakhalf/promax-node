import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
  }
};
export const createUploader=(folder)=>{
  console.log(folder);
  
    const uploadDir = path.join(__dirname, "..", "public", "images", folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        req.uploadFolder=folder
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    });
    const upload = multer({
      storage: storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: fileFilter,
    });
  return upload;
}



