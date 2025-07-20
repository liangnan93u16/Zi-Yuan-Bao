FROM --platform=linux/amd64 node:18.15-slim AS builder

WORKDIR /app
RUN npm config set legacy-peer-deps true
COPY package*.json ./
COPY . .
COPY --from=myapp-node-modules:latest /app/node_modules ./node_modules

RUN npm run build

FROM --platform=linux/amd64 node:18.15-slim AS runtime

WORKDIR /app
RUN npm config set legacy-peer-deps true
COPY --from=myapp-node-modules:latest /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY scf_bootstrap ./
RUN chmod 777 scf_bootstrap

EXPOSE 9000
CMD ["./scf_bootstrap"] 