const { ApifyClient } = require('apify-client');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const apifyClient = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

const facebookPageUrl = 'https://www.facebook.com/LGRIDofficial';

let lastPostHash = null;
let eventStats = null;

let serverConfigs = {};
if (fs.existsSync('serverConfigs.json')) {
    serverConfigs = JSON.parse(fs.readFileSync('serverConfigs.json'));
}

async function saveServerConfigs() {
    fs.writeFileSync('serverConfigs.json', JSON.stringify(serverConfigs));
}

function generateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

async function getLatestPost() {
    const input = {
        "startUrls": [
            {
                "url": facebookPageUrl
            }
        ],
        "resultsLimit": 1
    };

    try {
        const run = await apifyClient.actor("KoJrdxJCTtpon81KY").call(input);
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        if (items.length === 0) {
            return null;
        }
        const post = items[0];
        const hash = generateHash(post.text);
        return { url: post.url, content: post.text, hash: hash };
    } catch (error) {
        console.error('Error fetching the latest post:', error);
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
                        .setDescription(latestPost.content)
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
    } catch (error) {
        console.error(error);
    }

    setInterval(checkForUpdates, 60000);
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

    if (commandName === 'checkupdate') {
        try {
            await interaction.deferReply();
            const latestPost = await getLatestPost();
            if (latestPost) {
                const embed = new EmbedBuilder()
                    .setTitle('Latest post on LINE Let\'s Get Rich Facebook page')
                    .setDescription(latestPost.content)
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
        const regex = /!stats_add "([^"]+)" "([^"]+)" (\d+) (\d+)(?: \*(.*))?/;
        const match = message.content.match(regex);

        if (match) {
            const [_, event, items, nGacha, nModal, optionalDesc] = match;
            eventStats = `Modal diamond yang dibutuhkan untuk event ${event}.\n~\nItem : ${items}\nTotal Gacha : ${nGacha}x Gacha 🎁\nModal : ${nModal}k DM 💎\n~\n*Perlu diingat lagi ini angka cuma probabilitas aja, bisa kurang atau lebih.\n${optionalDesc ? `*${optionalDesc}` : ''}`;
            message.channel.send('Stats updated successfully.');
        } else {
            message.channel.send('Invalid format. Please use the correct format.');
        }
    }
});

discordClient.login(discordToken);
