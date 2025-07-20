
# 清空 deploy 目录下的所有文件和目录
rm -rf ./dist
mkdir -p ../deploy

# 构建镜像
sh bulid1.sh
sh bulid2.sh

# 清理旧的 dist 和 node_modules
rm -rf ../deploy/dist ../deploy/node_modules

# 从 myapp-app:latest 镜像导出 dist 和 node_modules
container_id=$(docker create myapp-app:latest)
docker cp $container_id:/app/dist ../deploy/dist
# docker cp $container_id:/app/node_modules ../deploy/node_modules
docker rm $container_id

cp -a ./theme.json ../deploy/theme.json
cp -a ./serverless.yml ../deploy/serverless.yml
cp -a ./scf_bootstrap ../deploy/scf_bootstrap
cp -a ./package.json ../deploy/package.json
cp -a ./package-lock.json ../deploy/package-lock.json

# 清理可能存在的 public 目录，避免 mv 冲突
rm -rf ../deploy/public

# 将 dist 下内容移到 deploy 根目录
mv ../deploy/dist/* ../deploy
rm -rf ../deploy/node_modules

chmod 755 ../deploy/scf_bootstrap

rm -rf ../deploy/node_modules
rm -rf ../deploy/src.map

#  将 node_modules 和 src.map 从云文件中复制过来
# 在云上先用自动化部署获取到 node_modules 和 src.map，然后复制到 云文件 目录下
cp -a ../云文件/node_modules ../deploy/node_modules 
cp -a ../云文件/src.map ../deploy/src.map 