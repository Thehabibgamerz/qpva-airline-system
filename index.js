// index.js
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType
} = require('discord.js');

const express = require('express');
const session = require('express-session');
const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const TICKET_LOG_CHANNEL_ID = process.env.TICKET_LOG_CHANNEL_ID;
const OWNER_ID = process.env.OWNER_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !SUPPORT_ROLE_ID || !CATEGORY_ID || !TICKET_LOG_CHANNEL_ID || !OWNER_ID) {
    console.log("❌ Missing environment variables!");
    process.exit(1);
}

// --- CLIENT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// --- EXPRESS ---
const app = express();
app.use(express.json());

app.set("trust proxy", 1);
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, httpOnly: true }
    })
);

app.get("/", (req, res) => {
    if (!req.session.user) {
        return res.send(`<h2>🔐 Secure Dashboard</h2><a href="/login">Login with Discord</a>`);
    }
    res.send(`<h2>✅ Dashboard Access Granted</h2><p>Welcome ${req.session.user.username}</p><a href="/logout">Logout</a>`);
});

app.get("/login", (req, res) => {
    const redirect = encodeURIComponent(`https://${process.env.RAILWAY_STATIC_URL}/auth/callback`);
    res.redirect(
        `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=identify%20guilds`
    );
});

app.get("/auth/callback", async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) return res.send("No code provided.");

        const tokenResponse = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: `https://${process.env.RAILWAY_STATIC_URL}/auth/callback`
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${accessToken}` } });
        const guildsResponse = await axios.get("https://discord.com/api/users/@me/guilds", { headers: { Authorization: `Bearer ${accessToken}` } });

        const guild = guildsResponse.data.find(g => g.id === GUILD_ID);
        if (!guild || !(guild.permissions & 0x8)) return res.send("❌ Access denied. Admins only.");

        req.session.user = userResponse.data;
        return res.redirect("/");
    } catch (err) {
        console.error(err.response?.data || err.message);
        return res.send("❌ OAuth Error. Check server logs.");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

app.listen(PORT, () => console.log(`🌐 Web server running on ${PORT}`));

// --- COMMANDS ---
const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
    new SlashCommandBuilder().setName("say").setDescription("Make the bot say something").addStringOption(opt => opt.setName("text").setDescription("Message to send").setRequired(true)).addChannelOption(opt => opt.setName("channel").setDescription("Channel to send message")),
    new SlashCommandBuilder().setName("kick").setDescription("Kick a member").addUserOption(opt => opt.setName("user").setDescription("User to kick").setRequired(true)),
    new SlashCommandBuilder().setName("ban").setDescription("Ban a member").addUserOption(opt => opt.setName("user").setDescription("User to ban").setRequired(true)),
    new SlashCommandBuilder().setName("status").setDescription("Set bot status").addStringOption(opt => opt.setName("type").setDescription("Status type").setRequired(true).addChoices({ name: "Playing", value: "PLAYING" }, { name: "Watching", value: "WATCHING" }, { name: "Listening", value: "LISTENING" }, { name: "Streaming", value: "STREAMING" })).addStringOption(opt => opt.setName("text").setDescription("Status text").setRequired(true)),
    new SlashCommandBuilder().setName("ticketpanel").setDescription("Send ticket panel").addChannelOption(opt => opt.setName("channel").setDescription("Panel channel").setRequired(true)).addStringOption(opt => opt.setName("image").setDescription("Optional panel image URL")),
    new SlashCommandBuilder().setName("closeticket").setDescription("Close a ticket").addChannelOption(opt => opt.setName("channel").setDescription("Ticket channel").setRequired(true)),
    new SlashCommandBuilder().setName("reopenticket").setDescription("Reopen a ticket").addChannelOption(opt => opt.setName("channel").setDescription("Ticket channel").setRequired(true)),
    new SlashCommandBuilder().setName("adduser").setDescription("Add user to ticket").addUserOption(opt => opt.setName("user").setDescription("User to add").setRequired(true)).addChannelOption(opt => opt.setName("channel").setDescription("Ticket channel").setRequired(true)),
    new SlashCommandBuilder().setName("removeuser").setDescription("Remove user from ticket").addUserOption(opt => opt.setName("user").setDescription("User to remove").setRequired(true)).addChannelOption(opt => opt.setName("channel").setDescription("Ticket channel").setRequired(true)),
    new SlashCommandBuilder().setName("deleteticket").setDescription("Delete a ticket").addChannelOption(opt => opt.setName("channel").setDescription("Ticket channel").setRequired(true))
].map(cmd => cmd.toJSON());

// Register commands
(async () => {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    try {
        console.log("🛠 Registering slash commands...");
        const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log(`✅ Registered ${data.length} commands:`, data.map(c => c.name).join(", "));
    } catch (err) {
        console.error(err);
    }
})();

// --- CLIENT READY ---
client.once("ready", () => console.log(`🤖 Logged in as ${client.user.tag}`));

// --- CLIENT INTERACTIONS ---
client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
        const channel = interaction.options.getChannel("channel");
        const text = interaction.options.getString("text");
        const user = interaction.options.getUser("user");

        switch (interaction.commandName) {
            case "ping":
                return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
            case "say":
                const targetChannel = channel || interaction.channel;
                await targetChannel.send({ content: text });
                return interaction.reply({ content: `✅ Message sent in ${targetChannel}`, ephemeral: true });
            case "kick":
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
                    return interaction.reply({ content: "❌ No permission.", ephemeral: true });
                const memberKick = interaction.guild.members.cache.get(user.id);
                if (memberKick) { await memberKick.kick(); return interaction.reply(`👢 Kicked ${user.tag}`); }
                break;
            case "ban":
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
                    return interaction.reply({ content: "❌ No permission.", ephemeral: true });
                const memberBan = interaction.guild.members.cache.get(user.id);
                if (memberBan) { await memberBan.ban(); return interaction.reply(`🔨 Banned ${user.tag}`); }
                break;
            case "status":
                if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });
                let type = interaction.options.getString("type");
                let textStatus = interaction.options.getString("text");
                let activityType = ActivityType.Playing;
                if (type === "WATCHING") activityType = ActivityType.Watching;
                if (type === "LISTENING") activityType = ActivityType.Listening;
                if (type === "STREAMING") activityType = ActivityType.Streaming;
                client.user.setActivity(textStatus, { type: activityType, url: type === "STREAMING" ? "https://twitch.tv/discord" : undefined });
                return interaction.reply({ content: `✅ Status set to ${type} ${textStatus}`, ephemeral: true });
            case "ticketpanel":
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                    return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
                const panelEmbed = {
                    title: "🎫 QPVA Support Centre ✈️",
                    description: `Welcome to the Akasa Air Virtual Support Center!
