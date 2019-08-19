
import { ParsedMessage } from 'discord-command-parser';
import { Message } from 'discord.js';
import { secondsToTimestamp } from '../bot';
import { IBot, IBotPlugin, MediaItem } from '../resources';
import * as fs from "fs"
import * as request from "request"
import * as path from "path"
import axios from "axios"
import { encode } from 'punycode';

const botConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "bot-config.json"), "utf8"));
const stationConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "config", "app.config.json"), "utf8"));
const stationType: string = 'station';

export default class YoutubePlugin implements IBotPlugin {

    preInitialize(bot: IBot): void {
        bot.helptext += '\n`station [id]` - Add station audio to the queue\n'
        bot.helptext += '\n`search [words]` - Search station audio\n'
        bot.helptext += '\n`random [count: default is 10]` - Add station audio selected at random\n'
        const player = bot.player;

        bot.commands.on(stationType, (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length > 0) {
                cmd.arguments.forEach(arg => {
                    player.addMedia({ type: stationType, url: arg, requestor: msg.author.username });
                });
            }
        });

        bot.commands.on("random", (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length <= 1) {
                const count: number = cmd.arguments[0] === undefined ? 10 : Number(cmd.arguments[0]);
                axios(`http://localhost:${stationConfig.PORT}/api/v1/song/random/list?count=${count}&token=${botConfig.station.token}`).then(x => x.data).then(resp => {
                    resp.songs.map((x: any, i: number) => {
                        player.addMedia({ type: stationType, url: x.id, requestor: msg.author.username });
                    });
                })
            }
        });

        bot.commands.on("search", (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length > 0) {
                const searchWords = cmd.arguments.join(" ")
                msg.channel.send(`Search this words: "${searchWords}"`);
                axios(`http://localhost:${stationConfig.PORT}/api/v1/song?q=${encodeURIComponent(searchWords)}&count=10&token=${botConfig.station.token}`).then(x => x.data).then(resp => {
                    msg.channel.send(resp.songs.map((x: any, i: number) => {
                        return `${i + 1}: ID: ${x.id}, ${x.title} - ${x.album} - ${x.artist}`
                    }));
                })
            }
        });

        player.typeRegistry.set(
            stationType,
            {
                getDetails: (item: MediaItem) => new Promise(async (done, error) => {
                    const name: string = await axios(`http://localhost:${stationConfig.PORT}/api/v1/song/meta/${item.url}?&token=${botConfig.station.token}`).then(x => x.data).then(resp => {
                        return `${resp.data.title} - ${resp.data.album} - ${resp.data.artist}`
                    })
                    item.url = `http://localhost:${stationConfig.PORT}/api/v1/song/${item.url}`;
                    item.name = name
                    item.duration = "99:99"
                    done(item)
                }),
                getStream: (item: MediaItem) => new Promise((done, error) => {
                    console.log(item.url + "?token=" + botConfig.station.token);
                    done(request(item.url + "?token=" + botConfig.station.token));
                })
            }
        );
    }

    postInitialize(bot: IBot): void {

    }

}
