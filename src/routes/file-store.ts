import { Router } from "express";
import multer from "multer";
import {  deleteFile, getFile, getSingleFile, updatFile, uploadFile } from "../controller/file-store";

const router = Router();
const upload = multer();

router.post("/upload", upload.single("file"), uploadFile);
router.delete("/delete/:filename", deleteFile);
router.put("/update/:oldfilename",upload.single("file"), updatFile);
router.get("/get",getFile)
router.get("/get/:filename",getSingleFile)

export default router;
