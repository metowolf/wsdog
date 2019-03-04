const net = require('net')
const crypto = require('../utils/crypto')
const WebSocket = require('ws')

const STAGE_CONNECT = 0x01
const STAGE_CACHE = 0x10
const STAGE_PIPE = 0x11

const stage_connect = (info, data) => {

  info.nonce = data.slice(-16)
  data = crypto.decrypt(data.slice(0, -16), info.nonce)
  if (data === null) {
    info.ws.terminate()
    return
  }

  info.stage = STAGE_CACHE

  let remote_info = data.toString()
  remote_info = JSON.parse(remote_info)

  info.remote = net.connect(remote_info.port, remote_info.addr, () => {
    console.log('[net] connected')

    while (info.cache.length) {
      let buf = info.cache.shift()
      info.remote.write(buf)
    }

    info.stage = STAGE_PIPE
  })

  info.remote.on('data', data => {
    let buf = crypto.encrypt(data, info.nonce)
    info.ws.send(buf)
  })

  info.remote.on('end', () => {
    console.log('[net] disconnected')
    info.ws.close()
  })

  info.remote.on('error', error => {
    console.log('[net] error:', error.message)
    info.ws.terminate()
  })
}

const stage_cache = (info, data) => {
  data = crypto.decrypt(data, info.nonce)
  if (data !== null) {
    info.cache.push(data)
  }
}

const stage_pipe = (info, data) => {
  data = crypto.decrypt(data, info.nonce)
  if (data !== null) {
    info.remote.write(data)
  }
}

module.exports = ws => {

  console.log('[websocket] open')

  let info = {
    ws,
    nonce: null,
    remote: null,
    stage: STAGE_CONNECT,
    cache: [],
  }

  ws.on('message', data => {
    switch (info.stage) {
      case STAGE_CONNECT:
        return stage_connect(info, data)
      case STAGE_CACHE:
        return stage_cache(info, data)
      case STAGE_PIPE:
        return stage_pipe(info, data)
    }
  })

  ws.on('ping', () => info.ws.pong('', null, true))

  ws.on('close', () => {
    console.log('[websocket] closed')
    if (info.remote) {
      console.log('[net] disconnected')
      info.remote.destroy()
    }
  })

  ws.on('error', error => {
    console.log('[websocket] error:', error.message)
    if (info.remote) {
      info.remote.destroy()
    }
  })

}
