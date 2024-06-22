const { ApifyClient } = require('apify-client');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const apifyClient = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const discordToken = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

const facebookPageUrl = 'https://www.facebook.com/LGRIDofficial';

let lastPostUrl = null; // Store the last post URL in a variable

// Load server configurations
let serverConfigs = {};
if (fs.existsSync('serverConfigs.json')) {
    serverConfigs = JSON.parse(fs.readFileSync('serverConfigs.json'));
}

async function saveServerConfigs() {
    fs.writeFileSync('serverConfigs.json', JSON.stringify(serverConfigs));
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
        return { url: post.url, content: post.text };
    } catch (error) {
        console.error('Error fetching the latest post:', error);
        return null;
    }
}

async function checkForUpdates() {
    const latestPost = await getLatestPost();
    if (latestPost && latestPost.url !== lastPostUrl) {
        lastPostUrl = latestPost.url; // Update the last post URL

        for (const guildId in serverConfigs) {
            const channelId = serverConfigs[guildId];
            const channel = discordClient.channels.cache.get(channelId);

            if (channel) {
                try {
                    // Tag @everyone and delete the message immediately
                    const everyoneTag = await channel.send('@everyone');
                    await everyoneTag.delete();

                    // Send the update message
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

    // Register slash commands
    const commands = [
        {
            name: 'setup',
            description: 'Setup the channel for updates',
            options: [
                {
                    name: 'channel',
                    type: 7, // Channel type
                    description: 'The channel to send updates to',
                    required: true,
                }
            ]
        },
        {
            name: 'checkupdate',
            description: 'Check the latest update manually'
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

    setInterval(checkForUpdates, 60000); // Check every 60 seconds
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
            await interaction.deferReply(); // Acknowledge the interaction immediately
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
});

discordClient.login(discordToken);
