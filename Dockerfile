FROM node:lts
LABEL org.opencontainers.image.source https://github.com/mateussouzaweb/crunchyroll-webos
LABEL maintainer="Mateus Souza <mateussouzaweb@gmail.com>"
ENV DEBIAN_FRONTEND=noninteractive

# Install system packages
RUN apt update && apt install -y make sed curl
RUN npm install -g npm

# Install compactor
RUN mkdir -p /usr/local/bin && \
    curl https://mateussouzaweb.github.io/compactor/install.sh | bash -

# Create app directory
WORKDIR /app