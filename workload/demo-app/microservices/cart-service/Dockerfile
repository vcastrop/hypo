FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Install the required dependencies
RUN npm install
COPY . .
RUN mkdir -p /proto && cp /app/catalog.proto /proto/ && cp /app/cart.proto /proto/
EXPOSE 5003
CMD ["npm", "start"]
