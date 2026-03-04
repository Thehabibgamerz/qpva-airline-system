const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const fs = require("fs");

require("./server"); // start dashboard

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;

let db = require("./database.json");

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Midnight UTC auto post
  cron.schedule("0 0 * * *", async () => {
    postDailyRoutes();
  }, {
    timezone: "UTC"
  });
});

async function postDailyRoutes() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  const config = db.weeklyRoutes[today];
  if (!config) return;

  const channel = await client.channels.fetch(db.routeChannelId).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setTitle("🌟 Daily Featured Routes")
    .setDescription(`Featured routes for **${new Date().toISOString().split("T")[0]}**`)
    .addFields({
      name: `🔥 ${config.multiplier}x Multiplier Available`,
      value: config.routes.join("\n")
    });

  await channel.send({ content: db.mentionRole ? `<@&${db.mentionRole}>` : null, embeds: [embed] });
}

client.login(TOKEN);
