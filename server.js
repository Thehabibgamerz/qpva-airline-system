const express = require("express");
const session = require("express-session");
const axios = require("axios");

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

const REDIRECT_URI = "https://discord-bot-production-971f.up.railway.app/auth/callback";

// LOGIN ROUTE
app.get("/login", (req, res) => {
  const redirect = encodeURIComponent(REDIRECT_URI);

  res.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=identify%20guilds`
  );
});

// CALLBACK ROUTE
app.get("/auth/callback", async (req, res) => {
  try {
    const code = req.query.code;

    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const guildsRes = await axios.get("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const guild = guildsRes.data.find(g => g.id === GUILD_ID);

    if (!guild || !(guild.permissions & 0x8)) {
      return res.send("Access denied. Admins only.");
    }

    req.session.user = userRes.data;

    res.send("Login Successful ✅ You may close this page.");
  } catch (err) {
    console.error(err.response?.data || err);
    res.send("OAuth Error. Check logs.");
  }
});

// ROOT ROUTE
app.get("/", (req, res) => {
  res.send(`
    <h2>Secure Dashboard Online ✅</h2>
    <a href="/login">Login with Discord</a>
  `);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Secure Dashboard Running");
});
