import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type HexColorString, type BaseMessageOptions } from 'discord.js'
import type { RNGdle } from './types'

const client = new Client({ intents: 'Guilds' })
export let rngdleChannel:TextChannel
let promise:Promise<Client>|null = null


export async function login():Promise<Client> {
  if (!process.env.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN variable not set')
  if (!process.env.DISCORD_CHANNEL_ID) throw new Error('DISCORD_CHANNEL_ID variable not set')
  
  
  if (promise) return promise

  promise = client.login(process.env.DISCORD_BOT_TOKEN!)
    .then(async () => {
      console.log(`Logged into Discord as ${client.user?.username}`)

      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID!)
      if (!(channel instanceof TextChannel)) throw new Error(`#${channel?.id} is not a TextChannel`)
      
      rngdleChannel = channel
      return client
    }).catch((error:unknown) => {
      promise = null
      throw error
    })

  return promise
}

export async function sendRoll(roll:RNGdle.Roll, rarity:RNGdle.Rarity, colour:HexColorString) {
  const topBadge = roll.badges.sort((a, b) => b.score - a.score)[0]
  try {
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
            { name: 'Top Badge', value: [ `${topBadge.emoji} ${topBadge.label}`, `*${topBadge.description}*`, topBadge.score.toLocaleString() ].join('\n') }
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
    console.log('Sent Discord message')
  } catch (error) {
    console.error('Discord message error:', error)
    throw error
  }
}