/**
 * Cloudflare Workers 服务端 - 使用 Hono 框架
 */

import { Hono } from 'hono'
import { Crypto } from './utils/crypto.js'
import { connect } from 'cloudflare:sockets'

const app = new Hono()

// 连接阶段常量
const STAGE_CONNECT = 0x01
const STAGE_CACHE = 0x10
const STAGE_PIPE = 0x11

/**
 * 处理 WebSocket 连接
 */
async function handleWebSocket(request, env) {
  const upgradeHeader = request.headers.get('Upgrade')
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 })
  }

  const webSocketPair = new WebSocketPair()
  const [client, server] = Object.values(webSocketPair)

  // 获取配置
  const key = env.KEY || 'wsdog'
  const method = env.METHOD || 'aes-256-gcm'
  const crypto = new Crypto(key, method)

  // 连接状态
  const state = {
    stage: STAGE_CONNECT,
    nonce: null,
    remote: null,
    cache: []
  }

  server.accept()

  server.addEventListener('message', async (event) => {
    try {
      // 兼容不同环境的 event.data 类型
      let arrayBuffer
      if (event.data instanceof ArrayBuffer) {
        arrayBuffer = event.data
      } else if (event.data.arrayBuffer) {
        arrayBuffer = await event.data.arrayBuffer()
      } else {
        throw new Error('Unsupported data type')
      }
      const data = new Uint8Array(arrayBuffer)

      switch (state.stage) {
        case STAGE_CONNECT:
          await handleConnect(state, data, crypto, server)
          break
        case STAGE_CACHE:
          await handleCache(state, data, crypto)
          break
        case STAGE_PIPE:
          await handlePipe(state, data, crypto)
          break
      }
    } catch (error) {
      console.error('[websocket] error:', error.message)
      server.close()
    }
  })

  server.addEventListener('close', () => {
    console.log('[websocket] closed')
    if (state.remote) {
      state.remote.close()
    }
  })

  return new Response(null, {
    status: 101,
    webSocket: client
  })
}

/**
 * 连接阶段 - 解析目标地址并建立连接
 */
async function handleConnect(state, data, crypto, server) {
  // 提取 nonce (最后 16 字节)
  state.nonce = data.slice(-16)

  // 解密数据
  const decrypted = await crypto.decrypt(data.slice(0, -16), state.nonce)
  if (decrypted === null) {
    console.error('[connect] decryption failed')
    server.close()
    return
  }

  state.stage = STAGE_CACHE

  // 解析地址和端口
  const addr = new TextDecoder().decode(decrypted.slice(0, -2))
  const port = new DataView(decrypted.buffer, decrypted.byteOffset + decrypted.length - 2, 2).getUint16(0)

  console.log(`[connect] ${addr}:${port}`)

  try {
    // 在 Cloudflare Workers 中连接到远程主机
    state.remote = connect({ hostname: addr, port })

    // 读取远程数据
    const reader = state.remote.readable.getReader()
    const writer = state.remote.writable.getWriter()

    // 发送缓存的数据
    for (const buf of state.cache) {
      await writer.write(buf)
    }
    state.cache = []
    state.stage = STAGE_PIPE

    // 转发远程数据到 WebSocket
    ;(async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const encrypted = await crypto.encrypt(value, state.nonce)
          server.send(encrypted)
        }
      } catch (error) {
        console.error('[remote] error:', error.message)
      } finally {
        server.close()
      }
    })()

    // 保存 writer 供后续使用
    state.writer = writer

  } catch (error) {
    console.error('[connect] error:', error.message)
    server.close()
  }
}

/**
 * 缓存阶段 - 缓存数据等待连接建立
 */
async function handleCache(state, data, crypto) {
  const decrypted = await crypto.decrypt(data, state.nonce)
  if (decrypted !== null) {
    state.cache.push(decrypted)
  }
}

/**
 * 转发阶段 - 直接转发数据
 */
async function handlePipe(state, data, crypto) {
  const decrypted = await crypto.decrypt(data, state.nonce)
  if (decrypted !== null && state.writer) {
    await state.writer.write(decrypted)
  }
}

/**
 * 主页处理 - 返回 404 模拟 nginx
 */
app.get('/', (c) => {
  return c.html(
    '<html><head><title>404 Not Found</title></head><body bgcolor="white"><center><h1>404 Not Found</h1></center><hr><center>nginx</center></body></html>',
    404
  )
})

/**
 * WebSocket 路由
 */
app.get('/ws', async (c) => {
  return handleWebSocket(c.req.raw, c.env)
})

export default app
