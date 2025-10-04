FROM node:20-alpine

WORKDIR /app

# 复制依赖配置
COPY package.json pnpm-lock.yaml* ./

# 安装 pnpm 和依赖
RUN corepack enable && \
    corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile --prod

# 复制源代码
COPY src ./src

# 设置环境变量默认值
ENV NODE_ENV=production \
    LOCAL_HOST=0.0.0.0 \
    LOCAL_PORT=1080 \
    TIMEOUT=600

# 暴露 SOCKS5 端口
EXPOSE 1080

# 启动脚本
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e

case "$1" in
  client)
    # 检查必需的环境变量
    if [ -z "$URL" ]; then
      echo "Error: URL environment variable is required for client mode"
      exit 1
    fi
    if [ -z "$KEY" ]; then
      echo "Error: KEY environment variable is required for client mode"
      exit 1
    fi

    echo "Starting wsdog client..."
    echo "Connecting to: $URL"
    echo "Local proxy: ${LOCAL_HOST}:${LOCAL_PORT}"
    exec node src/client.js
    ;;
  server)
    echo "Error: Server mode requires Cloudflare Workers deployment"
    echo "Please use 'pnpm run deploy' to deploy to Cloudflare Workers"
    exit 1
    ;;
  *)
    echo "Usage: docker run [options] wsdog [client|server]"
    echo ""
    echo "Commands:"
    echo "  client    Start SOCKS5 client (requires URL and KEY env vars)"
    echo "  server    Not supported - use Cloudflare Workers deployment"
    echo ""
    echo "Required environment variables for client mode:"
    echo "  URL       WebSocket server URL (e.g., ws://example.com/ws)"
    echo "  KEY       Encryption key (must match server)"
    echo ""
    echo "Optional environment variables:"
    echo "  METHOD    Encryption method (default: aes-256-gcm)"
    echo "  LOCAL_HOST    Local bind address (default: 0.0.0.0)"
    echo "  LOCAL_PORT    Local SOCKS5 port (default: 1080)"
    echo "  TIMEOUT   Connection timeout in seconds (default: 600)"
    echo ""
    echo "Example:"
    echo "  docker run -e URL=ws://example.com/ws -e KEY=mysecret -p 1080:1080 wsdog client"
    exit 1
    ;;
esac
EOF

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["client"]
