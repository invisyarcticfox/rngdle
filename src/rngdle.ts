import type { HexColorString } from 'discord.js'
import config from './config'
import type { RNGdle } from './types'
import { getCookieHeader, updateCookies } from './cookies'

const rngdleUrl = 'https://www.rngdle.com'
const rarities:[ number, RNGdle.Rarity ][] = [ [2087, 'trash'], [5802, 'common'], [10074, 'uncommon'], [22293, 'rare'], [35469, 'epic'], [162292, 'anomaly'] ]
const colours:Record<RNGdle.Rarity, HexColorString> = {
  trash: '#ffd230',
  common: '#d1d5dc',
  uncommon: '#00d492',
  rare: '#51a2ff',
  epic: '#c27aff',
  anomaly: '#ff8904',
  mythic: '#ff6467',
} as const


export function getRarity(score:number):RNGdle.Rarity {
  for (const [ threshold, rarity ] of rarities) if (score < threshold) return rarity
  return 'mythic'
}

export const getColour = (rarity:RNGdle.Rarity):HexColorString => colours[rarity]

function parseResult(body:string):RNGdle.Roll {
  const line = body.split(/\r?\n/).find(l => l.startsWith('1:'))
  if (!line) throw new Error('Roll result missing from input')
  
  const result = JSON.parse(line.slice(2))
  if (typeof result !== 'object' || result === null) throw new Error('Unexpected roll format')

  return result as RNGdle.Roll
}

async function getRollActionId():Promise<string> {
  console.log('Fetching RNGdle server action id..')

  const res = await fetch(rngdleUrl, {
    headers: {
      Cookie: getCookieHeader(),
      'User-Agent': config.userAgent
    },
    signal: AbortSignal.timeout(10_000)
  })
  if (!res.ok) throw new Error(`Home page fetch failed with HTTP ${res.status}`)
  
  const html = await res.text()
  const chunkPths = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\\\s]+?\.js(?:\?[^"'\\\s]*)?/g)].map(match => match[0]))]
  if (!chunkPths.length) throw new Error('Found no JS chunks')

  console.log(`Found ${chunkPths.length} JS chunks`)

  const chunks = await Promise.all(chunkPths.map(async path => {
    const url = new URL(path, rngdleUrl)
    const res = await fetch(url, {
      headers: {
        Cookie: getCookieHeader(),
        'User-Agent': config.userAgent
      },
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) return null
    return { path, content: await res.text() }
  }))

  for (const chunk of chunks) {
    if (!chunk) continue

    const match = chunk.content.match(/createServerReference\)?\s*\(\s*['"]([a-f0-9]{40,})['"],[\s\S]{0,1000}?['"]rollDiceAction['"]\s*\)/)
    if (match) {
      const actionId = match[1]
      console.log(`Found rollDiceAction in chunk ${chunk.path.split('/')[4]}`)
      console.log(`Server action id: ${actionId}`)
      return actionId
    }
  }

  throw new Error(`Could not find rollDiceAction in ${chunks.length} JS chunks`)
}


export async function checkAuth():Promise<boolean> {
  const res = await fetch(`${rngdleUrl}/api/auth/get-session`, {
    headers: {
      Cookie: getCookieHeader(),
      Accept: 'application/json',
      'User-Agent': config.userAgent
    },
    signal: AbortSignal.timeout(20_000)
  })
  await updateCookies(res)
  if (!res.ok) throw new Error(`Auth check failed with HTTP ${res.status}`)

  const data:RNGdle.Session|null = await res.json()
  if (data === null) throw new Error('Session endpont returned null')

  const expAt = Date.parse(data.session.expiresAt)
  if (expAt <= Date.now()) throw new Error('This session has expired')

  console.log('Logged into RNGdle as', data.user.displayName)
  return true
}

export async function checkRolled():Promise<RNGdle.Home['viewer']['lastRoll']|false> {
  const res = await fetch(`${rngdleUrl}/api/home`, {
    headers: {
      Cookie: getCookieHeader(),
      Accept: 'application/json',
      'User-Agent': config.userAgent
    },
    signal: AbortSignal.timeout(20_000)
  })
  if (!res.ok) throw new Error(`Home request failed with HTTP ${res.status}`)
  
  const {viewer}:RNGdle.Home = await res.json()
  if (viewer.hasRolledToday) return viewer.lastRoll
  return false
}

export async function roll():Promise<RNGdle.Roll> {
  const actionId = await getRollActionId()

  const res = await fetch(rngdleUrl, {
    method: 'POST',
    headers: {
      Cookie: getCookieHeader(),
      Accept: 'text/x-component',
      'Content-Type': 'text/plain;charset=UTF-8',
      'next-action': actionId,
    },
    body: '[]',
    signal: AbortSignal.timeout(30_000)
  })
  if (!res.ok) throw new Error(`Roll request failed with HTTP ${res.status}`)
    
  return parseResult(await res.text())
}