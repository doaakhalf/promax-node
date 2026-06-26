# Step 1: Use an official Node.js runtime as the base image
FROM node:18-alpine

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Step 4: Copy the rest of your application code
COPY . .

# Step 5: Create upload directory with proper permissions
RUN mkdir -p /app/public/images && \
    chmod -R 777 /app/public/images

# Step 6: Expose the port your app runs on (Railway sets PORT env dynamically)
EXPOSE 3000

# Step 7: Define the command to run your app
CMD ["npm", "start"]