import fs from 'node:fs'
import path from 'node:path'

const config = path.join(process.cwd(), 'config', 'config.json')

type Config = {
  discord: {
    bot: { token: string }
    channel: { id: string }
  }
  userAgent: string
}

export default JSON.parse(fs.readFileSync(config, 'utf-8')) as Config