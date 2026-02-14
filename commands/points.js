const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class PointsCommands {
    constructor(database, staffRoleId) {
        this.db = database;
        this.staffRoleId = staffRoleId;
    }

    isStaff(member) {
        return member.roles.cache.has(this.staffRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);
    }

    async handleAdd(interaction) {
        if (!this.isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ You need staff permissions to add points!', ephemeral: true });
        }
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        if (amount <= 0) {
            return interaction.reply({ content: '❌ Amount must be positive!', ephemeral: true });
        }
        try {
            const newPoints = this.db.addPoints(targetUser.id, targetUser.username, amount, interaction.user.id, interaction.user.username, reason);
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✈️ Flying Points Added')
                .setDescription(`Successfully added points to ${targetUser}`)
                .addFields(
                    { name: 'Amount Added', value: `+${amount.toLocaleString()} points`, inline: true },
                    { name: 'New Balance', value: `${newPoints.toLocaleString()} points`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Added By', value: interaction.user.username, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Air France Utilities' });
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error adding points:', error);
            await interaction.reply({ content: '❌ An error occurred while adding points.', ephemeral: true });
        }
    }

    async handleDeduct(interaction) {
        if (!this.isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ You need staff permissions to deduct points!', ephemeral: true });
        }
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        if (amount <= 0) {
            return interaction.reply({ content: '❌ Amount must be positive!', ephemeral: true });
        }
        try {
            const newPoints = this.db.deductPoints(targetUser.id, targetUser.username, amount, interaction.user.id, interaction.user.username, reason);
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('✈️ Flying Points Deducted')
                .setDescription(`Successfully deducted points from ${targetUser}`)
                .addFields(
                    { name: 'Amount Deducted', value: `-${amount.toLocaleString()} points`, inline: true },
                    { name: 'New Balance', value: `${newPoints.toLocaleString()} points`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Deducted By', value: interaction.user.username, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Air France Utilities' });
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error deducting points:', error);
            await interaction.reply({ content: '❌ An error occurred while deducting points.', ephemeral: true });
        }
    }

    async handleView(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        try {
            const userData = this.db.getPoints(targetUser.id);
            const points = userData?.points || 0;
            const embed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('✈️ Flying Points Balance')
                .setDescription(`Points for ${targetUser}`)
                .addFields({ name: 'Current Balance', value: `${points.toLocaleString()} points`, inline: false })
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Air France Utilities' });
            if (userData?.last_updated) {
                embed.addFields({ name: 'Last Updated', value: `<t:${userData.last_updated}:R>`, inline: true });
            }
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error viewing points:', error);
            await interaction.reply({ content: '❌ An error occurred while fetching points.', ephemeral: true });
        }
    }

    async handleLeaderboard(interaction) {
        await interaction.deferReply();
        try {
            const leaderboard = this.db.getLeaderboard(10);
            if (leaderboard.length === 0) {
                return interaction.editReply('📊 No points have been awarded yet!');
            }
            const stats = this.db.getStats();
            let description = '';
            const medals = ['🥇', '🥈', '🥉'];
            for (let i = 0; i < leaderboard.length; i++) {
                const entry = leaderboard[i];
                const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
                const user = await interaction.client.users.fetch(entry.user_id).catch(() => null);
                const username = user ? user.username : entry.username;
                description += `${medal} **${username}** - ${entry.points.toLocaleString()} points\n`;
            }
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Flying Points Leaderboard')
                .setDescription(description)
                .addFields(
                    { name: 'Total Users', value: stats.totalUsers.toString(), inline: true },
                    { name: 'Total Points', value: stats.totalPoints.toLocaleString(), inline: true },
                    { name: 'Transactions', value: stats.totalTransactions.toString(), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Air France Utilities • Top 10' });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error showing leaderboard:', error);
            await interaction.editReply('❌ An error occurred while fetching the leaderboard.');
        }
    }

    async handleHistory(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        if (targetUser.id !== interaction.user.id && !this.isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ You can only view your own history!', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: targetUser.id === interaction.user.id });
        try {
            const history = this.db.getHistory(targetUser.id, 10);
            if (history.length === 0) {
                return interaction.editReply(`No transaction history found for ${targetUser.username}.`);
            }
            let description = '';
            for (const entry of history) {
                const sign = entry.amount > 0 ? '+' : '';
                const emoji = entry.amount > 0 ? '📈' : '📉';
                description += `${emoji} **${sign}${entry.amount}** points\n`;
                description += `└ By: ${entry.staff_username}\n`;
                if (entry.reason) description += `└ Reason: ${entry.reason}\n`;
                description += `└ <t:${entry.timestamp}:R>\n\n`;
            }
            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle(`📜 Points History - ${targetUser.username}`)
                .setDescription(description)
                .setTimestamp()
                .setFooter({ text: 'Air France Utilities • Last 10 transactions' });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error showing history:', error);
            await interaction.editReply('❌ An error occurred while fetching history.');
        }
    }

    async handleSet(interaction) {
        if (!this.isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ You need staff permissions to set points!', ephemeral: true });
        }
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Points manually set';
        if (amount < 0) {
            return interaction.reply({ content: '❌ Amount cannot be negative!', ephemeral: true });
        }
        try {
            const oldData = this.db.getPoints(targetUser.id);
            const oldPoints = oldData?.points || 0;
            this.db.setPoints(targetUser.id, targetUser.username, amount);
            this.db.addHistory(targetUser.id, interaction.user.id, interaction.user.username, amount - oldPoints, `${reason} (Set from ${oldPoints} to ${amount})`);
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('✈️ Flying Points Set')
                .setDescription(`Successfully set points for ${targetUser}`)
                .addFields(
                    { name: 'Old Balance', value: `${oldPoints.toLocaleString()} points`, inline: true },
                    { name: 'New Balance', value: `${amount.toLocaleString()} points`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Set By', value: interaction.user.username, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Air France Utilities' });
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error setting points:', error);
            await interaction.reply({ content: '❌ An error occurred while setting points.', ephemeral: true });
        }
    }

    async handleDbInfo(interaction) {
        if (!this.isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Staff only command!', ephemeral: true });
        }
        const fs = require('fs');
        const path = require('path');
        const dbPath = path.join(__dirname, '..', 'data', 'points.db');
        let fileSize = 'Unknown';
        let fileExists = false;
        try {
            const stats = fs.statSync(dbPath);
            fileSize = (stats.size / 1024).toFixed(2) + ' KB';
            fileExists = true;
        } catch (error) {
            fileExists = false;
        }
        const dbStats = this.db.getStats();
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🗄️ Database Information')
            .addFields(
                { name: 'Platform', value: '☁️ Render', inline: true },
                { name: 'Location', value: `\`${dbPath}\``, inline: false },
                { name: 'File Exists', value: fileExists ? '✅ Yes' : '❌ No', inline: true },
                { name: 'File Size', value: fileSize, inline: true },
                { name: 'Total Users', value: dbStats.totalUsers.toString(), inline: true },
                { name: 'Total Points', value: dbStats.totalPoints.toLocaleString(), inline: true },
                { name: 'Total Transactions', value: dbStats.totalTransactions.toString(), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Air France Utilities' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = PointsCommands;