/**
 * 加密工具模块 - Node.js 版本 (客户端使用)
 */

import crypto from 'crypto'

const ALGORITHM_KEYLEN = {
  'aes-128-gcm': 16,
  'aes-192-gcm': 24,
  'aes-256-gcm': 32,
  'none': 1,
}

/**
 * 创建加密器类 - Node.js 版本
 */
export class Crypto {
  constructor(password, algorithm) {
    this.password = password
    this.algorithm = algorithm
    // 使用 PBKDF2 与服务端保持一致
    this.key = crypto.pbkdf2Sync(password, 'salt', 10000, ALGORITHM_KEYLEN[algorithm], 'sha256')
  }

  /**
   * 生成随机 nonce
   */
  nonce() {
    return crypto.randomBytes(16)
  }

  /**
   * 加密数据
   */
  encrypt(data, nonce) {
    if (this.algorithm === 'none') {
      return data
    }

    const cipher = crypto.createCipheriv(this.algorithm, this.key, nonce)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([encrypted, tag])
  }

  /**
   * 解密数据
   */
  decrypt(data, nonce) {
    if (this.algorithm === 'none') {
      return data
    }

    try {
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, nonce)
      decipher.setAuthTag(data.slice(-16))
      const decrypted = Buffer.concat([
        decipher.update(data.slice(0, -16)),
        decipher.final()
      ])
      return decrypted
    } catch (error) {
      return null
    }
  }
}
