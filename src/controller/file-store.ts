import { NextFunction, Request, Response } from "express";

export const fileUpload = (req: Request, res: Response, next: NextFunction) => {
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
