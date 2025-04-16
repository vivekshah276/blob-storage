import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import config from "../config";
import { Readable } from "stream";
import { Files } from "../models/files";

//connect the app to azure storage account
const blobServiceClient = BlobServiceClient.fromConnectionString(
  config.azureStorageConnectionString
);

const userId = 223;

//upload the file in blob storage
export const uploadFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file found" });
      return;
    }

    const extension = path
      .extname(req.file?.originalname)
      .replace(".", "")
      .toLowerCase();
    const containerName = extension;
    const containerClient = blobServiceClient.getContainerClient(containerName);

    await containerClient.createIfNotExists();

    const originalFilename = req.file.originalname;
    const blobName = `${userId}-${uuidv4()}-${
      req.file?.originalname
    }` as string;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const existingFile = await Files.findOne({
      where: {
        userId: userId,
        original_file_name: req.file.originalname,
      },
    });

    if (existingFile) {
      res.status(400).json({
        success: false,
        message: "A file with the same name already exists for this user.",
        file: existingFile,
      });
      return;
    }

    const stream = Readable.from(req.file?.buffer);

    await blockBlobClient.uploadStream(stream, undefined, undefined, {
      blobHTTPHeaders: {
        blobContentType: req.file.mimetype,
        blobContentDisposition: "inline",
      },
    });

    //store in db
    const files = await Files.create({
      userId: userId,
      container_name: containerName,
      blob_name: blobName,
      original_file_name: originalFilename,
    });
    await files.save();

    res.status(200).json({ success: true, files: files });
    return;
  } catch (err) {
    res.status(500).json(err);
  }
};

//update the file in the blob storage
export const updatFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const oldfilename = req.params.oldfilename;

    if (!oldfilename) {
      res.status(400).json({ message: "Old file name not provided" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No new file uploaded" });
      return;
    }

    const oldExt = path.extname(oldfilename).replace(".", "").toLowerCase();
    const newExt = path
      .extname(req.file.originalname)
      .replace(".", "")
      .toLowerCase();

    const newContainerName = newExt;
    const newContainerClient =
      blobServiceClient.getContainerClient(newContainerName);

    await newContainerClient.createIfNotExists();

    const originalFilename = req.file.originalname;
    const newFileName = `${userId}-${uuidv4()}-${
      req.file?.originalname
    }` as string;
    const newBlobClient = newContainerClient.getBlockBlobClient(newFileName);

    //if new file is already exist it will abort
    const existingFile = await Files.findOne({
      where: {
        userId: userId,
        original_file_name: req.file.originalname,
      },
    });

    if (existingFile) {
      res.status(400).json({
        success: false,
        message: "A file with the same name already exists for this user.",
        file: existingFile,
      });
      return;
    }

    const stream = Readable.from(req.file.buffer);

    // Upload new file
    await newBlobClient.uploadStream(stream, undefined, undefined, {
      blobHTTPHeaders: {
        blobContentType: req.file.mimetype,
        blobContentDisposition: "inline",
      },
    });

    // Delete old file
    const oldContainerName = oldExt;
    const oldContainerClient =
      blobServiceClient.getContainerClient(oldContainerName);
    const oldBlobClient = oldContainerClient.getBlockBlobClient(oldfilename);
    const response = await oldBlobClient.deleteIfExists();

    const file = await Files.findOne({
      where: { userId: userId, blob_name: oldfilename },
    });
    if (!file) {
      res.status(400).json({ message: "No file found" });
      return;
    }
    file.container_name = newContainerName;
    file.blob_name = newFileName;
    file.original_file_name = originalFilename;
    file.save();

    res.status(200).json({
      success: true,
      message: "File updated and renamed successfully",
      file: file,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error updating file", error: err });
  }
};

// get the file
export const getFile = async (req: Request, res: Response): Promise<void> => {
  const accountName = config.accountName;
  const accountKey = config.accountKey;

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey
  );

  try {
    const userFiles = await Files.findAll({ where: { userId } });
    const expiresOn = new Date(new Date().valueOf() + 60 * 60 * 1000); // 1 hour expiry

    const filesWithUrls = await Promise.all(
      userFiles.map(async (file) => {
        const containerClient = blobServiceClient.getContainerClient(
          file.container_name
        );
        const blobClient = containerClient.getBlobClient(file.blob_name);

        const sasToken = generateBlobSASQueryParameters(
          {
            containerName: file.container_name,
            blobName: file.blob_name,
            permissions: BlobSASPermissions.parse("r"),
            expiresOn,
          },
          sharedKeyCredential
        ).toString();

        const url = `${blobClient.url}?${sasToken}`;
        return {
          id: file.id,
          original_file_name: file.original_file_name,
          blob_name: file.blob_name,
          container: file.container_name,
          url,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: filesWithUrls.length,
      files: filesWithUrls,
    });
  } catch (err) {
    res.status(500).json({ message: "Error listing blobs", error: err });
  }
};

//delete the file from the blob storage
export const deleteFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const extension = path
      .extname(req.params.filename)
      .replace(".", "")
      .toLowerCase();
    const containerName = extension;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(req.params.filename);

    const deleteResponse = await blobClient.deleteIfExists();

    if (deleteResponse.succeeded) {
      const dbDeleted = await Files.destroy({
        where: { blob_name: req.params.filename },
      });

      res.status(200).json({
        success: true,
        message: "File deleted successfully",
        filename: req.params.filename,
        dbDeleted: dbDeleted > 0,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "File not found",
        filename: req.params.filename,
      });
    }
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err });
  }
};
