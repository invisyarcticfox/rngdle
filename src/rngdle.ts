import { readFile } from 'node:fs/promises'
import type { HexColorString } from 'discord.js'
import type { RNGdle } from './types'

const rngUrl = 'https://www.rngdle.com'
const cookiesFile = 'data/cookies.txt'
const nextAction = '00bdc2450187355b643f1267646c94ed8e79b7d8ee'

export const rarityThresh:[number, RNGdle.Rarity][] = [ [2087, 'trash'], [5802, 'common'], [10074, 'uncommon'], [22293, 'rare'], [35469, 'epic'], [162292, 'anomaly'] ]
export const rarityColours:Record<RNGdle.Rarity, HexColorString> = {
  trash: '#ffd230',
  common: '#d1d5dc',
  uncommon: '#00d492',
  rare: '#51a2ff',
  epic: '#c27aff',
  anomaly: '#ff8904',
  mythic: '#ff6467',
} as const


function parseRollResult(body:string):RNGdle.Roll {
  const line = body.split(/\r?\n/).find(l => l.startsWith('1:'))
  if (!line) throw new Error('Roll result missing from server response')

  const result:unknown = JSON.parse(line.slice(2))

  if (
    typeof result !== 'object' ||
    result === null ||
    !('number' in result) ||
    typeof result.number !== 'number' ||
    !('totalScore' in result) ||
    typeof result.totalScore !== 'number' ||
    !('badges' in result) ||
    !Array.isArray(result.badges) ||
    !('lifetimeEp' in result) ||
    typeof result.lifetimeEp !== 'object' ||
    result.lifetimeEp === null ||
    !('before' in result.lifetimeEp) ||
    typeof result.lifetimeEp.before !== 'number' ||
    !('after' in result.lifetimeEp) ||
    typeof result.lifetimeEp.after !== 'number'
  ) throw new Error('Unexpected roll result format')

  return result as RNGdle.Roll
}

export async function loadCookies():Promise<string> {
  const file = await readFile(cookiesFile, 'utf-8')
  const cookies: string[] = []
  const host = new URL(rngUrl).hostname

  for (const line of file.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue

    const fields = line.split('\t')
    if (fields.length < 7) throw new Error('Unexpected cookie file format.')

    const [domain, _subdomain, path, secure, expiry, name, value] = fields

    const normDomain = domain.replace(/^\./, '')
    const domainMatch = host === normDomain || (domain.startsWith('.') && host.endsWith(domain))
    const pathMatch = path === '/' || new URL(rngUrl).pathname.startsWith(path)
    const secureMatch = secure.toUpperCase() !== 'TRUE' || rngUrl.startsWith('https://')
    const expired = expiry !== '0' && Number(expiry) <= Math.floor(Date.now() / 1000)

    if (domainMatch && pathMatch && secureMatch && !expired) cookies.push(`${name}=${value}`)
  }

  if (cookies.length === 0) throw new Error('No cookies found.')
  return cookies.join('; ')
}

export function getRarity(score:number):RNGdle.Rarity {
  for (const [ threshold, rarity ] of rarityThresh) if (score < threshold) return rarity
  return 'mythic'
}

export async function checkSession(cookie:string):Promise<boolean> {
  try {
    const res = await fetch(`${rngUrl}/api/auth/get-session`, {
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        'User-Agent': 'invisyarcticfox/RNGdleBot@v1 (lucas@itaf.uk)'
      },
      signal: AbortSignal.timeout(10_000)
    })
    const data:RNGdle.Session|null = await res.json()
    if (data === null) throw new Error('Session endpoint returned null')
    if (!data.session || !data.user) throw new Error('No authenticated user was returned')

    const expAt = Date.parse(data.session.expiresAt)
    if (expAt <= Date.now()) throw new Error('This session has expired')

    console.log(`Successfully authenticated as ${data.user.displayName ?? '[empty]'}`)
    console.log(`Session expires: ${new Date(data.session.expiresAt).toISOString()}`)
    return true
  } catch (error) {
    console.error('RNGdle session error:', error)
    return false
  }
}

export async function execRoll(cookie:string):Promise<RNGdle.Roll|null> {
  try {
    const res = await fetch(rngUrl, {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Accept: 'text/x-component',
        'Content-Type': 'text/plain;charset=UTF-8',
        'Next-Action': nextAction
      },
      body: '[]',
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) throw new Error(`Roll request returned ${res.status} (${res.statusText})`)

    return parseRollResult(await res.text())
  } catch (error) {
    console.error('RNGdle roll error:', error)
    return null
  }
}