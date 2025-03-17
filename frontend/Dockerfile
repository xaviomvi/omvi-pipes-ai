# Stage 1: Build the application
FROM node:20.10.0-alpine AS build

ENV NODE_OPTIONS=--max-old-space-size=4096

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Vite app
RUN npm run build

# Stage 2: Serve the built app
FROM node:20.10.0-alpine

# Install the 'serve' package to serve static files
RUN npm install -g serve

# Set working directory inside the container
WORKDIR /app

# Copy only the built files from the previous stage
COPY --from=build /app/dist ./dist

# Expose port 3001 for serving the app
EXPOSE 3001

# Serve the built application
CMD ["serve", "-s", "dist"]