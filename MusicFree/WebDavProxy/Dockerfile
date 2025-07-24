# 使用 Alpine Linux 作为基础镜像，体积小
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 复制代理脚本
COPY nodejs_proxy.js .

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000

# 使用非 root 用户运行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# 启动命令
CMD ["node", "nodejs_proxy.js"]