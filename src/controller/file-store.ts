import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
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

const userId = 2123;

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

    const containerName = `user-${userId}`;
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

    const containerName = `user-${userId}`;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const originalFilename = req.file.originalname;
    const newFileName = `${userId}-${uuidv4()}-${
      req.file?.originalname
    }` as string;
    const blobClient = containerClient.getBlockBlobClient(newFileName);

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
    await blobClient.uploadStream(stream, undefined, undefined, {
      blobHTTPHeaders: {
        blobContentType: req.file.mimetype,
        blobContentDisposition: "inline",
      },
    });

    // Delete old file

    const oldBlobClient = containerClient.getBlockBlobClient(oldfilename);
    const response = await oldBlobClient.deleteIfExists();

    const file = await Files.findOne({
      where: { userId: userId, blob_name: oldfilename },
    });
    if (!file) {
      res.status(400).json({ message: "No file found" });
      return;
    }
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
  const accountName = process.env.ACCOUNT_NAME as string;
  const accountKey = process.env.AccountKey as string;

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey
  );

  try {
    const files: { name: string; url: string; container: string }[] = [];
    const expiresOn = new Date(new Date().valueOf() + 60 * 60 * 1000); // valid for 1 hour

    const containerName = `user-${userId}`;
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const exist = await containerClient.exists();
    if (!exist) {
      res.status(400).json({ message: "No Container found" });
      return;
    }

    // List blobs inside each container
    for await (const blob of containerClient.listBlobsFlat()) {
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName: blob.name,
          permissions: BlobSASPermissions.parse("r"),
          expiresOn,
        },
        sharedKeyCredential
      ).toString();

      const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blob.name}?${sasToken}`;

      files.push({
        name: blob.name,
        url,
        container: containerName, // added container info
      });
    }

    res.status(200).json({
      success: true,
      count: files.length,
      files: files,
    });
  } catch (err) {
    res.status(500).json({ message: "Error listing blobs", error: err });
  }
};

//get single file
export const getSingleFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const accountName = config.accountName;
  const accountKey = config.accountKey;

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey
  );
  try {
    const containerName = `user-${userId}`;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(req.params.filename);

    const userFiles = await Files.findOne({
      where: { userId, blob_name: req.params.filename },
    });
    if (!userFiles) {
      res.status(404).json({ message: "File not Found" });
      return;
    }

    const expiresOn = new Date(new Date().valueOf() + 60 * 60 * 1000); // 1 hour expiry

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: userFiles.container_name,
        blobName: userFiles.blob_name,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
      },
      sharedKeyCredential
    ).toString();
    const url = `${blobClient.url}?${sasToken}`;

    res.status(200).json({ success: true, file: userFiles, url: url });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: err });
  }
};

//delete the file from the blob storage
export const deleteFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const containerName = `user-${userId}`;
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
