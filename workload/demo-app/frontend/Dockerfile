FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY package*.json ./

# Install dependencies 
RUN npm ci

COPY . .

# Bake the API URL into the bundle. Ignore the checked-in production file so
# local Docker builds cannot accidentally target the AWS load balancer.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN rm -f .env.production && VITE_API_URL="$VITE_API_URL" npm run build

FROM nginx:1.25-alpine AS development

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
