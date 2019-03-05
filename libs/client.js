const ip = require('ip')
const net = require('net')
const config = require('../utils/config')
const crypto = require('../utils/crypto')
const WebSocket = require('ws')

const STAGE_INIT = 0x00
const STAGE_CONNECT = 0x01
const STAGE_CACHE = 0x10
const STAGE_PIPE = 0x11

const SOCKS_VERSION = 0x05

const NO_AUTH = 0x00

const COMMAND_CONNECT = 0x01;
const COMMAND_BIND = 0x02;
const COMMAND_UDP = 0x03;

const RESERVED = 0x00

const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV6 = 0x04;

const REPLY_SUCCEEDED = 0x00
const REPLY_COMMAND_NOT_SUPPORTED = 0x07
const REPLY_ATYP_NOT_SUPPORTED = 0x08

const stage_init = (info, data) => {
  let buf = Buffer.from([SOCKS_VERSION, NO_AUTH])
  info.socket.write(buf)
  info.stage = STAGE_CONNECT
}

const stage_connect = (info, data) => {

  let cmd = data[1]
  if (![COMMAND_CONNECT].includes(cmd)) {
    let buf = Buffer.from([SOCKS_VERSION, REPLY_COMMAND_NOT_SUPPORTED, RESERVED, ATYP_IPV4])
    info.socket.end(buf)
    return
  }

  let atype = data[3]
  if (![ATYP_IPV4, ATYP_DOMAIN, ATYP_IPV6].includes(atype)) {
    let buf = Buffer.from([SOCKS_VERSION, REPLY_ATYP_NOT_SUPPORTED, RESERVED, ATYP_IPV4])
    info.socket.end(buf)
    return
  }

  let addr, port
  if (atype === ATYP_IPV4) {
    addr = data.slice(4, 8).join('.')
    port = data.slice(8, 10)
  }
  if (atype === ATYP_DOMAIN) {
    let len = data[4]
    addr = data.slice(5, 5 + len).toString()
    port = data.slice(5 + len, 5 + len + 2)
  }
  if (atype === ATYP_IPV6) {
    addr = ip.toString(data.slice(4, 20))
    port = data.slice(20, 22)
  }

  info.stage = STAGE_CACHE

  let buf = Buffer.from([SOCKS_VERSION, REPLY_SUCCEEDED, RESERVED, ATYP_IPV4, RESERVED, RESERVED, RESERVED, RESERVED])
  buf = Buffer.concat([buf, port])
  info.socket.write(buf)

  info.ws = new WebSocket(config.url)

  info.ws.on('open', () => {

    console.log('[ws] open')

    info.nonce = crypto.nonce()

    let buf = Buffer.concat([Buffer.from(addr), port])
    buf = crypto.encrypt(buf, info.nonce)
    buf = Buffer.concat([buf, info.nonce])
    info.ws.send(buf)

    while (info.cache.length) {
      let buf = info.cache.shift()
      buf = crypto.encrypt(buf, info.nonce)
      info.ws.send(buf)
    }

    info.stage = STAGE_PIPE
    info.heart = setInterval(() => info.ws.ping('', null, true), 30 * 1000)
  })

  info.ws.on('message', data => {
    let buf = crypto.decrypt(data, info.nonce)
    if (buf !== null) {
      info.socket.write(buf)
    }
  })

  info.ws.on('close', () => {
    console.log('[ws] closed')
    clearInterval(info.heart)
    info.socket.end()
  })

  info.ws.on('error', error => {
    console.log('[ws] error:', error.message)
    info.socket.destroy()
  })

}

const stage_cache = (info, data) => {
  info.cache.push(data)
}

const stage_pipe = (info, data) => {
  let buf = crypto.encrypt(data, info.nonce)
  if (info.ws.readyState === WebSocket.OPEN) {
    info.ws.send(buf)
  }
}

module.exports = socket => {

  console.log('[client] connected')

  let info = {
    socket,
    nonce: null,
    ws: null,
    heart: null,
    stage: STAGE_INIT,
    cache: [],
  }

  socket.on('data', data => {
    switch (info.stage) {
      case STAGE_INIT:
        return stage_init(info, data)
      case STAGE_CONNECT:
        return stage_connect(info, data)
      case STAGE_CACHE:
        return stage_cache(info, data)
      case STAGE_PIPE:
        return stage_pipe(info, data)
    }
  })

  socket.on('end', () => {
    console.log('[client] disconnected')
    if (info.ws) {
      info.ws.terminate()
    }
  })

  socket.on('error', error => {
    console.log('[client] error', error)
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
