require("dotenv").config();
import express from "express";
import DownloadRouter from "./routes/download";

const app = express();

app.use("/download", DownloadRouter);

app.get("/", (req, res) => {
  res.send("Hello World");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
