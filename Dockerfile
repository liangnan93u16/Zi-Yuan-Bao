# 使用node18.15镜像作为基础镜像
# 第一阶段：构建阶段
FROM --platform=linux/amd64 node:18.15-slim AS builder

# 设置工作目录
WORKDIR /app

# 设置npm配置以支持较新的包
RUN npm config set legacy-peer-deps true

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖（使用legacy peer deps模式）
RUN npm install --legacy-peer-deps

# 复制所有源代码
COPY . .

# 构建项目
RUN npm run build

# 第二阶段：运行阶段
FROM --platform=linux/amd64 node:18.15-slim AS runtime

# 设置工作目录
WORKDIR /app

# 设置npm配置
RUN npm config set legacy-peer-deps true

# 只复制必要的文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY scf_bootstrap ./

# 设置scf_bootstrap文件权限
RUN chmod 777 scf_bootstrap

# 暴露端口
EXPOSE 9000

# 启动应用
CMD ["./scf_bootstrap"]