import dotenv from "dotenv";
import path from "path"

dotenv.config({
  path: path.resolve(__dirname, `../.env.${process.env.NODE_ENV}`),
});
const config = {
  NODE_ENV: process.env.ENV,
  port: process.env.PORT as string,
  dbName: process.env.dbName as string,
  dbUsername: process.env.dbUsername as string,
  dbPassword: process.env.dbPassword as string,
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING as string,
  azureContainerName: process.env.AZURE_CONTAINER_NAME as string,
  accountName: process.env.ACCOUNT_NAME as string,
  accountKey: process.env.AccountKey as string
};

export default config;
