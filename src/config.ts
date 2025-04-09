import dotenv from "dotenv";

dotenv.config();

const config = {
  port: process.env.PORT as string,
};

export default config;
