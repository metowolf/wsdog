# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

wsdog 是一个通过 WebSocket 实现的加密代理服务程序,使用 ESM 标准重构,基于 Hono 框架。支持部署到 Cloudflare Workers。

**架构组成**:
- **服务端 (src/worker.js)**: 基于 Hono 的 WebSocket 服务器,部署在 Cloudflare Workers,接收客户端连接并转发到目标地址
- **客户端 (src/client.js)**: SOCKS5 代理服务器,运行在本地 Node.js 环境,将本地请求通过 WebSocket 转发到服务端

## 核心架构

### 连接流程
1. 客户端启动 SOCKS5 服务器 (默认 127.0.0.1:1080)
2. 接收 SOCKS5 连接后,客户端建立 WebSocket 连接到服务端
3. 使用 AES-GCM 加密算法对传输数据进行加密
4. 服务端解密后使用 Cloudflare Workers 的 `connect()` API 连接到目标地址
5. 建立双向数据转发通道

### 状态机设计

**服务端三阶段** (src/worker.js):
- `STAGE_CONNECT (0x01)`: 接收连接请求,解析目标地址和端口,建立到目标的 TCP 连接
- `STAGE_CACHE (0x10)`: 缓存客户端数据,等待远程连接建立完成
- `STAGE_PIPE (0x11)`: 双向转发加密数据 (WebSocket ↔ TCP)

**客户端四阶段** (src/client.js):
- `STAGE_INIT (0x00)`: SOCKS5 握手,响应 `0x05 0x00` (无需认证)
- `STAGE_CONNECT (0x01)`: 解析 SOCKS5 请求,建立 WebSocket 连接,发送加密的目标地址
- `STAGE_CACHE (0x10)`: 缓存本地数据,等待 WebSocket 连接建立
- `STAGE_PIPE (0x11)`: 双向转发加密数据 (SOCKS5 ↔ WebSocket)

### 加密机制

使用两套独立的加密实现,保持协议兼容:

**服务端 (src/utils/crypto.js)**:
- 使用 Web Crypto API (Cloudflare Workers 兼容)
- PBKDF2 密钥派生: `password + "salt" + 10000 iterations + SHA-256`
- AES-GCM 加密,128-bit 认证标签

**客户端 (src/utils/crypto-node.js)**:
- 使用 Node.js crypto 模块
- 相同的 PBKDF2 参数保持兼容性
- AES-GCM 加密,认证标签附加在密文末尾 (最后 16 字节)

**会话加密流程**:
1. 客户端首次连接时生成 16 字节随机 nonce
2. 首个消息: `encrypt(addr + port, nonce) + nonce` (共享 nonce)
3. 后续消息: `encrypt(data, nonce)` (使用相同 nonce)
4. 服务端使用接收到的 nonce 解密所有后续数据

## 开发命令

### 依赖管理
```bash
pnpm install              # 安装依赖
```

### 本地开发
```bash
pnpm run dev              # 启动 Wrangler 本地开发服务器 (默认 http://127.0.0.1:8787)
pnpm run client           # 启动 SOCKS5 客户端 (需要先配置 .env)
```

### 部署
```bash
pnpm run deploy           # 部署到 Cloudflare Workers
```

### 测试
```bash
curl -Lx socks5h://127.0.0.1:1080 www.google.com
```

## 配置说明

### 服务端配置 (wrangler.toml)
```toml
[vars]
KEY = "wsdog"              # 加密密钥
METHOD = "aes-256-gcm"     # 加密算法
```

### 客户端配置 (.env)
```env
URL="ws://127.0.0.1:8787/ws"  # WebSocket 服务器地址
KEY="wsdog"                    # 加密密钥 (需与服务端一致)
METHOD="aes-256-gcm"           # 加密算法 (需与服务端一致)
TIMEOUT=600                    # 连接超时 (秒)
LOCAL_HOST=127.0.0.1          # 本地监听地址
LOCAL_PORT=1080               # SOCKS5 端口
```

**支持的加密算法**: `aes-128-gcm`, `aes-192-gcm`, `aes-256-gcm`, `none` (测试用)

## 代码规范

- 使用 ESM 模块标准 (`import`/`export`)
- 服务端仅使用 Web 标准 API (Web Crypto API, WebSocket API, Cloudflare Workers API)
- 客户端使用 Node.js 原生模块 (net, crypto, ws)
- 异步操作优先使用 `async/await`
- 状态机模式管理连接生命周期
- 控制台日志使用 `[模块名]` 前缀格式
- 所有二进制数据使用 `Uint8Array` 或 `Buffer` 处理

## Cloudflare Workers 约束

- 不支持原生 TCP socket,必须使用 `connect()` API 建立 TCP 连接
- WebSocket 连接通过 `WebSocketPair` 创建
- CPU 时间限制 (免费版 10ms,付费版 50ms)
- 内存限制 (128MB)
- 请求超时 (免费版 30s,付费版可配置)
- 不支持 Node.js 特定 API (fs, path, child_process 等)
