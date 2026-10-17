import { readFile } from 'node:fs/promises'
import type { HexColorString } from 'discord.js'
import config from './config'
import type { RNGdle } from './types'

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

export async function loadCookies(path:string=config.cookies.file):Promise<string> {
  const file = await readFile(path, 'utf-8')
  const cookies:string[] = []

  for (const line of file.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue

    const fields = line.split('\t')
    if (fields.length < 7) throw new Error('Unexpected cookie file format')

    const [ , , , , expiry, name, value ] = fields
    const expired = expiry !== '0' && Number(expiry) <= Math.floor(Date.now() / 1000)

    if (!expired) cookies.push(`${name}=${value}`)
  }

  if (!cookies.length) throw new Error('No usable cookies found')
  return cookies.join('; ')
}

function parseResult(body:string):RNGdle.Roll {
  const line = body.split(/\r?\n/).find(l => l.startsWith('1:'))
  if (!line) throw new Error('Roll result missing from input')
  
  const result = JSON.parse(line.slice(2))
  if (typeof result !== 'object' || result === null) throw new Error('Unexpected roll format')

  return result as RNGdle.Roll
}

export async function checkAuth(cookie:string):Promise<boolean> {
  const res = await fetch(`${rngdleUrl}/api/auth/get-session`, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(10_000)
  })
  if (!res.ok) throw new Error(`Auth check failed with HTTP ${res.status}`)

  const data:RNGdle.Session|null = await res.json()
  if (data === null) throw new Error('Session endpont returned null')

  const expAt = Date.parse(data.session.expiresAt)
  if (expAt <= Date.now()) throw new Error('This session has expired')

  console.log('Logged into RNGdle as', data.user.displayName)
  return true
}

export async function checkRolled(cookie:string):Promise<RNGdle.Home['viewer']['lastRoll']|false> {
  const res = await fetch(`${rngdleUrl}/api/home`, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(10_000)
  })
  if (!res.ok) throw new Error(`Home request failed with HTTP ${res.status}`)
  
  const {viewer}:RNGdle.Home = await res.json()
  if (viewer.hasRolledToday) return viewer.lastRoll
  return false
}

export async function roll(cookie:string):Promise<RNGdle.Roll> {
  const res = await fetch(rngdleUrl, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Accept: 'text/x-component',
      'Content-Type': 'text/plain;charset=UTF-8',
      'Next-Action': '00bdc2450187355b643f1267646c94ed8e79b7d8ee'
    },
    body: '[]',
    signal: AbortSignal.timeout(10_000)
  })
  if (!res.ok) throw new Error(`Roll request failed with HTTP ${res.status}`)
    
  return parseResult(await res.text())
}

export function getRarity(score:number):RNGdle.Rarity {
  for (const [ threshold, rarity ] of rarities) if (score < threshold) return rarity
  return 'mythic'
}

export const getColour = (rarity:RNGdle.Rarity):HexColorString => colours[rarity]