import dotenv from "dotenv";

dotenv.config();

const config = {
  port: process.env.PORT as string,
  dbName: process.env.dbName as string,
  dbUsername: process.env.dbUsername as string,
  dbPassword: process.env.dbPassword as string,
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING as string,
  azureContainerName: process.env.AZURE_CONTAINER_NAME as string,
};

export default config;
