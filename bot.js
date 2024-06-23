const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const http = require('http');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

let lastPostHash = null;
let lastUpdateHash = null;
let eventStats = null;

const serverId = '1254063706812452945';
const channelId = '1254066460939124826';
const messageId = '1254186006454861835';
const messageId2 = '1254483632953884803';

let serverConfigs = {};
let updateConfigs = {};

async function saveServerConfigs() {
    const channel = await discordClient.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.edit(`\`\`\`json\n${JSON.stringify(serverConfigs, null, 2)}\n\`\`\``);
}

async function saveUpdateConfigs() {
    const channel = await discordClient.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId2);
    await message.edit(`\`\`\`json\n${JSON.stringify(updateConfigs, null, 2)}\n\`\`\``);
}

async function loadServerConfigs() {
    const channel = await discordClient.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    const content = message.content;

    const jsonString = content.replace(/```json\n|```/g, '').trim();
    console.log('Extracted JSON string:', jsonString);

    if (jsonString.trim()) {
        try {
            serverConfigs = JSON.parse(jsonString);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            serverConfigs = {};
        }
    } else {
        serverConfigs = {};
    }
}

async function loadUpdateConfigs() {
    const channel = await discordClient.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId2);
    const content = message.content;

    const jsonString = content.replace(/```json\n|```/g, '').trim();
    console.log('Extracted JSON string:', jsonString);

    if (jsonString.trim()) {
        try {
            updateConfigs = JSON.parse(jsonString);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            updateConfigs = {};
        }
    } else {
        updateConfigs = {};
    }
}

function generateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function convertHtmlToDiscordFormat(html) {
    let formatted = html.replace(/<br\s*\/?>/gi, '\n')
        .replace(/<b>(.*?)<\/b>/gi, '**$1**')
        .replace(/<i>(.*?)<\/i>/gi, '*$1*')
        .replace(/<u>(.*?)<\/u>/gi, '__$1__')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&');
    return formatted;
}

async function getLatestPost() {
    try {
        const response = await axios.get('https://lgrhelperapi.onrender.com/latest_post');
        const post = response.data;
        if (!post) {
            return null;
        }
        const hash = generateHash(post.content);
        return { url: post.url, content: post.content, hash: hash };
    } catch (error) {
        console.error('Error fetching the latest post:', error);
        return null;
    }
}

async function getLatestUpdates() {
    try {
        const response = await axios.get('https://lgr-helperapi.onrender.com/latest_posts');
        const posts = response.data;
        if (!posts || posts.length === 0) {
            return null;
        }
        const hashes = posts.map(post => generateHash(post.content));
        return { posts, hashes };
    } catch (error) {
        console.error('Error fetching the latest updates:', error);
        return null;
    }
}

async function checkForUpdates() {
    const latestPost = await getLatestPost();
    if (latestPost && latestPost.hash !== lastPostHash) {
        lastPostHash = latestPost.hash;

        for (const guildId in serverConfigs) {
            const channelId = serverConfigs[guildId];
            const channel = discordClient.channels.cache.get(channelId);

            if (channel) {
                try {
                    const everyoneTag = await channel.send('@everyone');
                    await everyoneTag.delete();

                    const embed = new EmbedBuilder()
                        .setTitle('New post on LINE Let\'s Get Rich Facebook page')
                        .setDescription(convertHtmlToDiscordFormat(latestPost.content))
                        .setURL(latestPost.url)
                        .setColor('#0099ff');
                    await channel.send({ embeds: [embed] });
                } catch (error) {
                    console.error(`Error sending message to channel ${channelId} in guild ${guildId}:`, error);
                }
            }
        }
    }
}

async function checkForNewUpdates() {
    const latestUpdatesData = await getLatestUpdates();
    if (latestUpdatesData) {
        const { posts, hashes } = latestUpdatesData;
        if (!lastUpdateHash || !hashes.includes(lastUpdateHash)) {
            lastUpdateHash = hashes[0];

            for (const guildId in updateConfigs) {
                const channelId = updateConfigs[guildId];
                const channel = discordClient.channels.cache.get(channelId);

                if (channel) {
                    try {
                        const everyoneTag = await channel.send('@everyone');
                        await everyoneTag.delete();

                        for (const post of posts) {
                            const content = convertHtmlToDiscordFormat(post.content);
                            const parts = splitMessage(content, 4096);
                            for (const part of parts) {
                                const embed = new EmbedBuilder()
                                    .setTitle(post.title)
                                    .setDescription(part)
                                    .setColor('#0099ff');
                                await channel.send({ embeds: [embed] });
                            }
                        }
                    } catch (error) {
                        console.error(`Error sending message to channel ${channelId} in guild ${guildId}:`, error);
                    }
                }
            }
        }
    }
}

