"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUpload = void 0;
const fileUpload = (req, res, next) => {
    if (!req.file) {
        res.status(400).json({ message: "No file is uploaded" });
        return;
    }
    res.status(200).json({
        success: true,
        filename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        fileFieldName: req.file.fieldname
    });
};
exports.fileUpload = fileUpload;
