import { Sequelize } from "sequelize";
import config from "../config";
const sequelize = new Sequelize(
  config.dbName,
  config.dbUsername,
  config.dbPassword,
  {
    dialect: "postgres",
    host: "localhost",
  }
);

export default sequelize;