function splitMessage(content, maxLength) {
    const parts = [];
    let currentPart = '';
    const lines = content.split('\n');

    for (const line of lines) {
        if ((currentPart + line).length > maxLength) {
            parts.push(currentPart);
            currentPart = '';
        }
        currentPart += line + '\n';
    }
    if (currentPart) {
        parts.push(currentPart);
    }

    return parts;
}

discordClient.once('ready', async () => {
    console.log('Bot is online!');

    const commands = [
        {
            name: 'setup',
            description: 'Setup the channel for updates',
            options: [
                {
                    name: 'channel',
                    type: 7,
                    description: 'The channel to send updates to',
                    required: true,
                }
            ],
            default_member_permissions: PermissionsBitField.Flags.Administrator.toString() // Administrator only
        },
        {
            name: 'setup_update',
            description: 'Setup the channel for update notifications',
            options: [
                {
                    name: 'channel',
                    type: 7,
                    description: 'The channel to send update notifications to',
                    required: true,
                }
            ],
            default_member_permissions: PermissionsBitField.Flags.Administrator.toString() // Administrator only
        },
        {
            name: 'checknews',
            description: 'Check the latest news manually'
        },
        {
            name: 'checkupdate',
            description: 'Check the latest update manually'
        },
        {
            name: 'stats',
            description: 'Display the event stats'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(discordToken);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');

        // Load server configurations from the Discord message
        await loadServerConfigs();
        await loadUpdateConfigs();
    } catch (error) {
        console.error(error);
    }

    setInterval(checkForUpdates, 120000);
    setInterval(checkForNewUpdates, 120000);
});

// Dummy HTTP server to keep Render happy
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'setup') {
        const channel = interaction.options.getChannel('channel');
        serverConfigs[interaction.guildId] = channel.id;
        await saveServerConfigs();
        try {
            await interaction.reply({ content: `Updates will be sent to ${channel.name}`, ephemeral: true });
        } catch (error) {
            console.error('Error replying to interaction:', error);
        }
    }

    if (commandName === 'setup_update') {
        const channel = interaction.options.getChannel('channel');
        updateConfigs[interaction.guildId] = channel.id;
        await saveUpdateConfigs();
        try {
            await interaction.reply({ content: `Update notifications will be sent to ${channel.name}`, ephemeral: true });
        } catch (error) {
            console.error('Error replying to interaction:', error);
        }
    }

    if (commandName === 'checknews') {
        try {
            await interaction.deferReply();
            const latestPost = await getLatestPost();
            if (latestPost) {
                const embed = new EmbedBuilder()
                    .setTitle('Latest post on LINE Let\'s Get Rich Facebook page')
                    .setDescription(convertHtmlToDiscordFormat(latestPost.content))
                    .setURL(latestPost.url)
                    .setColor('#0099ff');
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply('Error: No posts found.');
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('There was an error while executing this command.');
            } else {
                await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
            }
        }
    }

    if (commandName === 'checkupdate') {
        try {
            await interaction.deferReply();
            const latestUpdatesData = await getLatestUpdates();
            if (latestUpdatesData) {
                const { posts } = latestUpdatesData;
                for (const post of posts) {
                    const content = convertHtmlToDiscordFormat(post.content);
                    const parts = splitMessage(content, 4096);
                    for (const part of parts) {
                        const embed = new EmbedBuilder()
                            .setTitle(post.title)
                            .setDescription(part)
                            .setColor('#0099ff');
                        await interaction.followUp({ embeds: [embed] });
                    }
                }
                await interaction.editReply({ content: 'Updates retrieved successfully.', ephemeral: true });
            } else {
                await interaction.editReply('Error: No updates found.');
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('There was an error while executing this command.');
            } else {
                await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
            }
        }
    }

    if (commandName === 'stats') {
        if (eventStats) {
            const embed = new EmbedBuilder()
                .setTitle('Event Stats')
                .setDescription(eventStats)
                .setColor('#0099ff');
            await interaction.reply({ embeds: [embed], ephemeral: false });
        } else {
            await interaction.reply({ content: 'No stats available. Use !stats_add to add stats.', ephemeral: true });
        }
    }
});

discordClient.on('messageCreate', async message => {
    if (message.content.startsWith('!stats_add')) {
        const regex = /!stats_add "([^"]+)" "([^"]+)" "([^"]+)" "([^"]+)"(?: \*(.*))?/;
        const match = message.content.match(regex);

        if (match) {
            const [_, event, items, nGacha, nModal, optionalDesc] = match;
            eventStats = `Modal diamond yang dibutuhkan untuk event ${event}.\n~\nItem : ${items}\nTotal Gacha : ${nGacha}x Gacha 🎁\nModal : ${nModal} 💎\n~\n*Perlu diingat lagi ini angka cuma probabilitas aja, bisa kurang atau lebih.\n${optionalDesc ? `*${optionalDesc}` : ''}`;
            message.channel.send('Stats updated successfully.');
        } else {
            message.channel.send('Invalid format. Please use the correct format.');
        }
    }
});

discordClient.login(discordToken);
