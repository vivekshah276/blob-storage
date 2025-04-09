import express from "express";
import config from "./config";
import bodyParser from "body-parser";
import fileRoutes from "./routes/file-store"

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(fileRoutes)

app.listen(config.port, () => {
  console.log("Server is listening");
});
