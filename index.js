const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionsBitField
} = require("discord.js");

const cron = require("node-cron");
const fs = require("fs");
require("./server");

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// DATABASE
if (!fs.existsSync("./database.json")) {
  fs.writeFileSync("./database.json", JSON.stringify({
    routes: {},
    weeklyRoutes: {},
    routeSettings: { channelId: null, roleId: null }
  }, null, 2));
}

let db = JSON.parse(fs.readFileSync("./database.json"));
const saveDB = () =>
  fs.writeFileSync("./database.json", JSON.stringify(db, null, 2));

client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [

    new SlashCommandBuilder()
      .setName("setroutechannel")
      .setDescription("Set route channel")
      .addChannelOption(o =>
        o.setName("channel").setDescription("Channel").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("setrouterole")
      .setDescription("Set route role")
      .addRoleOption(o =>
        o.setName("role").setDescription("Role").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("setweeklyroutes")
      .setDescription("Set weekly routes")
      .addStringOption(o =>
        o.setName("day")
          .setDescription("Day")
          .setRequired(true)
          .addChoices(
            { name: "Monday", value: "Monday" },
            { name: "Tuesday", value: "Tuesday" },
            { name: "Wednesday", value: "Wednesday" },
            { name: "Thursday", value: "Thursday" },
            { name: "Friday", value: "Friday" },
            { name: "Saturday", value: "Saturday" },
            { name: "Sunday", value: "Sunday" }
          )
      )
      .addStringOption(o =>
        o.setName("multiplier").setDescription("2x").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("routes").setDescription("Routes list").setRequired(true)
      )
  ];

  await client.application.commands.set(commands);

  // Midnight UTC Post
  cron.schedule("0 0 * * *", async () => {

    const today = new Date().toISOString().split("T")[0];
    const day = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC"
    });

    if (!db.routeSettings.channelId) return;

    const channel = await client.channels.fetch(db.routeSettings.channelId).catch(() => null);
    if (!channel) return;

    const data = db.weeklyRoutes[day];
    if (!data) return;

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("🌟 Daily Featured Routes")
      .setDescription(
        `Featured routes for **${today} (${day})**\n\n` +
        `🔥 **${data.multiplier} Multiplier Available** on these routes!\n\n` +
        `${data.routes}`
      );

    channel.send({
      content: db.routeSettings.roleId
        ? `<@&${db.routeSettings.roleId}>`
        : null,
      embeds: [embed]
    });

  }, { timezone: "UTC" });

});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setroutechannel") {
    db.routeSettings.channelId =
      interaction.options.getChannel("channel").id;
    saveDB();
    return interaction.reply("✅ Channel set.");
  }

  if (interaction.commandName === "setrouterole") {
    db.routeSettings.roleId =
      interaction.options.getRole("role").id;
    saveDB();
    return interaction.reply("✅ Role set.");
  }

  if (interaction.commandName === "setweeklyroutes") {
    db.weeklyRoutes[interaction.options.getString("day")] = {
      multiplier: interaction.options.getString("multiplier"),
      routes: interaction.options.getString("routes")
    };
    saveDB();
    return interaction.reply("✅ Weekly routes updated.");
  }
});

client.login(TOKEN);
