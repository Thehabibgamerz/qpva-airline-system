const express = require("express");
const session = require("express-session");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;

const REDIRECT_URI = `https://${process.env.RAILWAY_STATIC_URL}/auth/callback`;

let db = require("./database.json");
const saveDB = () => fs.writeFileSync("./database.json", JSON.stringify(db, null, 2));

function checkAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

app.get("/login", (req, res) => {
  const redirect = encodeURIComponent(REDIRECT_URI);
  res.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=identify%20guilds`
  );
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  const token = await axios.post("https://discord.com/api/oauth2/token",
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const accessToken = token.data.access_token;

  const user = await axios.get("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const guilds = await axios.get("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const guild = guilds.data.find(g => g.id === GUILD_ID);

  if (!guild || !(guild.permissions & 0x8)) {
    return res.send("Access denied. Admins only.");
  }

  req.session.user = user.data;
  res.redirect("/");
});

app.get("/", checkAuth, (req, res) => {
  res.send("Secure Dashboard Online ✅");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Dashboard running");
});
