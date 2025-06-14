# Crunchyroll - WebOS TV App

**IMPORTANT NOTICE:** Crunchyroll now has a official app for WebOS TVs. We strongly recommend you to use the official app for better user experience.

*Crunchyroll&trade; is a registered trademark of the Sony Pictures Entertainment Inc. This project is not affiliated with Crunchyroll, Team Crunchyroll, or the Sony Pictures Entertainment Inc.*

## About

Unofficial WebOS TV app for Crunchyroll for those who want to try an alternative solution.

Compatible with webOS TV 4.x or more recent.

## Download and Installation

You can download and install this app in your WebOS TV following one of the guides below:

- Using [HomeBrew](https://www.webosbrew.org) TV app (recommended).
- Using [dev-manager-desktop](https://github.com/webosbrew/dev-manager-desktop) from computer.
- Downloading IPK from [latest release](https://github.com/mateussouzaweb/crunchyroll-webos/releases/latest) page and install using [WebOS SDK](https://webostv.developer.lge.com/develop/tools/cli-introduction).

## Developing with Docker

You are more than welcome to contribute to this project! To make the development process easier for everyone, we encourage you to build a container that will include all the dependencies. Here are the necessary steps:

```bash
# Clone the repository
git clone git@github.com:mateussouzaweb/crunchyroll-webos.git
cd crunchyroll-webos/

# Build the container from Dockerfile
docker build --no-cache -t crunchyroll-webos:latest .

# Run the container with user environment
docker run -it --rm \
  --network host \
  --name crunchyroll-webos \
  --user $(id -u):$(id -g) \
  --env HOME="$HOME" \
  --volume "$HOME":"$HOME" \
  --volume "$PWD":"/app" \
  crunchyroll-webos:latest bash

# Installs project dependencies
npm install

# Run develop mode
npm run develop
```

The ``develop`` command needs to keep running in the background to compile changes while you are developing. When you need to access others commands, please create additional terminals by connecting to the same container or run the command with docker:

```bash
# Connect to bash and run the command
docker exec -it crunchyroll-webos bash
npm run device-check

# Or, run the command directly
docker exec -it crunchyroll-webos npm run device-check
```

### Running on TV

To test and develop directly on the TV, you need to enable your TV for testing with developer mode. Please refer to the official LG guide to learn how to enable the developer mode: <https://webostv.developer.lge.com/develop/getting-started/developer-mode-app>. 

Once you enabled the developer mode, you can use the project commands to connect, build, launch and inspect the program on your TV:

```bash
# List devices
npm run devices

# Run setup process to connect to the TV
npm run device-setup

# Check device connection
npm run device-check

# Build from SRC
npm run build
npm run app-package

# Install app for TV
npm run app-install

# Launch or inspect
npm run app-launch
npm run app-inspect
```

Please note that the developer mode is enabled only for a few hours, so you will need to renew the developer session from time to time to keep using and developing the app.

### Running on Browser

You can also test this project in the browser, but it requires a few necessary steps. First, you need to start the browser without CORS. You also will need to access the project from the ``index.html`` file located on the ``dist/`` folder using the ``file://`` protocol, otherwise, Crunchyroll API response and video playback will be blocked by the security rules of the navigator:

```bash
# Give flatpak permissions
flatpak override com.google.Chrome --filesystem=host

# Start the browser without CORS and access the project from the dist/ folder
flatpak run com.google.Chrome \
  --user-data-dir="/tmp/chrome-dev-test" \
  --disable-web-security \
  --no-first-run \
  file://$PWD/dist/index.html
```

