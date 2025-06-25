![background](https://github.com/user-attachments/assets/70a900c1-d2b8-4165-8d24-88f9cfed796f)
# Crunchyroll app for LG webOS TVs (especially webOS 3)
## This is a fork of an already existing and very complete Crunchyroll app for LG TVs. It worked, but it was very very slow and had poor performance on my webOS 3 TV (and I suppose the same for webOS 4). In an attempt to enjoy anime on my TV straight from an app, I decided to make this simplified version of his app, that can run on 3.0 just fine.

*Crunchyroll&trade; is a registered trademark of the Sony Pictures Entertainment Inc.\
This project is not affiliated with Crunchyroll, Team Crunchyroll, or the Sony Pictures Entertainment Inc.*

## About

Like I said, the point is just to enjoy anime on older TVs. I already tried this with another app, but due to DRM issues, it was too hard to implement, so I prefered using this base. (you can check the many commits)

## Disclaimer

This software is intended for personal use only. Do not use it for illegal purposes, such as downloading 
copyrighted content without permission. We do not condone or support piracy, and any misuse of this 
software is not the responsibility of the project contributors or maintainers.

## How to run on local? (Linux)
These instructions are going to be mostly the same as the original project, just using my sources instead.

1) Install git, node and npm. For this, I used node V18, just like in the Git Actions.

```bash
sudo apt install git
sudo apt install nodejs
sudo apt install npm
```

>Note: Node 18 or greater required.

2) Install enact client (version 6.1.1), aswell as LG webOS CLI:

```bash
npm install -g @enact/cli
npm install -g @webos-tools/cli
```

3) Create a new folder or go to where you want to download source code, example:

```bash
mkdir ~/webos-crunchy-test
cd ~/webos-crunchy-test
```

4) Download necessary source code from github, example:

```bash
git clone https://github.com/Lolo280374/crunchyroll-webos --recursive --single-branch --branch=stream --depth 3
git clone https://github.com/Lolo280374/crunchyroll-webos-service --single-branch --branch=master --depth 3
git clone https://github.com/Lolo280374/crunchyroll-webos-server --single-branch --branch=master --depth 3
```

5) Run npm install for each project.

```bash
cd crunchyroll-webos && npm install && cd ..
cd crunchyroll-webos-service && npm install && cd ..
cd crunchyroll-webos-server && npm install && cd ..
```

6) In one terminal run server:

```bash
cd crunchyroll-webos-server && npm run play
```

7) In other terminal run front-end:

```bash
cd ~/webos-crunchy-test/crunchyroll-webos && npm run serve
```

8) Should run in any browser disabling cors, but my setup is chromium_81.0.4044.92_1.vaapi_linux.tar
  with next command:

```bash
~/webOS_TV_SDK/chrome-linux/chrome \
  --user-data-dir=$HOME/webOS_TV_SDK/chrome-linux/tmp_chrome \
  --disable-site-isolation-trials \
  --allow-file-access-from-files \
  --disable-web-security \
  --enable-remote-extensions \
  --enable-blink-features=ShadowDOMV0,CustomElementsV0
```

9) You can load mock data editing src/const.js


## How to create local package? (Linux)

6) Follow previously 5 steps and run build-dev for development or build-p for production,
  and app will be created in ~/webos-crunchy-test/crunchyroll-webos/bin:

```bash
cd ~/webos-crunchy-test/crunchyroll-webos && npm run build-dev
```


## Help

Control back event.

```
window.dispatchEvent(new KeyboardEvent('keydown', { 'keyCode': 461 }))
```

## Create a Dash file

```bash
x264 --output intermediate.264 --fps 24 --preset slow --bitrate 2400 --vbv-maxrate 4800 --vbv-bufsize 9600 --min-keyint 48 --keyint 48 --scenecut 0 --no-scenecut --pass 1 --video-filter "resize:width=1280,height=720" inputvideo.mkv

MP4Box -add intermediate.264 -fps 24 output_2400k.mp4

MP4Box -dash 4000 -frag 4000 -rap -segment-name kimi_z_video_segment_ output_2400k.mp4

MP4Box -dash 4000 -frag 4000 -rap -segment-name kimi_z_audio_segment_ output_2400k.mp4#audio

Copy all video.mpd and only Adaptation from audio.mpd
```

## Create a m3u8 file

```bash
ffmpeg -i kimi.mp4 -threads 16 -c:v libx264 -c:a aac -b:v 1M -b:a 128k -flags +cgop -g 30 -hls_time 4 -hls_playlist_type vod -hls_segment_filename 'output_%03d.ts' -sn -f hls kimi.m3u8
```

## Extrac image from bif file

```bash
ffmpeg -i archivo.bif imagen-%04d.png
```

## Create bif file from video

```bash
ffmpeg -i video.mp4 -threads 16 -vf "fps=8/60,scale=320:179" -vsync 0 -f image2 imagen-%04d.jpg
```

## ⚖ License

This project is released under [Apache 2.0 License](LICENSE). This project is originally maintained by ediaz23. I'm just someone who wants to fork this project for the sake of adapting. If anyone needs to contact me about licensing issues on this project, please email 'crunchy-license@lolodotzip.lol'.
