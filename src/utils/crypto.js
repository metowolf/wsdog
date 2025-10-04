/**
 * 加密工具模块 - 支持 Cloudflare Workers 和 Node.js
 */

const ALGORITHM_KEYLEN = {
  'aes-128-gcm': 16,
  'aes-192-gcm': 24,
  'aes-256-gcm': 32,
  'none': 1,
}

/**
 * 从密码派生密钥
 */
async function deriveKey(password, algorithm) {
  if (algorithm === 'none') {
    return new Uint8Array(1)
  }

  const keylen = ALGORITHM_KEYLEN[algorithm]
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const saltBuffer = encoder.encode('salt')

  // 使用 Web Crypto API 派生密钥
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
      iterations: 10000,
      hash: 'SHA-256'
    },
    baseKey,
    keylen * 8
  )

  return new Uint8Array(derivedBits)
}

/**
 * 创建加密器类
 */
export class Crypto {
  constructor(password, algorithm) {
    this.password = password
    this.algorithm = algorithm
    this.keyPromise = deriveKey(password, algorithm)
  }

  /**
   * 生成随机 nonce
   */
  nonce() {
    return crypto.getRandomValues(new Uint8Array(16))
  }

  /**
   * 加密数据
   */
  async encrypt(data, nonce) {
    if (this.algorithm === 'none') {
      return data instanceof Uint8Array ? data : new Uint8Array(data)
    }

    const key = await this.keyPromise
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    )

    const dataBuffer = data instanceof Uint8Array ? data : new Uint8Array(data)
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        tagLength: 128
      },
      cryptoKey,
      dataBuffer
    )

    return new Uint8Array(encrypted)
  }

  /**
   * 解密数据
   */
  async decrypt(data, nonce) {
    if (this.algorithm === 'none') {
      return data instanceof Uint8Array ? data : new Uint8Array(data)
    }

    try {
      const key = await this.keyPromise
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      )

      const dataBuffer = data instanceof Uint8Array ? data : new Uint8Array(data)
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
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
}