Need assistance with Akasa Air services? You’re in the right place! Our dedicated <@&${SUPPORT_ROLE_ID}> is here to help you quickly and efficiently.

### Please select a category below to create a ticket:

- General Support
- Recruitments
- Executive Team Support
- PIREP Support

We’re committed to making your journey with Akasa Air smooth and stress-free! 🌍✈️`,
                    color: 0x00FF00,
                    image: interaction.options.getString("image") ? { url: interaction.options.getString("image") } : undefined
                };
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("create_ticket").setLabel("📩 Create Ticket").setStyle(ButtonStyle.Primary)
                );
                await channel.send({ embeds: [panelEmbed], components: [row] });
                return interaction.reply({ content: `✅ Panel sent in ${channel}`, ephemeral: true });
        }
    }

    // Ticket buttons
    if (interaction.isButton()) {
        if (interaction.customId === "create_ticket") {
            const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.id}`);
            if (existing) return interaction.reply({ content: "❌ You already have a ticket!", ephemeral: true });

            const category = interaction.guild.channels.cache.get(CATEGORY_ID);
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: interaction.guild.roles.everyone, deny: ['ViewChannel'] },
                    { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages'] },
                    { id: SUPPORT_ROLE_ID, allow: ['ViewChannel', 'SendMessages'] }
                ]
            });

            const ticketEmbed = {
                title: "General Support",
                description: "Thanks for creating a ticket! Our Staff Team will contact you shortly!",
                color: 0x00FF00,
                fields: [
                    { name: "Opened by", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "Claimed by", value: "None", inline: true }
                ]
            };
            const ticketRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${ticketChannel.id}`).setLabel("🛡 Claim").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`close_${ticketChannel.id}`).setLabel("❌ Close").setStyle(ButtonStyle.Danger)
            );
            await ticketChannel.send({ content: `<@&${SUPPORT_ROLE_ID}>`, embeds: [ticketEmbed], components: [ticketRow] });
            return interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
        }
    }
});

client.login(TOKEN);
