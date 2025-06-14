![background](https://github.com/user-attachments/assets/0eb8dfad-ca8c-4132-84dd-d0fda215693f)
# Crunchyroll - LG webOS Client (for older TVs, not supporting the official app)

**VERY IMPORTANT:** This client is a "fork" of the already existing webOS client by mateussouzaweb. It serves as an objective to run on older TVs than webOS 4, fix the login and playback issues on his client, aswell as update some of the stuff that are old. This is not a "new" client.

## Roadmap
Currently, I'm mostly concerned about getting the login issues adressed. Normally, that's already fixed in the latest release. The latest patch also brought the latest artworks for the app.
Up next would be fixing the playback issue, which is not on the correct endpoint. Lastly, it would be a matter of releasing it on the HB AppStore.

## About
This is once again like I said a workaround for people with older TVs than webOS 4, so thoses that it can't run natively using the native app.
Compatible with webOS TV 3.5 or more recent.

## Download and Installation
Your only shot at installing it currently is by grabbing the latest build from GitHub actions, or a more stable one via releases. You can then install it either via SSH if you rooted your TV, or via the LG webOS Dev Manager. I won't be doing tutorials on that for today.

# This part is the same as the original project, since it's essentially the same steps. I'll make a better readme once we reach a "final" usable product stage.
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
