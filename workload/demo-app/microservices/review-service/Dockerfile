FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Install the required dependencies
RUN npm install --omit=dev
COPY . .
EXPOSE 5005
CMD ["npm", "start"]
