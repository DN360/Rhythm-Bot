import { ParsedMessage } from 'discord-command-parser';
import { Message } from 'discord.js';
import { secondsToTimestamp } from '../bot';
import { IBot, IBotPlugin, MediaItem } from '../resources';
import * as fs from "fs"
import * as request from "request"
import * as path from "path"
import * as BPromise from "bluebird"
import axios from "axios"
import { encode } from 'punycode';

const stationConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "config", "app.config.json"), "utf8"));

const stationType: string = 'station';
let searchIds = []
let prevPageURL = "";
let nextPageURL = "";
let pageURL = "";

export const getRandomId = async (count: number, token: string) => {
    const list = axios(`http://localhost:${stationConfig.PORT}/api/v1/song/random/list?count=${count}&token=${token}`).then(x => x.data).then(resp => {
        return (resp.songs as any[]).map((x: { id: string }, i: number) => {
            return x.id
        });
    })
    return list
}

export const getNameFromId = async (id: string, token: string) => {
    const name: string = await axios(`http://localhost:${stationConfig.PORT}/api/v1/song/meta/${id}?&token=${token}`).then(x => x.data).then(resp => {
        return `${resp.data.title} - ${resp.data.album} - ${resp.data.artist}`
    })
    return name
}

export default class StationPlugin implements IBotPlugin {

    preInitialize(bot: IBot): void {
        bot.helptext += '\n`station [id]` - Add station audio to the queue\n'
        bot.helptext += '\n`search [words]` - Search station audio\n'
        bot.helptext += '\n`random [count: default is 10]` - Add station audio selected at random\n'
        const player = bot.player;

        bot.commands.on(stationType, (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length > 0) {
                BPromise.map(cmd.arguments, arg => {
                    return player.addMedia({ type: stationType, url: arg, requestor: msg.author.username });
                }, { concurrency: 1 })
            }
        });

        bot.commands.on("random", (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length <= 1) {
                const count: number = cmd.arguments[0] === undefined ? 10 : Number(cmd.arguments[0]);
                getRandomId(count, bot.config.station.token).then(urls => {
                    urls.map(url => {
                        player.addMedia({ type: stationType, url, requestor: msg.author.username });
                    })
                })
            }
        });

        bot.commands.on("toggle", (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length <= 1) {
                const autoAddRandomStation = player.autoAddRandom.get(stationType) || false
                player.autoAddRandom.set(stationType, !autoAddRandomStation)
                return msg.channel.send(`Auto random addition mode is changed to ${player.autoAddRandom.get(stationType) ? "on" : "off"}!`);
            }
        });

        bot.commands.on("select", (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length > 0) {
                BPromise.map(cmd.arguments, arg => {
                    return player.addMedia({ type: stationType, url: searchIds.find(x => x.number === Number(arg)).id, requestor: msg.author.username });
                }, { concurrency: 1 })
            }
        });

        bot.commands.on("prev", (cmd: ParsedMessage, msg: Message) => {
            axios(prevPageURL).then(x => x.data).then(resp => {
                searchIds = [];
                prevPageURL = `${pageURL}${resp.pages.prevPage === null ? "" : "&page=" + resp.pages.prevPage}`;
                nextPageURL = `${pageURL}${resp.pages.nextPage === null ? "" : "&page=" + resp.pages.nextPage}`;
                msg.channel.send("```" + resp.songs.map((x: any, i: number) => {
                    searchIds.push({
                        number: i + 1,
                        id: x.id
                    })
                    return `${i + 1}: ${x.title} - ${x.album} - ${x.artist}, ID: ${x.id}`
                }).join("\n") + "```").then(() => {
                    return msg.channel.send(["if you want to check next page, type " + bot.config.command.symbol + "next, and if previous, type " + bot.config.command.symbol + "prev", "To select song, type `" + bot.config.command.symbol + "select number`"]);
                });;
            })
        });

        bot.commands.on("next", (cmd: ParsedMessage, msg: Message) => {
            axios(nextPageURL).then(x => x.data).then(resp => {
                searchIds = [];
                prevPageURL = `${pageURL}${resp.pages.prevPage === null ? "" : "&page=" + resp.pages.prevPage}`;
                nextPageURL = `${pageURL}${resp.pages.nextPage === null ? "" : "&page=" + resp.pages.nextPage}`;
                msg.channel.send("```" + resp.songs.map((x: any, i: number) => {
                    searchIds.push({
                        number: i + 1,
                        id: x.id
                    })
                    return `${i + 1}: ${x.title} - ${x.album} - ${x.artist}, ID: ${x.id}`
                }).join("\n") + "```").then(() => {
                    return msg.channel.send(["if you want to check next page, type " + bot.config.command.symbol + "next, and if previous, type " + bot.config.command.symbol + "prev", "To select song, type `" + bot.config.command.symbol + "select number`"]);
                });
            })
        });

        bot.commands.on("search", (cmd: ParsedMessage, msg: Message) => {
            if (cmd.arguments.length > 0) {
                const searchWords = cmd.arguments.join(" ")
                msg.channel.send(`Search this words: "${searchWords}"`);
                pageURL = `http://localhost:${stationConfig.PORT}/api/v1/song?q=${encodeURIComponent(searchWords)}&count=10&token=${bot.config.station.token}`;
                axios(pageURL).then(x => x.data).then(resp => {
                    searchIds = [];
                    prevPageURL = `${pageURL}${resp.pages.prevPage === null ? "" : "&page=" + resp.pages.prevPage}`;
                    nextPageURL = `${pageURL}${resp.pages.nextPage === null ? "" : "&page=" + resp.pages.nextPage}`;
                    msg.channel.send("```" + resp.songs.map((x: any, i: number) => {
                        searchIds.push({
                            number: i + 1,
                            id: x.id
                        })
                        return `${i + 1}: ${x.title} - ${x.album} - ${x.artist}, ID: ${x.id}`
                    }).join("\n") + "```").then(() => {
                        return msg.channel.send(["if you want to check next page, type " + bot.config.command.symbol + "next, and if previous, type " + bot.config.command.symbol + "prev", "To select song, type `" + bot.config.command.symbol + "select number`"]);
                    });
                })
            }
        });

        player.typeRegistry.set(
            stationType,
            {
                getDetails: (item: MediaItem) => new Promise(async (done, error) => {
                    const name: string = await axios(`http://localhost:${stationConfig.PORT}/api/v1/song/meta/${item.url}?&token=${bot.config.station.token}`).then(x => x.data).then(resp => {
                        return `${resp.data.title} - ${resp.data.album} - ${resp.data.artist}`
                    })
                    item.url = `http://localhost:${stationConfig.PORT}/api/v1/song/${item.url}`;
                    item.name = name
                    item.duration = "99:99"
                    done(item)
                }),
                getStream: (item: MediaItem) => new Promise((done, error) => {
                    done(request(item.url + "?token=" + bot.config.station.token));
                })
            }
        );

        player.autoURLtoggleFunctions.set(stationType, async () => {
            const ids = await getRandomId(1, bot.config.station.token)
            if (ids === undefined || ids.length === 0) {
                return null
            }
            return {
                url: `http://localhost:${stationConfig.PORT}/api/v1/song/${ids[0]}`,
                name: await getNameFromId(ids[0], bot.config.station.token)
            }
        })
    }

    postInitialize(bot: IBot): void {

    }

}
