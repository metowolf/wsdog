require('dotenv').config({
  path: __dirname + '/../.env'
})

module.exports = {
  url: process.env.URL || 'ws://127.0.0.1:80/',
  key: process.env.KEY || 'wsdog',
  method: process.env.METHOD || 'aes-256-gcm',
  timeout: parseInt(process.env.TIMEOUT || '60', 10) * 1000,
  local_host: process.env.LOCAL_HOST || '127.0.0.1',
  local_port: process.env.LOCAL_PORT || '1080',
  server_host: process.env.SERVER_HOST || '0.0.0.0',
  server_port: process.env.SERVER_PORT || '80',
  server_path: process.env.SERVER_PATH || '/',
}
