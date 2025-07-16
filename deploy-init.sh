
rm -rf ../deploy
mkdir -p ../deploy


sh build.sh
docker cp $(docker create geren:latest):/app/node_modules ../deploy/node_modules
rm -rf ../deploy/dist
docker cp $(docker create geren:latest):/app/dist  ../deploy

cp -a ./theme.json ../deploy/theme.json
cp -a ./serverless.yml ../deploy/serverless.yml
cp -a ./scf_bootstrap ../deploy/scf_bootstrap
cp -a ./package.json ../deploy/package.json
cp -a ./package-lock.json ../deploy/package-lock.json
mv ../deploy/dist/* ../deploy
rm -rf ../deploy/dist

chmod 755 ../deploy/scf_bootstrap