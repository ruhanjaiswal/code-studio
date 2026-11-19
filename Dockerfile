FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends gcc \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json server.js index.html styles.css app.js ./
EXPOSE 3000
CMD ["npm", "start"]
