FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p /proto && cp /app/catalog.proto /proto/ && cp /app/cart.proto /proto/
EXPOSE 5004
CMD ["npm", "start"]
