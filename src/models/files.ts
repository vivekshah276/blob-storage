import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import sequelize from "../utils/db";

interface FileAttributes {
  id: number;
  userId: number;
  container_name: string;
  blob_name: string;
  original_file_name: string;
}

interface FileActivationAttribute extends Optional<FileAttributes, "id"> {}

export class Files
  extends Model<FileAttributes, FileActivationAttribute>
  implements FileAttributes
{
  public id!: number;
  public userId!: number;
  public container_name!: string;
  public blob_name!: string;
  public original_file_name!: string;
}

Files.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    container_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    blob_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    original_file_name: {
      type: DataTypes.STRING,
    },
  },
  {
    sequelize,
    tableName: "files",
    timestamps: true,
  }
);
