
import { ParsedMessage } from 'discord-command-parser';
import { Message } from 'discord.js';
import { secondsToTimestamp } from '../bot';
import { IBot, IBotPlugin, MediaItem } from '../resources';
import * as fs from "fs"
import * as request from "request"

const stationType: string = 'station';

export default class YoutubePlugin implements IBotPlugin {

    preInitialize(bot: IBot): void {
        bot.helptext += '\n`station [url/id]` - Add station audio to the queue\n'
        const player = bot.player;

        bot.commands.on(stationType, (cmd: ParsedMessage, msg: Message) => {
            if(cmd.arguments.length > 0) {
                cmd.arguments.forEach(arg => {
                    player.addMedia({ type: stationType, url: arg, requestor: msg.author.username });
                });
            }
        });

        player.typeRegistry.set(
            stationType,
            {
                getDetails: (item: MediaItem) => new Promise((done, error) => {
                    item.url = item.url.includes('://') ? item.url : `http://localhost/api/v1/song/${item.url}`;
                    item.name = "Unknown"
                    item.duration = "99:99"
                    done(item)
                }),
                getStream: (item: MediaItem) => new Promise((done, error) => {
                    console.log(item.url + "?token=6ad9d33e-b2b8-4247-8a2c-900a3bde693e");
                    done(request(item.url + "?token=6ad9d33e-b2b8-4247-8a2c-900a3bde693e"));
                })
            }
        );
    }

    postInitialize(bot: IBot): void {
        
    }

}
