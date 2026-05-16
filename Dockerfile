### Build stage
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://35.174.175.48:3001
ENV VITE_API_URL=${VITE_API_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

### Production stage: serve with nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
