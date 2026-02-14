require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const PointsDatabase = require('./database');
const PointsCommands = require('./commands/points');
const express = require('express');

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing!');
    process.exit(1);
}

// Express server to keep Render awake
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    
    res.json({
        status: 'online',
        bot: client.user?.tag || 'starting',
        uptime: `${uptimeHours}h ${uptimeMinutes}m`,
        uptimeSeconds: Math.floor(uptime),
        message: 'Air France Utilities Bot is running! ✈️'
    });
});

app.get('/ping', (req, res) => {
    res.json({ status: 'pong', timestamp: Date.now() });
});

app.listen(PORT, () => {
    console.log(`✅ Web server running on port ${PORT}`);
    console.log(`🌐 Service URL will be visible after deployment`);
});

let db;
let pointsCommands;

try {
    db = new PointsDatabase();
    pointsCommands = new PointsCommands(db, process.env.STAFF_ROLE_ID);
} catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
}  // ← FIXED: Changed } to )

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const commands = [
    new SlashCommandBuilder().setName('points-add').setDescription('Add flying points to a user (Staff only)')
        .addUserOption(option => option.setName('user').setDescription('User to add points to').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Amount of points to add').setRequired(true).setMinValue(1).setMaxValue(1000000))
        .addStringOption(option => option.setName('reason').setDescription('Reason for adding points').setRequired(false).setMaxLength(200)),
    new SlashCommandBuilder().setName('points-deduct').setDescription('Deduct flying points from a user (Staff only)')
        .addUserOption(option => option.setName('user').setDescription('User to deduct points from').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Amount of points to deduct').setRequired(true).setMinValue(1).setMaxValue(1000000))
        .addStringOption(option => option.setName('reason').setDescription('Reason for deducting points').setRequired(false).setMaxLength(200)),
    new SlashCommandBuilder().setName('points-set').setDescription('Set a user\'s points to a specific amount (Staff only)')
        .addUserOption(option => option.setName('user').setDescription('User to set points for').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Amount to set').setRequired(true).setMinValue(0).setMaxValue(1000000))
        .addStringOption(option => option.setName('reason').setDescription('Reason for setting points').setRequired(false).setMaxLength(200)),
    new SlashCommandBuilder().setName('points').setDescription('View flying points balance')
        .addUserOption(option => option.setName('user').setDescription('User to check (leave empty for yourself)').setRequired(false)),
    new SlashCommandBuilder().setName('leaderboard').setDescription('View the flying points leaderboard'),
    new SlashCommandBuilder().setName('points-history').setDescription('View points transaction history')
        .addUserOption(option => option.setName('user').setDescription('User to check history for (Staff only for others)').setRequired(false)),
    new SlashCommandBuilder().setName('db-info').setDescription('Show database information (Staff only)')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Bot logged in as: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    client.user.setPresence({ activities: [{ name: '✈️ Flying Points System', type: ActivityType.Watching }], status: 'online' });
    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash commands registered!');
        const stats = db.getStats();
        console.log('📊 Database Stats:');
        console.log(`   Users: ${stats.totalUsers}`);
        console.log(`   Total Points: ${stats.totalPoints.toLocaleString()}`);
        console.log(`   Transactions: ${stats.totalTransactions}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🟢 Bot is ready and online!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    try {
        switch (interaction.commandName) {
            case 'points-add': await pointsCommands.handleAdd(interaction); break;
            case 'points-deduct': await pointsCommands.handleDeduct(interaction); break;
            case 'points-set': await pointsCommands.handleSet(interaction); break;
            case 'points': await pointsCommands.handleView(interaction); break;
            case 'leaderboard': await pointsCommands.handleLeaderboard(interaction); break;
            case 'points-history': await pointsCommands.handleHistory(interaction); break;
            case 'db-info': await pointsCommands.handleDbInfo(interaction); break;
        }
    } catch (error) {
        console.error('Error handling command:', error);
        const errorMessage = { content: '❌ An error occurred.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

client.on('error', error => console.error('Discord error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));

console.log('🚀 Starting bot...');
client.login(process.env.DISCORD_TOKEN);