const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

let db = JSON.parse(fs.readFileSync("./database.json"));
const saveDB = () =>
  fs.writeFileSync("./database.json", JSON.stringify(db, null, 2));

app.get("/api/routes", (req, res) => {
  res.json(db.weeklyRoutes);
});

app.post("/api/routes", (req, res) => {
  const { day, multiplier, routes } = req.body;
  db.weeklyRoutes[day] = { multiplier, routes };
  saveDB();
  res.json({ success: true });
});

app.listen(PORT, () =>
  console.log(`🌐 Dashboard running on ${PORT}`)
);
