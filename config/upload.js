import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// const fileFilter = (req, file, cb) => {
//   // webp added to support Gallery image uploads (jpeg/jpg/pdf/png still
//   // accepted exactly as before for every other existing upload field).
//   const allowedTypes = /jpeg|jpg|pdf|png|webp/;
//   const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//   const mimetype = allowedTypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb(new Error("Only .png, .jpg, .jpeg, .webp, and .pdf format allowed!"));
//   }
// };
const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const isImage = file.mimetype?.startsWith("image/");
  const isPdf = file.mimetype === "application/pdf" && extension === ".pdf";

  if (isImage || isPdf) {
    return cb(null, true);
  }

  cb(new Error("All image types and PDF files are allowed!"));
};
export const createUploader=(folder)=>{
 
  
    const uploadDir = path.join(__dirname, "..", "public", "images", folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Gallery images are always routed to their own "gallery" folder
    // (instead of whatever folder this uploader instance was created for,
    // e.g. "users") regardless of which route/uploader includes the
    // "galleryImages" field. They only live here briefly: GalleryService
    // reads the raw file, optimizes it with Sharp into the Gallery
    // volume/storage location, then deletes this temp copy.
    const galleryUploadDir = path.join(__dirname, "..", "public", "images", "gallery");
    if (!fs.existsSync(galleryUploadDir)) {
      fs.mkdirSync(galleryUploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
     
      destination: (req, file, cb) => {
        
      
        if (file.fieldname === "galleryImages") {
          req.uploadFolder = "gallery";
          return cb(null, galleryUploadDir);
        }
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
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: fileFilter,
    });
  return upload;
}



