import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import File from "./models/File.js";

// initiate the express app.
const app = express();
// because of the { __dirname } not not defined in ES module scope we need to handle it manually.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// To inform express how to handle the file download route {or how to deal with form submit}.
app.use(express.urlencoded({ extended: true }));
// Allowing static file use like css file.
app.use(express.static(__dirname + "/public"));

// initiate the multer and added as a middleware to the post request which will help up control the file uploaded.
// All files will be uploaded to uploads folder.
const upload = multer({ dest: "uploads" });

/*
  - connecting to the database.
  - Here we connecting to the Database locally so if you didn't set up mongodb in you local machine will have problem
    with this set up.
*/
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    app.listen(process.env.PORT, () =>
      console.log(`Your server side working on PORT: ${process.env.PORT}`)
    );
  })
  .catch((error) =>
    console.log(`Error while connecting to the database: ${error}`)
  );

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

// adding the multer instance with single file only and name the file.
app.post("/upload", upload.single("file"), async (req, res) => {
  const fileData = {
    path: req.file.path,
    originalName: req.file.originalname,
  };
  // as password is optional will check it
  if (req.body.password != null && req.body.password.trim() !== "") {
    fileData.password = await bcrypt.hash(req.body.password, 10);
  }

  const file = await File.create(fileData);
  // console.log(file);
  // res.send(file.originalName);

  // the object passed to render method called we fetch it on ejs as locals to send data over.
  res.render("index", { fileLink: `${req.headers.origin}/file/${file._id}` });
});

// Fixing the download route for any file by using the unique id for it.

// app.get("/file/:id", handlePassword);
// // To be able to send data over the same url.
// app.post("/file/:id", handlePassword);

// A better way to write the get and post for the same URL is using route like following
app.route("/file/:id").get(handlePassword).post(handlePassword);

async function handlePassword(req, res) {
  const file = await File.findById(req.params.id);

  // checking if the file protected with a password or not
  if (file.password != null) {
    // no password entered on the body.
    if (req.body.password == null) {
      res.render("password");
      // return to prevent download the file accidentally.
      return;
    }

    // if(to check the password match)
    if (!(await bcrypt.compare(req.body.password, file.password))) {
      // send error over the render method to show error message to user.
      res.render("password", { error: true });
      return;
    }
  }

  // increment the download counter
  file.downloadCount++;
  await file.save();

  res.download(file.path, file.originalName);
}
