import { readFile, writeFile } from 'node:fs/promises'

type Cookie = { value:string, expires:number|null }
type Cookies = Record<string, Cookie>

const txtPath = 'config/cookies.txt'
const jsonPath = 'config/cookies.json'
let cookies:Cookies = {}


export async function loadCookies():Promise<void> {
  try {
    const file = await readFile(jsonPath, 'utf-8')
    cookies = JSON.parse(file) as Cookies
    console.log('Loaded cookies from cookies.json')
    return
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  
  const file = await readFile(txtPath, 'utf-8')
  const initial:Cookies = {}

  for (const line of file.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue

    const fields = line.split('\t')
    if (fields.length < 7) throw new Error('Unexpected cookie file format')

    const [, , , , expiry, name, value] = fields
    const expires = Number(expiry)

    if (expiry !== '0' && (!Number.isFinite(expires) || expires <= 0)) throw new Error(`Invalid expiry for cookie ${name}`)

    initial[name] = {
      value,
      expires: expiry === '0' ? null : expires
    }
  }

  if (!Object.keys(initial).length) throw new Error('No usable cookies found in cookies.txt')

  cookies = initial
  await saveCookies()
  console.log('Initialised cookies.json from cookies.txt')
}

export function getCookieHeader():string {
  const now = Math.floor(Date.now() / 1000)

  return Object.entries(cookies)
    .filter(([, cookie]) => cookie.expires === null || cookie.expires > now)
    .map(([name, cookie]) => `${name}=${cookie.value}`)
    .join('; ')
}

export async function updateCookies(res:Response):Promise<void> {
  const setCookies = res.headers.getSetCookie()
  if (!setCookies.length) return

  let changed = false
  const now = Math.floor(Date.now() / 1000)

  for (const header of setCookies) {
    const parts = header.split(';')
    const separator = parts[0].indexOf('=')
    if (separator < 1) continue

    const name = parts[0].slice(0, separator).trim()
    const value = parts[0].slice(separator + 1).trim()
    const attributes = new Map<string, string>()

    for (const part of parts.slice(1)) {
      const i = part.indexOf('=')
      const key = (i < 0 ? part : part.slice(0, i)).trim().toLowerCase()
      const attrValue = i < 0 ? '' : part.slice(i + 1).trim()
      attributes.set(key, attrValue)
    }

    let expires:number|null = null

    if (attributes.has('max-age')) {
      const maxAge = Number(attributes.get('max-age'))
      if (!Number.isInteger(maxAge)) continue

      if (maxAge <= 0) {
        if (name in cookies) {
          delete cookies[name]
          changed = true
        }
        continue
      }

      expires = now + maxAge
    } else if (attributes.has('expires')) {
      const timestamp = Date.parse(attributes.get('expires')!)
      if (Number.isNaN(timestamp)) continue

      expires = Math.floor(timestamp / 1000)

      if (expires <= now) {
        if (name in cookies) {
          delete cookies[name]
          changed = true
        }
        continue
      }
    }

    const previous = cookies[name]
    if (previous?.value !== value || previous?.expires !== expires) {
      cookies[name] = { value, expires }
      changed = true
    }
  }

  if (changed) {
    await saveCookies()
    console.log('Updated cookies.json from Set-Cookie headers')
  }
}

async function saveCookies():Promise<void> {
  await writeFile(jsonPath, JSON.stringify(cookies, null, 2))
}