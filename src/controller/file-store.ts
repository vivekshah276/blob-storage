import { Request, Response } from "express";
import path from "path";
import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import config from "../config";
import { Readable } from "stream";
import dotenv from "dotenv";
dotenv.config();

//connect the app to azure storage account
const blobServiceClient = BlobServiceClient.fromConnectionString(
  config.azureStorageConnectionString
);

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

    const blobName = req.file?.originalname as string;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const stream = Readable.from(req.file?.buffer);

    await blockBlobClient.uploadStream(stream, undefined, undefined, {
      blobHTTPHeaders: {
        blobContentType: req.file.mimetype,
        blobContentDisposition: "inline",
      },
    });

    res.status(200).json({ success: true, fileName: blobName });
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

    const newFileName = req.file.originalname;
    const newBlobClient = newContainerClient.getBlockBlobClient(newFileName);
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

    res.status(200).json({
      success: true,
      message: "File updated and renamed successfully",
      newFileName: newFileName,
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

    // List all containers
    for await (const container of blobServiceClient.listContainers()) {
      const containerName = container.name;
      const containerClient =
        blobServiceClient.getContainerClient(containerName);

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
      res.status(200).json({
        success: true,
        message: "File deleted successfully",
        filename: req.params.filename,
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
