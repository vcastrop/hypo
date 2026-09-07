FROM node:20-alpine AS base

# Create app directory
WORKDIR /usr/src/app

# Copy dependency definitions
COPY package*.json ./

# Install the required dependencies
RUN npm install --omit=dev

# Get all the code needed to run the app
COPY . .
RUN mkdir -p /usr/src/proto && cp /usr/src/app/catalog.proto /usr/src/proto/

# Expose REST and gRPC ports
EXPOSE 5001
EXPOSE 50051

# Serve the app
CMD ["npm", "start"]
