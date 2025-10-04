/**
 * 配置管理模块 - ESM 版本
 */

import { config as dotenvConfig } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载 .env 文件
dotenvConfig({ path: join(__dirname, '../../.env') })

export const config = {
  url: process.env.URL || 'ws://127.0.0.1:8787/ws',
  key: process.env.KEY || 'wsdog',
  method: process.env.METHOD || 'aes-256-gcm',
  timeout: parseInt(process.env.TIMEOUT || '600', 10) * 1000,
  local_host: process.env.LOCAL_HOST || '127.0.0.1',
  local_port: process.env.LOCAL_PORT || '1080',
}
