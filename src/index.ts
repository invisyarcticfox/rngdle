import 'dotenv/config'
import type { RNGdle } from './types'
import { login, sendMsg, logout } from './discord'
import { loadCookies, checkAuth, checkRolled, roll, getRarity, getColour } from './rngdle'

const notifRarities = new Set<RNGdle.Rarity>([ 'mythic', 'anomaly', 'epic' ])


;(async () => {
  try {
    await login()
    
    const cookies = await loadCookies()
    if (!cookies) throw new Error('No cookies found')
    
    const auth = await checkAuth(cookies)
    if (!auth) throw new Error('Could not authenticate with rngdle.com')
    
    const hasRolled = await checkRolled(cookies)
    if (hasRolled) return console.log(`Already rolled a ${getRarity(hasRolled.totalScore)} ${hasRolled.number} today (${hasRolled.totalScore.toLocaleString()} EP)`)
    
    const result = await roll(cookies)
    const rarity = getRarity(result.totalScore)
    if (!notifRarities.has(rarity)) return console.log(`Rolled a ${rarity} ${result.number} today, too low :(`)
    
    const colour = getColour(rarity)
    await sendMsg(result, rarity, colour)
  } finally { await logout() }
})().catch(error => {
  console.error('RNGdle script failed:', error)
  process.exitCode = 1
})