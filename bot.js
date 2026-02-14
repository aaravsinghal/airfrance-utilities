require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const PointsDatabase = require('./database');
const PointsCommands = require('./commands/points');
const express = require('express');

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing in environment variables!');
    process.exit(1);
}

if (!process.env.STAFF_ROLE_ID) {
    console.error('⚠️ STAFF_ROLE_ID is missing - staff commands will require Administrator permission');
}

// Initialize Express for health checks
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
let db;
let pointsCommands;

try {
    db = new PointsDatabase();
    pointsCommands = new PointsCommands(db, process.env.STAFF_ROLE_ID);
} catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
}

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Health check endpoints
app.get('/', (req, res) => {
    const stats = db.getStats();
    res.json({ 
        status: 'online',
        bot: client.user?.tag || 'starting',
        uptime: Math.floor(process.uptime()),
        database: {
            connected: true,
            ...stats
        },
        platform: process.env.FLY_APP_NAME ? 'Fly.io' : 
                  process.env.RENDER ? 'Render' : 
                  process.env.RAILWAY_ENVIRONMENT ? 'Railway' : 'Local',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Health check server running on port ${PORT}`);
});

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('points-add')
        .setDescription('Add flying points to a user (Staff only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add points to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of points to add')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for adding points')
                .setRequired(false)
                .setMaxLength(200)),

    new SlashCommandBuilder()
        .setName('points-deduct')
        .setDescription('Deduct flying points from a user (Staff only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to deduct points from')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of points to deduct')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for deducting points')
                .setRequired(false)
                .setMaxLength(200)),

    new SlashCommandBuilder()
        .setName('points-set')
        .setDescription('Set a user\'s points to a specific amount (Staff only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to set points for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to set')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(1000000))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for setting points')
                .setRequired(false)
                .setMaxLength(200)),

    new SlashCommandBuilder()
        .setName('points')
        .setDescription('View flying points balance')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check (leave empty for yourself)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the flying points leaderboard'),

    new SlashCommandBuilder()
        .setName('points-history')
        .setDescription('View points transaction history')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check history for (Staff only for others)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('db-info')
        .setDescription('Show database information (Staff only)')
].map(command => command.toJSON());

// Register commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Bot logged in as: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    console.log(`👥 Users: ${client.users.cache.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Set bot status
    client.user.setPresence({
        activities: [{ 
            name: '✈️ Flying Points System', 
            type: ActivityType.Watching 
        }],
        status: 'online'
    });
    
    try {
        console.log('🔄 Registering slash commands...');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        
        console.log('✅ Successfully registered slash commands!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Available Commands:');
        console.log('   /points-add - Add points (Staff)');
        console.log('   /points-deduct - Deduct points (Staff)');
        console.log('   /points-set - Set points (Staff)');
        console.log('   /points - View points balance');
        console.log('   /leaderboard - View top users');
        console.log('   /points-history - View transaction history');
        console.log('   /db-info - Database info (Staff)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const stats = db.getStats();
        console.log('📊 Current Database Stats:');
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

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const startTime = Date.now();
    
    try {
        console.log(`📝 Command: /${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
        
        switch (interaction.commandName) {
            case 'points-add':
                await pointsCommands.handleAdd(interaction);
                break;
            case 'points-deduct':
                await pointsCommands.handleDeduct(interaction);
                break;
            case 'points-set':
                await pointsCommands.handleSet(interaction);
                break;
            case 'points':
                await pointsCommands.handleView(interaction);
                break;
            case 'leaderboard':
                await pointsCommands.handleLeaderboard(interaction);
                break;
            case 'points-history':
                await pointsCommands.handleHistory(interaction);
                break;
            case 'db-info':
                await pointsCommands.handleDbInfo(interaction);
                break;
            default:
                await interaction.reply({ 
                    content: '❌ Unknown command!', 
                    ephemeral: true 
                });
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ Command executed in ${executionTime}ms`);
        
    } catch (error) {
        console.error('❌ Error handling command:', error);
        
        const errorMessage = { 
            content: '❌ An error occurred while processing your command. Please try again later.', 
            ephemeral: true 
        };
        
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            console.error('❌ Failed to send error message:', replyError);
        }
    }
});

// Error handlers
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', warning => {
    console.warn('⚠️ Discord client warning:', warning);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
    gracefulShutdown();
});

// Graceful shutdown
function gracefulShutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    
    const stats = db.getStats();
    console.log('📊 Final Stats:');
    console.log(`   Users: ${stats.totalUsers}`);
    console.log(`   Total Points: ${stats.totalPoints.toLocaleString()}`);
    console.log(`   Transactions: ${stats.totalTransactions}`);
    
    db.close();
    client.destroy();
    
    console.log('✅ Shutdown complete');
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Login to Discord
console.log('🚀 Starting Air France Utilities Bot...');
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Failed to login:', error);
    process.exit(1);
});