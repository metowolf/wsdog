/**
 * SOCKS5 客户端 - ESM 版本
 */

import net from 'net'
import WebSocket from 'ws'
import { config } from './utils/config.js'
import { Crypto } from './utils/crypto.js'

const STAGE_INIT = 0x00
const STAGE_CONNECT = 0x01
const STAGE_CACHE = 0x10
const STAGE_PIPE = 0x11

const SOCKS_VERSION = 0x05
const NO_AUTH = 0x00

const COMMAND_CONNECT = 0x01
const COMMAND_BIND = 0x02
const COMMAND_UDP = 0x03

const RESERVED = 0x00

const ATYP_IPV4 = 0x01
const ATYP_DOMAIN = 0x03
const ATYP_IPV6 = 0x04

const REPLY_SUCCEEDED = 0x00
const REPLY_COMMAND_NOT_SUPPORTED = 0x07
const REPLY_ATYP_NOT_SUPPORTED = 0x08

// 创建加密器
const crypto = new Crypto(config.key, config.method)

/**
 * 初始化阶段
 */
function stageInit(info) {
  const buf = Buffer.from([SOCKS_VERSION, NO_AUTH])
  info.socket.write(buf)
  info.stage = STAGE_CONNECT
}

/**
 * 连接阶段
 */
function stageConnect(info, data) {
  const cmd = data[1]
  if (![COMMAND_CONNECT].includes(cmd)) {
    const buf = Buffer.from([SOCKS_VERSION, REPLY_COMMAND_NOT_SUPPORTED, RESERVED, ATYP_IPV4])
    info.socket.end(buf)
    return
  }

  const atype = data[3]
  if (![ATYP_IPV4, ATYP_DOMAIN, ATYP_IPV6].includes(atype)) {
    const buf = Buffer.from([SOCKS_VERSION, REPLY_ATYP_NOT_SUPPORTED, RESERVED, ATYP_IPV4])
    info.socket.end(buf)
    return
  }

  let addr, port
  if (atype === ATYP_IPV4) {
    addr = data.slice(4, 8).join('.')
    port = data.slice(8, 10)
  } else if (atype === ATYP_DOMAIN) {
    const len = data[4]
    addr = data.slice(5, 5 + len).toString()
    port = data.slice(5 + len, 5 + len + 2)
  } else if (atype === ATYP_IPV6) {
    addr = Array.from(data.slice(4, 20))
      .map((b, i) => i % 2 === 0 ? b.toString(16).padStart(2, '0') : b.toString(16).padStart(2, '0'))
      .join('')
      .match(/.{1,4}/g)
      .join(':')
    port = data.slice(20, 22)
  }

  info.stage = STAGE_CACHE

  const buf = Buffer.from([SOCKS_VERSION, REPLY_SUCCEEDED, RESERVED, ATYP_IPV4, RESERVED, RESERVED, RESERVED, RESERVED])
  const reply = Buffer.concat([buf, port])
  info.socket.write(reply)

  // 建立 WebSocket 连接
  info.ws = new WebSocket(config.url)

  info.ws.on('open', () => {
    console.log('[ws] open')

    info.nonce = crypto.nonce()

    // 发送连接信息
    const addrBuf = Buffer.from(addr)
    const connectData = Buffer.concat([addrBuf, port])
    const encrypted = crypto.encrypt(connectData, info.nonce)
    const message = Buffer.concat([encrypted, info.nonce])
    info.ws.send(message)

    // 发送缓存的数据
    while (info.cache.length) {
      const cachedData = info.cache.shift()
      const encryptedData = crypto.encrypt(cachedData, info.nonce)
      info.ws.send(encryptedData)
    }

    info.stage = STAGE_PIPE
    info.heart = setInterval(() => {
      if (info.ws.readyState === WebSocket.OPEN) {
        info.ws.ping()
      }
    }, 30 * 1000)
  })

  info.ws.on('message', (data) => {
    const decrypted = crypto.decrypt(data, info.nonce)
    if (decrypted !== null) {
      info.socket.write(decrypted)
    }
  })

  info.ws.on('close', () => {
    console.log('[ws] closed')
    clearInterval(info.heart)
    info.socket.end()
  })

  info.ws.on('error', (error) => {
    console.log('[ws] error:', error.message)
    info.socket.destroy()
  })
}

/**
 * 缓存阶段
 */
function stageCache(info, data) {
  info.cache.push(data)
}

/**
 * 转发阶段
 */
function stagePipe(info, data) {
  const encrypted = crypto.encrypt(data, info.nonce)
  if (info.ws.readyState === WebSocket.OPEN) {
    info.ws.send(encrypted)
  }
}

/**
 * 处理客户端连接
 */
function handleClient(socket) {
  console.log('[client] connected')

  const info = {
    socket,
    nonce: null,
    ws: null,
    heart: null,
    stage: STAGE_INIT,
    cache: []
  }

  socket.on('data', (data) => {
    switch (info.stage) {
      case STAGE_INIT:
        return stageInit(info, data)
      case STAGE_CONNECT:
        return stageConnect(info, data)
      case STAGE_CACHE:
        return stageCache(info, data)
      case STAGE_PIPE:
        return stagePipe(info, data)
    }
  })

  socket.on('end', () => {
    console.log('[client] disconnected')
    if (info.ws) {
      info.ws.terminate()
    }
  })

  socket.on('error', (error) => {
    console.log('[client] error:', error.message)
    info.socket.destroy()
    if (info.ws) {
      info.ws.terminate()
    }
  })

  socket.setTimeout(config.timeout, () => {
    console.log('[client] timeout')
    info.socket.destroy()
    if (info.ws) {
      info.ws.terminate()
    }
  })
}

/**
 * 启动 SOCKS5 服务器
 */
const server = net.createServer(handleClient)

server.on('listening', () => {
  const info = server.address()
  console.log(`[server] listening at ${info.address}:${info.port}`)
  console.log(`[server] connecting to ${config.url}`)
})

server.on('error', (error) => {
  console.log('[server] error:', error.message)
})

server.listen(config.local_port, config.local_host)
