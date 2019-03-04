const net = require('net')
const config = require('./utils/config')
const client = require('./libs/client')

let server = net.createServer()

server.on('connection', client)

server.on('listening', () => {
  let info = server.address()
  console.log(`[server] listening at ${info.address}:${info.port}`)
})

server.on('error', error => {
  console.log('[server] error', error)
})

server.listen(config.local_port, config.local_host)
