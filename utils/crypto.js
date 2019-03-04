const crypto = require('crypto')
const config = require('./config')

const keylen = {
  'aes-128-gcm': 16,
  'aes-192-gcm': 24,
  'aes-256-gcm': 32,
  'none': 1,
}

let algorithm = config.method
let password = config.key
let len = algorithm === 'none'
let key = crypto.scryptSync(password, 'salt', keylen[algorithm])

module.exports = {

  nonce: () => {
    return crypto.randomBytes(16)
  },

  encrypt: (data, nonce) => {
    if (algorithm === 'none') return data
    let cipher = crypto.createCipheriv(algorithm, key, nonce)
    let buf = Buffer.concat([cipher.update(data), cipher.final()])
    let tag = cipher.getAuthTag()
    return Buffer.concat([buf, tag])
  },

  decrypt: (data, nonce) => {
    if (algorithm === 'none') return data
    try {
      let decipher = crypto.createDecipheriv(algorithm, key, nonce)
      decipher.setAuthTag(data.slice(-16))
      let buf = Buffer.concat([decipher.update(data.slice(0, -16)), decipher.final()])
      return buf
    } catch (e) {
      return null
    }
  }

}
