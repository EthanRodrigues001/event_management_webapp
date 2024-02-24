const bodyParser = require("body-parser");
const path = require("path");
const ejs = require("ejs");
const mongoose = require("mongoose");
const port = 8080;

const express = require("express");

const app = express();

// Connect to MongoDB
// mongoose
//   .connect(process.env.URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => {
//     console.log("MongoDB connected");
//   })
//   .catch((error) => {
//     console.error("MongoDB connection error:", error);
//   });

//parse json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));

// ejs
app.engine("html", ejs.renderFile);
app.set("view engine", "ejs");

//static files
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

//listen
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
