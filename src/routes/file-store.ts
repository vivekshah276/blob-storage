import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileUpload } from "../controller/file-store";

const router = Router();

//define the file path and file name
const filestorage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, "files");
  },

  filename(req, file, callback) {
    callback(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: filestorage,
}).single("files");

router.post("/upload", upload, fileUpload);

export default router;
