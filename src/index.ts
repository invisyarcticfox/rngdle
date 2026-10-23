import 'dotenv/config'
import { login, sendMsg, logout } from './discord'
import { checkAuth, checkRolled, roll, getRarity, getColour } from './rngdle'
import { loadCookies } from './cookies'

type Retry = { attemps?:number, delay?:number, label?:string }

async function retry<T>(fn:() => Promise<T>, { attemps = 5, delay = 10, label = 'Retry' }:Retry = {}):Promise<T> {
  for (let attempt = 1; attempt <= attemps; attempt++) {
    try {
      return await fn()
    } catch (error) {
      console.error(`${label} attempt ${attempt}/${attemps} failed:`, error)
      if (attempt === attemps) throw error
      console.log(`Retrying ${label.toLowerCase()} in ${delay} seconds...`)
      await new Promise(res => setTimeout(res, delay * 1000))
    }
  }

  throw new Error(`${label} failed unexpectedly`)
}


(async () => {
  try {
    await login()
    await loadCookies()
    
    const auth = await retry(() => checkAuth(), { label: 'RNGdle authentication' })
    if (!auth) throw new Error('Could not authenticate with rngdle.com')
    
    const hasRolled = await retry(() => checkRolled(), { label: 'RNGdle roll check' })
    if (hasRolled) return console.log(`Already rolled a ${getRarity(hasRolled.totalScore)} ${hasRolled.number} today (${hasRolled.totalScore.toLocaleString()} EP)`)
    
    const result = await retry(() => roll(), { label: 'RNGdle roll' })
    const rarity = getRarity(result.totalScore)
    
    const colour = getColour(rarity)
    await sendMsg(result, rarity, colour)
  } finally { await logout() }
})().catch(error => {
  console.error('RNGdle script failed:', error)
  process.exitCode = 1
})