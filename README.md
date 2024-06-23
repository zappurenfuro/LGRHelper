# LGR Helper Discord Bot

LGR Helper is a Discord bot designed to fetch and post updates from the LINE Let's Get Rich Facebook page into a specified Discord channel. The bot also allows users to set up and check for updates manually, as well as add event statistics.

## Commands

| Command       | Description                    | Usage                                                                                      | Permissions       |
|---------------|--------------------------------|--------------------------------------------------------------------------------------------|-------------------|
| `/setup`      | Setup the channel for updates  | `/setup channel:<channel>`                                                                 | Administrator      |
| `/checkupdate`| Check the latest update manually| `/checkupdate`                                                                             | None              |
| `/stats`      | Display the event stats        | `/stats`                                                                                   | None              |


## Setup Configuration

To use the `/setup` command, you need to have Administrator permission in your Discord server. After that, create or find a channel where you want the news to be posted and use the command as shown below.

### Example Setup Usage

- **Channel:** `#lgr-notification`
- **Command:** `/setup channel: #lgr-notification`
