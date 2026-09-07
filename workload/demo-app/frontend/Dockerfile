FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY package*.json ./

# Install dependencies 
RUN npm ci

COPY . .

# Build the frontEnd
RUN npm run build

FROM nginx:1.25-alpine AS development

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
