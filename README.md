<p align="center">
<a href="https://github.com/metowolf/wsdog">
<img src="https://user-images.githubusercontent.com/2666735/53743687-5d416100-3ed6-11e9-9fe8-5a8581c48157.png">
</a>
</p>

<p align="center">An encrypted proxy service program through websocket.</p>

<p align=center>
<a href="https://github.com/metowolf/wsdog/">Project Source</a> ·
<a href="https://t.me/wsdog">Telegram Channel</a>
</p>

---

## wsdog v2.0 - Hono + Cloudflare Workers

基于 Hono 框架重构的 wsdog,支持部署到 Cloudflare Workers。

### 主要特性

- ✅ 使用 **ESM** 标准重构全部代码
- ✅ 服务端基于 **Hono** 框架,支持部署到 **Cloudflare Workers**
- ✅ 使用 **Web Crypto API** 实现加密 (兼容 Workers 环境)
- ✅ 简化配置,使用 **wrangler.toml** 管理服务端配置
- ✅ 保持完整的加密和 SOCKS5 代理功能
- ✅ 使用 **pnpm** 作为包管理器

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 本地开发

启动服务端 (使用 Wrangler 本地开发服务器):
```bash
pnpm run dev
```

在另一个终端启动客户端:
```bash
# 创建 .env 文件
cp .env.example .env

# 编辑 .env,设置 URL 和密钥
# URL="ws://127.0.0.1:8787/ws"
# KEY="your-secret-key"

pnpm run client
```

### 3. 测试连接

```bash
curl -Lx socks5h://127.0.0.1:1080 www.google.com
```

### 4. 部署到 Cloudflare Workers

编辑 `wrangler.toml`,设置生产环境配置:
```toml
[env.production]
name = "wsdog-production"
vars = { KEY = "your-production-key", METHOD = "aes-256-gcm" }
```

部署:
```bash
pnpm run deploy
```

部署后更新客户端 `.env`:
```env
URL="wss://wsdog-production.your-account.workers.dev/ws"
KEY="your-production-key"
METHOD="aes-256-gcm"
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
TIMEOUT=600                    # 超时时间 (秒)
LOCAL_HOST=127.0.0.1          # 本地监听地址
LOCAL_PORT=1080               # SOCKS5 端口
```

### 支持的加密算法

- `aes-128-gcm`
- `aes-192-gcm`
- `aes-256-gcm`
- `none` (仅用于测试,不推荐生产环境)

## 架构说明

### 组件

- **服务端 (src/worker.js)**: 基于 Hono 的 WebSocket 服务器,部署在 Cloudflare Workers
- **客户端 (src/client.js)**: SOCKS5 代理服务器,运行在本地 Node.js 环境

### 项目结构

```
wsdog/
├── src/
│   ├── worker.js              # Cloudflare Workers 入口 (Hono 应用)
│   ├── client.js              # SOCKS5 客户端
│   └── utils/
│       ├── crypto.js          # Web Crypto API 加密 (服务端)
│       ├── crypto-node.js     # Node.js 加密 (客户端)
│       └── config.js          # 客户端配置管理
├── wrangler.toml              # Cloudflare Workers 配置
├── package.json               # 项目依赖和脚本
└── .env.example               # 客户端配置示例
```

## 优势

### Cloudflare Workers 部署

- ✅ **全球边缘网络**: 自动部署到全球数据中心
- ✅ **高可用**: 无需管理服务器
- ✅ **快速**: 边缘计算,低延迟
- ✅ **免费额度**: 每天 100,000 次请求

### 技术栈

- ✅ **Hono**: 轻量级、高性能 Web 框架
- ✅ **ESM**: 现代 JavaScript 模块标准
- ✅ **Web Crypto API**: 标准化加密接口
- ✅ **pnpm**: 快速、节省磁盘空间的包管理器

## 常见问题

### Q: 如何调试?

A: 使用 `pnpm run dev` 启动本地开发模式,支持热重载和日志输出。

### Q: 为什么客户端还是 Node.js?

A: SOCKS5 代理需要监听本地端口,这个功能 Cloudflare Workers 不支持,必须在本地运行。

### Q: v1.0 和 v2.0 能否互通?

A: 不能。v2.0 使用 PBKDF2 密钥派生,与 v1.0 的实现不兼容。

## 许可证

MIT License
