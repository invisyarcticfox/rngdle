import { Client, TextChannel, BaseMessageOptions, EmbedBuilder, HexColorString, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import config from './config'
import type { RNGdle } from './types'

const client = new Client({ intents: 'Guilds' })
let rngdleChannel:TextChannel
let promise:Promise<Client>|null = null


export async function login():Promise<Client> {
  if (!config.discord.bot.token.trim()) throw new Error('Discord bot token not set')
  if (!config.discord.channel.id.trim()) throw new Error('Discord channel not set')
  if (promise) return promise

  promise = client.login(config.discord.bot.token)
    .then(async () => {
      console.log('Logged into Discord bot as', client.user?.username)

      const channel = await client.channels.fetch(config.discord.channel.id)
      if (!(channel instanceof TextChannel)) throw new Error(`Configured Discord channel is not a TextChannel`)
      
      rngdleChannel = channel
      return client
    }).catch(error => {
      promise = null
      throw error
    })

  return promise
}

export async function sendMsg(roll:RNGdle.Roll, rarity:RNGdle.Rarity, colour:HexColorString) {
  const topBadge = [...roll.badges].filter(b => b.isScoring).sort((a, b) => b.score - a.score)[0]
  
  const data:BaseMessageOptions = {
    content: `Got ${/^[aeiou]/i.test(rarity) ? 'an' : 'a'} **${rarity.toUpperCase()}** roll!`,
    embeds: [
      new EmbedBuilder()
        .setColor(colour)
        .setFields([
          { name: 'Number', value: String(roll.number), inline: true },
          { name: 'Total EP', value: roll.totalScore.toLocaleString(), inline: true },
          { name: 'Badges', value: `${roll.badges.length} *(${roll.badges.filter(b => b.isNew).length} new)*`, inline: true },
          { name: 'Old Lifetime EP', value: String(roll.lifetimeEp.before), inline: true },
          { name: 'New Lifetime EP', value: String(roll.lifetimeEp.after), inline: true },
          { name: 'Top Badge', value: [ `${topBadge.emoji} ${topBadge.label}`, `*${topBadge.description}*`, `${topBadge.score.toLocaleString()} EP` ].join('\n') },
        ])
        .setFooter({ text: 'RNGdle.com', iconURL: 'https://cdn.discordapp.com/emojis/1560916754920775700.png' })
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Compose Poem?')
            .setEmoji('🪶')
            .setStyle(ButtonStyle.Link)
            .setURL('https://rngdle.com')
        )
    ]
  }

  await rngdleChannel.send(data)
  console.log('Send Discord message')
}

export const logout = ():Promise<void> => client.destroy()