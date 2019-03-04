const http = require('http')
const config = require('./utils/config')
const connection = require('./libs/server')
const WebSocket = require('ws').Server

let server = http.createServer((req, res) => {
  res.writeHead(404)
  res.end(`<html><head><title>404 Not Found</title></head><body bgcolor="white"><center><h1>404 Not Found</h1></center><hr><center>nginx</center></body></html>`)
})

let wss = new WebSocket({
  server,
  path: config.server_path,
})

server.listen(config.server_port, config.server_host)

server.on('listening', () => {
  let info = server.address()
  console.log(`[server] listening at ${info.address}:${info.port}`)
})

server.on('error', error => {
  console.log('[server] error', error)
})

wss.on('upgrade', data => {
  console.log(data)
})

wss.on('connection', connection)
