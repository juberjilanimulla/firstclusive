import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import mongoose from "mongoose";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import blogsmodel from "../../models/blogsmodel.js";
import getnumber from "../../helpers/helperFunction.js";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Define the checkFileType function
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Error: Images Only!"));
  }
}

// Configure multer for direct file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads");
    fs.mkdirSync(uploadPath, { recursive: true }); // Ensure directory exists
    cb(null, uploadPath);
  },
  filename: async (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const pid = req.params.id;
    const productnumber = await getnumber(pid); // Generate product number
    const id = Math.floor(Math.random() * 900000) + 1000; // Generate random ID
    const filename = `${productnumber}__${id}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).single("coverimage");

const coverimageuploadRouter = Router();

coverimageuploadRouter.post("/:id", async (req, res) => {
  // Use upload middleware
  upload(req, res, async (err) => {
    if (err) {
      return errorResponse(res, 400, err.message || "Upload error");
    }

    if (!req.file) {
      return errorResponse(res, 400, "No file was uploaded.");
    }

    try {
      const blogid = req.params.id.trim();

      if (!mongoose.Types.ObjectId.isValid(blogid)) {
        fs.unlinkSync(req.file.path);
        return errorResponse(res, 400, "Invalid blog ID");
      }

      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "firstclusive/blog-covers",
      });

      // Clean up temp file
      fs.unlinkSync(req.file.path);

      const blog = await blogsmodel.findByIdAndUpdate(
        blogid,
        { coverimage: uploadResult.secure_url },
        { new: true }
      );
      if (!blog) {
        return errorResponse(res, 404, "Blog not found");
      }

      return successResponse(res, "Image successfully uploaded", blog);
    } catch (error) {
      console.error("Error:", error.message);
      return errorResponse(res, 500, "Internal server error");
    }
  });
});

export default coverimageuploadRouter;
