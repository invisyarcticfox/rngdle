import 'dotenv/config'
import { RNGdle } from './types'
import { loadCookies, checkSession, execRoll, getRarity, rarityColours } from './rngdle'
import { login, sendRoll } from './discord'

const notifRarity = new Set<RNGdle.Rarity>([ 'mythic', 'anomaly', 'epic', 'rare' ])


;(async () => {
  await login()

  const cookie = await loadCookies()
  if (!(await checkSession(cookie))) throw new Error('RNGdle authentication failed');
  
  const roll = await execRoll(cookie)
  if (roll === null) throw new Error('RNGdle roll was null?')

  const rarity = getRarity(roll.totalScore)
  if (notifRarity.has(rarity)) await sendRoll(roll, rarity, rarityColours[rarity])
  else console.log(`Roll today: ${rarity} ${roll.number}. Skipping notification`)
  process.exit(0)
})().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})