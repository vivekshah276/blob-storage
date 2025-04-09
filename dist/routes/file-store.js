"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const file_store_1 = require("../controller/file-store");
const router = (0, express_1.Router)();
//define the file path and file name
const filestorage = multer_1.default.diskStorage({
    destination(req, file, callback) {
        callback(null, "files");
    },
    filename(req, file, callback) {
        callback(null, file.fieldname + "_" + Date.now() + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage: filestorage,
}).single("files");
router.post("/upload", upload, file_store_1.fileUpload);
exports.default = router;
