# Build Angular admin dashboard
FROM node:22-alpine AS admin-build
WORKDIR /admin
COPY admin-dashboard-angular/package*.json ./
RUN npm ci
COPY admin-dashboard-angular/ ./
RUN npm run build

# API + static admin dashboard
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
COPY --from=admin-build /admin/dist ./admin-dashboard-angular/dist

RUN mkdir -p /app/public/images && \
    chmod -R 777 /app/public/images

EXPOSE 3000
CMD ["npm", "start"]
