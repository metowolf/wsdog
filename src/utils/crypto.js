/**
 * 加密工具模块 - 支持 Cloudflare Workers 和 Node.js
 */

const ALGORITHM_KEYLEN = {
  'aes-128-gcm': 16,
  'aes-192-gcm': 24,
  'aes-256-gcm': 32,
  'none': 1,
}

const PBKDF2_ITERATIONS = 10000
const PBKDF2_DIGEST = 'sha256'
const PBKDF2_SALT = 'salt'

const WEB_CRYPTO_AVAILABLE = typeof globalThis.crypto?.subtle?.importKey === 'function'

let nodeCrypto = null

if (!WEB_CRYPTO_AVAILABLE && typeof process !== 'undefined' && process.versions?.node) {
  try {
    nodeCrypto = await import('node:crypto')
    if (nodeCrypto?.default && !nodeCrypto.pbkdf2Sync) {
      nodeCrypto = nodeCrypto.default
    }
  } catch {
    nodeCrypto = null
  }
}

function getNodeCrypto() {
  if (!nodeCrypto) {
    throw new Error('Node.js crypto module is not available in this environment')
  }

  return nodeCrypto
}

async function deriveKeyWeb(password, algorithm) {
  if (algorithm === 'none') {
    return new Uint8Array(1)
  }

  const keylen = ALGORITHM_KEYLEN[algorithm]
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const saltBuffer = encoder.encode(PBKDF2_SALT)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    keylen * 8
  )

  return new Uint8Array(derivedBits)
}

function deriveKeyNode(password, algorithm) {
  if (algorithm === 'none') {
    return new Uint8Array(1)
  }

  const keylen = ALGORITHM_KEYLEN[algorithm]
  const { pbkdf2Sync } = getNodeCrypto()
  const keyBuffer = pbkdf2Sync(password, PBKDF2_SALT, PBKDF2_ITERATIONS, keylen, PBKDF2_DIGEST)
  return new Uint8Array(keyBuffer.buffer, keyBuffer.byteOffset, keyBuffer.byteLength)
}

function ensureUint8Array(data) {
  if (data instanceof Uint8Array) {
    return data
  }
  return new Uint8Array(data)
}

function ensureBuffer(data) {
  if (Buffer.isBuffer(data)) {
    return data
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  }
  return Buffer.from(data)
}

function encryptNode(algorithm, key, data, nonce) {
  if (algorithm === 'none') {
    return ensureBuffer(data)
  }

  const { createCipheriv } = getNodeCrypto()
  const keyBuffer = ensureBuffer(key)
  const iv = ensureBuffer(nonce)
  const dataBuffer = ensureBuffer(data)

  const cipher = createCipheriv(algorithm, keyBuffer, iv)
  const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([encrypted, tag])
}

function decryptNode(algorithm, key, data, nonce) {
  if (algorithm === 'none') {
    return ensureBuffer(data)
  }

  try {
    const { createDecipheriv } = getNodeCrypto()
    const keyBuffer = ensureBuffer(key)
    const iv = ensureBuffer(nonce)
    const dataBuffer = ensureBuffer(data)

    const payload = dataBuffer.slice(0, -16)
    const tag = dataBuffer.slice(-16)
    const decipher = createDecipheriv(algorithm, keyBuffer, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()])
    return decrypted
  } catch (error) {
    return null
  }
}

/**
 * 创建加密器类
 */
export class Crypto {
  constructor(password, algorithm) {
    this.password = password
    this.algorithm = algorithm
    this.isWebCrypto = WEB_CRYPTO_AVAILABLE

    if (this.isWebCrypto) {
      this.keyPromise = deriveKeyWeb(password, algorithm)
    } else {
      this.key = deriveKeyNode(password, algorithm)
      this.keyPromise = Promise.resolve(this.key)
    }
  }

  /**
   * 生成随机 nonce
   */
  nonce() {
    if (this.isWebCrypto) {
      return crypto.getRandomValues(new Uint8Array(16))
    }

    const { randomBytes } = getNodeCrypto()
    return randomBytes(16)
  }

  /**
   * 加密数据
   */
  async encrypt(data, nonce) {
    if (this.algorithm === 'none') {
      return this.isWebCrypto ? ensureUint8Array(data) : ensureBuffer(data)
    }

    if (this.isWebCrypto) {
      const key = await this.keyPromise
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      )

      const dataBuffer = ensureUint8Array(data)
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: ensureUint8Array(nonce),
          tagLength: 128
        },
        cryptoKey,
        dataBuffer
      )

      return new Uint8Array(encrypted)
    }

    return encryptNode(this.algorithm, this.key, data, nonce)
  }

  /**
   * 解密数据
   */
  async decrypt(data, nonce) {
    if (this.algorithm === 'none') {
      return this.isWebCrypto ? ensureUint8Array(data) : ensureBuffer(data)
    }

    if (this.isWebCrypto) {
      try {
        const key = await this.keyPromise
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          key,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        )

        const dataBuffer = ensureUint8Array(data)
        const decrypted = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: ensureUint8Array(nonce),
            tagLength: 128
          },
          cryptoKey,
          dataBuffer
        )

        return new Uint8Array(decrypted)
      } catch (error) {
        return null
      }
    }

    return decryptNode(this.algorithm, this.key, data, nonce)
  }
}
