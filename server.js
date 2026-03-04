const express = require("express");
const session = require("express-session");
const axios = require("axios");

const app = express();

app.use(express.json());

app.set("trust proxy", 1); // REQUIRED for Railway

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,   // IMPORTANT FIX
      httpOnly: true
    }
  })
);

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GUILD_ID = process.env.GUILD_ID;

const REDIRECT_URI =
  "https://qpva-airline-system-production.up.railway.app/auth/callback";

/* =========================
   LOGIN ROUTE
========================= */
app.get("/login", (req, res) => {
  const redirect = encodeURIComponent(REDIRECT_URI);

  res.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=identify%20guilds`
  );
});

/* =========================
   OAUTH CALLBACK
========================= */
app.get("/auth/callback", async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) return res.send("No code provided.");

    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get user info
    const userResponse = await axios.get(
      "https://discord.com/api/users/@me",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    // Get user guilds
    const guildsResponse = await axios.get(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const guild = guildsResponse.data.find(
      (g) => g.id === GUILD_ID
    );

    // Check admin permission (0x8)
    if (!guild || !(guild.permissions & 0x8)) {
      return res.send("❌ Access denied. Admins only.");
    }

    req.session.user = userResponse.data;

    return res.redirect("/");
  } catch (error) {
    console.error("OAuth Error:", error.response?.data || error.message);
    return res.send("❌ OAuth Error. Check server logs.");
  }
});

/* =========================
   PROTECTED DASHBOARD
========================= */
app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.send(`
      <h2>🔐 Secure Dashboard</h2>
      <a href="/login">Login with Discord</a>
    `);
  }

  res.send(`
    <h2>✅ Dashboard Access Granted</h2>
    <p>Welcome ${req.session.user.username}</p>
    <a href="/logout">Logout</a>
  `);
});

/* =========================
   LOGOUT
========================= */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Secure Dashboard Running on port ${PORT}`);
});
