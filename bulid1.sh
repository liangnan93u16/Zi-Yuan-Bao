# 构建 node_modules 镜像（只在 package.json 变更时需要）：   
docker build -f Dockerfile.node_modules -t myapp-node-modules:latest .