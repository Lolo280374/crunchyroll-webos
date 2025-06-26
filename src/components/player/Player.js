
import 'dashjs-webos5/legacy'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import VideoPlayer, { MediaControls } from '@enact/moonstone/VideoPlayer'
import Button from '@enact/moonstone/Button'
import IconButton from '@enact/moonstone/IconButton'
import Spotlight from '@enact/spotlight'
import { useRecoilValue, useRecoilState } from 'recoil'
import { CrunchyrollError } from 'crunchyroll-js-api'

import AudioSelect from './AudioSelect'
import SubtitleSelect from './SubtitleSelect'
import Rating from './Rating'
import ContentInfo from './ContentInfo'
import ContactMe from '../login/ContactMe'
import PopupMessage from '../Popup'
import { currentProfileState, playContentState } from '../../recoilConfig'
import { useGetLanguage } from '../../hooks/language'
import * as fetchUtils from '../../hooks/customFetch'
import { $L } from '../../hooks/language'
import logger from '../../logger'
import api from '../../api'
import { getContentParam } from '../../api/utils'
import emptyVideo from '../../../assets/empty.mp4'
import back from '../../back'
import { _PLAY_TEST_, _LOCALHOST_SERVER_ } from '../../const'
import XHRLoader from '../../patch/XHRLoader'
import utils from '../../utils'
import MemoryManager from '../../utils/memoryManager'
import NetworkManager from '../../utils/networkManager';
import optimizeVideoElement from '../../utils/videoElementOptimizer';
import DOMFreezer from '../../utils/domFreezer';
import { configurePlayer, cleanupPlayer } from '../../utils/playerConfig';
import QualityDebug from './QualityDebug';

/**
 * @typedef StreamSession
 * @type {Object}
 * @property {Number} renewSeconds
 * @property {Number} noNetworkRetryIntervalSeconds
 * @property {Number} noNetworkTimeoutSeconds
 * @property {Number} maximumPauseSeconds
 * @property {Number} endOfVideoUnloadSeconds
 * @property {Number} sessionExpirationSeconds
 * @property {Boolean} usesStreamLimits
 */

/**
 * @typedef Stream
 * @type {Object}
 * @property {String} id
 * @property {Array<{url: String, locale: String}>} urls
 * @property {String} bif
 * @property {String} token
 * @property {StreamSession} session
 * @property {Array<import('./AudioList').Audio>} audios
 * @property {Array<import('./SubtitleList').Subtitle>} subtitles
 * @property {import('crunchyroll-js-api').Types.Profile} profile
 * @property {String} skipUrl
 */

/**
 * @typedef SkiptEvent
 * @type {Object}
 * @property {String} approverId
 * @property {String} distributionNumber
 * @property {Number} end
 * @property {String} seriesId
 * @property {Number} start
 * @property {String} title
 * @property {String} type
 * @property {Function} process
 */

/**
 * @typedef LangConfig
 * @type {Object}
 * @property {String} audio
 * @property {String} subtitle
 */

/** @type {{dashjs: import('dashjs-webos5')}*/
const { dashjs } = window
/** @type {{webOS: import('webostvjs').WebOS}} */
const { webOS } = window

/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile
 * @param {Object} obj.content
 * @param {{current: import('@enact/moonstone/VideoPlayer/VideoPlayer').VideoPlayerBase}} obj.playerCompRef
 * @returns {Promise}
 */
const updatePlayHead = async ({ profile, content, playerCompRef }) => {
    if (['episode', 'movie'].includes(content.type)) {
        /** @type {{paused: boolean, currentTime: number}} */
        const state = playerCompRef.current.getMediaState()
        content.playhead.playhead = Math.floor(state.currentTime)
        return api.content.savePlayhead(profile, {
            contentId: content.id,
            playhead: Math.floor(state.currentTime),
        })
    }
}

/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile
 * @param {Object} obj.content
 * @param {{current: import('@enact/moonstone/VideoPlayer/VideoPlayer').VideoPlayerBase}} obj.playerCompRef
 * @returns {Function}
 */
const updatePlayHeadLoop = ({ profile, content, playerCompRef }) => {
    const interval = setInterval(() => {
        if (playerCompRef.current) {
            /** @type {{paused: boolean, currentTime: number}} */
            const state = playerCompRef.current.getMediaState()
            if (!state.paused) {
                updatePlayHead({ profile, content, playerCompRef }).catch(logger.error)
            }
        }
    }, 1000 * 15) // every 15 sec
    return () => clearInterval(interval)
}

/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile
 * @param {Object} obj.content
 * @returns {Promise<{playhead: Number, fully_watched: Boolean}>}
 */
const findPlayHead = async ({ profile, content }) => {
    let playhead = {
        playhead: 0,
        fully_watched: false,
    }
    if (['episode', 'movie'].includes(content.type)) {
        const { data } = await api.content.getPlayHeads(profile, { contentIds: [content.id] })
        if (data && data.length > 0) {
            playhead = data[0]
        }
    }
    return playhead
}

/**
 * @param {Object} obj
 * @param {Object} obj.content
 * @param {Function} obj.getLang
 * @returns {Array<import('./AudioList').Audio>}
 */
const searchAudios = ({ content, getLang }) => {
    /** @type {Array<import('./AudioList').Audio} */
    let audios = []
    if (content.versions) {
        audios = content.versions.map(audio => {
            return {
                ...audio,
                title: getLang(audio.audio_locale),
                type: content.type
            }
        })
    } else {
        audios = [{
            title: content.subTitle || content.title,
            type: content.type,
            media_guid: content.id,
            guid: content.id,
            audio_locale: 'none',
        }]
    }
    return audios
}


/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile keep this for consistency
 * @param {LangConfig} obj.langConfig
 * @param {Array<import('./AudioList').Audio>} obj.audios
 * @returns {Promise<import('./AudioList').Audio>}
 */
const findAudio = async ({ langConfig, audios }) => {
    let audio = audios.find(e => e.audio_locale === langConfig.audio)
    if (!audio) {
        audio = audios.find(e => e.audio_locale === 'ja-JP')
        if (!audio) {
            audio = audios[0]
        }
    }
    return audio
}

/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile
 * @param {LangConfig} obj.langConfig
 * @param {Array<import('./SubtitleList').Subtitle>} obj.subtitles
 * @returns {Promise<import('./SubtitleList').Subtitle>}
 */
const findSubtitle = async ({ langConfig, subtitles }) => {
    let sub = subtitles.find(e => e.locale === langConfig.subtitle)
    if (!sub) {
        sub = subtitles[0]
    }
    return sub
}

/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile
 * @param {LangConfig} obj.langConfig
 * @param {Array<import('./AudioList').Audio>} obj.audios
 * @param {import('./AudioList').Audio} obj.audio
 * @param {Function} obj.getLang
 * @param {Object} obj.content
 * @returns {Promise<Stream>}
 */
const findStream = async ({ profile, langConfig, audios, audio, getLang, content }) => {
    /** @type {Stream} */
    let out = null, data = {}, urls = []
    if (_PLAY_TEST_) {  // test stream
        content.playhead = { playhead: 12 }
        out = {
            id: content.id,
            urls: [{ url: `${_LOCALHOST_SERVER_}/frieren-26.mpd`, locale: 'es-419' }],
            bif: `${_LOCALHOST_SERVER_}/frieren-26.bif`,
            audios: [],
            subtitles: [{
                locale: 'es-419',
                url: `${_LOCALHOST_SERVER_}/frieren-26.ass`
            }],
            profile,
            langConfig,
            skipUrl: `${_LOCALHOST_SERVER_}/frieren-26.json`

        }
    } else {
        if (['episode', 'movie'].includes(audio.type)) {
            data = await api.drm.getStreams(profile, { episodeId: audio.guid })
        } else if (['musicConcert', 'musicVideo'].includes(audio.type)) {
            data = await api.drm.getStreams(profile, { episodeId: audio.guid, type: 'music' })
        }
        if (data.hardSubs) {
            urls = Object.keys(data.hardSubs).map(locale => {
                return { locale, url: data.hardSubs[locale].url }
            })
        }
        content.playhead = await findPlayHead({ profile, content })
        out = {
            id: content.id,
            urls: [{ locale: 'off', url: data.url }, ...urls],
            bif: data.bifs,
            audios: audios,
            subtitles: [{ language: 'off', }, ...Object.values(data.subtitles)].map(subtitle => {
                return { ...subtitle, locale: subtitle.language, title: getLang(subtitle.language) }
            }),
            profile,
            langConfig,
            skipUrl: `https://static.crunchyroll.com/skip-events/production/${audio.guid}.json`,
            session: data.session,
            token: data.token,
        }
    }
    return out
}

/**
 * Download file per chunkSize
 * @param {String} url
 * @param {Number} chunkSize
 * @returns {Promise<{bifData: Uint8Array, requests: Array<Promise>}>}
 */
const downloadBifFile = async (url, chunkSize = 256 * 1024) => {
    const headResponse = await fetchUtils.customFetch(url, { method: 'HEAD' })
    /** @type {Uint8Array} */
    let bifData = null
    /** @type {Array<Promise>} */
    const requests = []
    if (headResponse.ok) {
        const totalSize = parseInt(headResponse.headers.get('Content-Length'))
        if (isNaN(totalSize) || !totalSize) {
            throw new Error('Bif size not working')
        }
        bifData = new Uint8Array(totalSize)
        for (let start = 0; start < totalSize; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, totalSize - 1)
            const reqConfig = { headers: { Range: `bytes=${start}-${end}` } }
            requests.push(fetchUtils.customFetch(url, reqConfig, true))
            requests[requests.length - 1].then(chunkArray => bifData.set(chunkArray, start))
        }
    }

    return { bifData, requests }
}

/**
 * Conditionally loads preview thumbnails based on device capability
 * @param {{ bif: String }} obj
 * @returns {Promise<{chunks: Array<{start: int, end: int, url: string}>}>}
 */
const findPreviews = async ({ bif }) => {
    // Check if we're running on WebOS 3.5 or lower
    const isLegacyWebOS = utils.isTv() && 
        window.webOS && 
        window.webOS.device && 
        (parseFloat(window.webOS.device.platformVersion) <= 4);
    
    // Skip thumbnail generation completely for WebOS 3.5
    if (isLegacyWebOS) {
        return { chunks: [] };
    }
    
    // Original code for other devices
    const headResponse = await fetchUtils.customFetch(bif, { method: 'HEAD' })
    /** @type {Array<{start: int, end: int, url: string}>} */
    const chunks = []
    if (headResponse.ok) {
        const totalSize = parseInt(headResponse.headers.get('Content-Length'))
        if (isNaN(totalSize) || !totalSize) {
            return { chunks }
        }

        const { bifData, requests } = await downloadBifFile(bif)
        await Promise.all(requests)

        const dv = new DataView(bifData.buffer)
        let magic = ''
        for (let i = 0; i < 4; i++) {
            magic += String.fromCharCode(dv.getUint8(i))
        }
        // eslint-disable-next-line
        if (magic === 'BIF1') {
            const version = dv.getUint32(4, true)
            const imageCount = dv.getUint32(8, true)
            const timestampMult = dv.getUint32(12, true) || 1000

            const bifOffsetLoc = version === 0 ? 64 : 20
            for (let i = 0; i < imageCount; i++) {
                const timestampOffset = bifOffsetLoc + 8 * i
                const imageOffset = timestampOffset + 4

                const timestamp = dv.getUint32(timestampOffset, true)
                const offset = dv.getUint32(imageOffset, true)

                let end = totalSize
                if (i < imageCount - 1) {
                    end = dv.getUint32(imageOffset + 8, true)
                }

                const blob = new Blob([bifData.slice(offset, end)])
                chunks.push({
                    start: timestamp / timestampMult,
                    end: end,
                    url: window.URL.createObjectURL(blob),
                })
            }
        }
    }

    return { chunks }
}

/**
 * @param {{ content: Object }}
 * @returns {String}
 */
const findPoster = ({ content }) => {
    let posterOut = null
    if (content && content.images && content.images.thumbnail) {
        /** @type {Array<{source: String}>} */
        const thumbnail = content.images.thumbnail[0]
        if (thumbnail && thumbnail.length) {
            posterOut = thumbnail[thumbnail.length - 1].source
        }
    }
    return posterOut
}

/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile
 * @param {Object} obj.content
 * @param {Number} obj.step
 * @param {Array<String>} obj.videos
 * @param {Function} obj.apiFunction
 * @returns {Promise<Object>}
 */
const getNextVideoOrConcert = async ({ profile, content, step, videos, apiFunction }) => {
    let out = null
    const index = videos.findIndex(val => val === content.id)
    const nextIndex = index + step
    if (index >= 0 && nextIndex >= 0 && nextIndex < videos.length) {
        const { data: newConcerts } = await apiFunction(profile, [videos[nextIndex]])
        if (newConcerts.length > 0) {
            out = newConcerts[0]
        }
    }
    return out
}

/**
 * @param {Object} obj
 * @param {import('crunchyroll-js-api').Types.Profile} obj.profile
 * @param {Object} obj.content
 * @param {Number} obj.step
 * @returns {Promise<{total: Number, data: Array<Object>}>}
 */
const findNextEp = async ({ profile, content, step }) => {
    let out = null
    if (['episode'].includes(content.type)) {
        if (step > 0) {
            out = await api.discover.getNext(profile, { contentId: content.id })
        } else {
            out = await api.discover.getPrev(profile, { contentId: content.id })
        }
    } else if (['movie'].includes(content.type)) {
        const movies = await api.cms.getMovies(profile, { movieListingId: content.listing_id })
        const movieIndex = movies.data.findIndex(item => item.id === content.id)
        const nextIndex = movieIndex + step
        if (0 <= nextIndex && nextIndex < movies.total) {
            out = { total: 1, data: [movies.data[nextIndex]] }
        }
    } else if (['musicConcert', 'musicVideo'].includes(content.type)) {
        /** @type {{videos: Array<Object>}} */
        const { videos } = content
        if (videos) {
            const videoIndex = videos.findIndex(item => item.id === content.id)
            const nextIndex = videoIndex + step
            if (0 <= nextIndex && nextIndex < videos.length) {
                out = { total: 1, data: [{ ...videos[nextIndex] }] }
            }
        } else {
            const { data: artists } = await api.music.getArtists(profile, [content.artist.id])
            if (artists.length > 0) {
                const params = { profile, content, step }
                if ('musicConcert' === content.type) {
                    out = await getNextVideoOrConcert({
                        ...params,
                        videos: artists[0].concerts,
                        apiFunction: api.music.getConcerts
                    })
                } else if ('musicVideo' === content.type) {
                    out = await getNextVideoOrConcert({
                        ...params,
                        videos: artists[0].videos,
                        apiFunction: api.music.getVideos
                    })
                }
                if (out) {
                    out = { total: 1, data: [out] }
                }
            }
        }
    }
    if (out && out.total > 0) {
        out.data[0].type = content.type
        if (['episode', 'movie'].includes(content.type)) {
            await api.content.savePlayhead(profile, { contentId: out.data[0].id, playhead: 0 })
        }
    }
    return out
}

/**
 * @param {import('dashjs-webos5').LicenseResponse} res
 * @return {}
 */
const decodeLicense = (res) => {
    if (res.url.endsWith('widevine')) {
        const uint8Array = new Uint8Array(res.data)
        const textDecoder = new TextDecoder('utf-8')
        const jsonString = textDecoder.decode(uint8Array)
        const jsonObject = JSON.parse(jsonString)
        const binaryString = atob(jsonObject.license)
        const newUint8Array = Uint8Array.from(binaryString, char => char.charCodeAt(0))
        res.data = newUint8Array.buffer
    }
}

/**
 * @fixme future cors error
 * @param {import('crunchyroll-js-api').Types.Profile} profile
 * @return {Function}
 */
const requestDashLicense = (profile) => {
    /** @param {import('dashjs-webos5').LicenseRequest} req */
    return async (req) => {
        /** @type {import('crunchyroll-js-api').Types.AccountAuth} */
        const account = await getContentParam(profile)
        req.headers = req.headers || {};
        if (req.url.endsWith('widevine')) {
            req.headers['Content-Type'] = 'application/octet-stream'
        } else if (req.url.endsWith('playReady')) {
            req.headers['Content-Type'] = 'text/xml'
        }
        req.headers['Authorization'] = account.token
    }
}

/**
 * @param {import('crunchyroll-js-api').Types.Profile} profile
 * @return {Function}
 */
const modifierDashRequest = (profile) => {
    return async (req) => {
        /** @type {import('crunchyroll-js-api').Types.AccountAuth} */
        const account = await getContentParam(profile)
        /** @type {Request} */
        const request = req
        request.headers = { ...req.headers }
        request.headers['Authorization'] = account.token
        return req
    }
}

/**
 * @param {import('dashjs-webos5').MediaPlayerClass} dashPlayer
 */
const setStreamingConfig = async (dashPlayer) => {
    let bufferTimeAtTopQuality = 150
    let bufferTimeAtTopQualityLongForm = 300
    let initialBufferLevel = 16
    let bufferToKeep = 12
    let bufferPruningInterval = 8

    if (utils.isTv()) {
        const parseRamSizeInGB = (ddrSizeString) => {
            const match = ddrSizeString.match(/([\d.]+)G/i);
            return match ? parseFloat(match[1]) : 0;
        }

        /** @type {import('webostvjs').DeviceInfo}*/
        const deviceInfo = await new Promise(res => webOS.deviceInfo(res))
        const ramInGB = parseRamSizeInGB(deviceInfo.ddrSize || '1G')
        const is4K = deviceInfo.screenWidth >= 3840 && deviceInfo.screenHeight >= 2160
        const hasHDR = !!(deviceInfo.hdr10 || deviceInfo.dolbyVision)
        const platformVersion = parseFloat(deviceInfo.platformVersion || '0')
        
        // WebOS 3.5 or lower requires more conservative settings
        const isLegacyWebOS = platformVersion <= 4;

        if (isLegacyWebOS) {
            // Much more conservative settings for WebOS 3.5
            bufferTimeAtTopQuality = 60
            bufferTimeAtTopQualityLongForm = 120
            initialBufferLevel = 8
            bufferToKeep = 6
            bufferPruningInterval = 4
        } else {
            // Regular score-based settings for newer WebOS
            const score = (ramInGB * 2) + (is4K ? 1 : 0) + (hasHDR ? 1 : 0)

            if (score >= 6) {
                // Gama alta
                bufferTimeAtTopQuality = 180
                bufferTimeAtTopQualityLongForm = 320
                initialBufferLevel = 24
            } else if (score >= 5) {
                // Gama media-alta (como tu WebOS 5)
                bufferTimeAtTopQuality = 144
                bufferTimeAtTopQualityLongForm = 280
                initialBufferLevel = 20
            } else if (score >= 3.5) {
                // Gama media
                bufferTimeAtTopQuality = 128
                bufferTimeAtTopQualityLongForm = 240
                initialBufferLevel = 18
            } else {
                // Gama baja
                bufferTimeAtTopQuality = 96
                bufferTimeAtTopQualityLongForm = 180
                initialBufferLevel = 14
            }
        }
    }

    // Update the settings with our values
    dashPlayer.updateSettings({
        streaming: {
            buffer: {
                bufferTimeDefault: 20,
                bufferTimeAtTopQuality,
                bufferTimeAtTopQualityLongForm,
                longFormContentDurationThreshold: 600,
                fastSwitchEnabled: true,
                bufferToKeep,
                bufferPruningInterval,
                initialBufferLevel,
            },
            abr: {
                autoSwitchBitrate: {
                    audio: true,
                    video: true
                },
                initialBitrate: { 
                    audio: -1, 
                    video: -1 
                },
                limitBitrateByPortal: true
            },
        }
    })
}

/**
 * @param {import('./AudioList').Audio} audio
 * @param {Stream} stream
 * @param {Object} content
 * @param {import('./SubtitleList').Subtitle} subtitle
 * @returns {Promise<import('dashjs-webos5').MediaPlayerClass>}
 */
const createDashPlayer = async (audio, stream, content, subtitle) => {
    let url = null
    const startSec = Math.min(content.playhead.playhead, (content.duration_ms / 1000) - 30)
    /** @type {import('dashjs-webos5').MediaPlayerClass}*/
    const dashPlayer = dashjs.MediaPlayer().create()

    dashPlayer.extend('XHRLoader', XHRLoader)
    dashPlayer.addRequestInterceptor(modifierDashRequest(stream.profile))
    
    // Replace setStreamingConfig with our new configurePlayer
    await configurePlayer(dashPlayer)
    
    url = stream.urls.find(val => val.locale === subtitle.locale)
    if (!url) {
        url = stream.urls.find(val => val.locale === 'off')
    }
    if (url) {
        url = url.url
    }
    dashPlayer.initialize()
    dashPlayer.setAutoPlay(false)
    dashPlayer.attachSource(url + '#t=' + Math.max(startSec, 0))
    dashPlayer.attachView(document.querySelector('video'))
    if (!_PLAY_TEST_) {
        const drmConfig = {
            'com.widevine.alpha': {
                priority: 1,
                serverURL: 'https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/widevine',
                httpRequestHeaders: {
                    'X-Cr-Content-Id': audio.guid,
                    'X-Cr-Video-Token': stream.token,
                },
                serverCertificate: api.config.SERVER_CERTIFICATE,
                audioRobustness: 'SW_SECURE_CRYPTO',
                videoRobustness: 'SW_SECURE_CRYPTO',
                sessionType: 'temporary',
            },
            'com.microsoft.playready': {
                priority: 2,
                serverURL: 'https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/playReady',
                httpRequestHeaders: {
                    SOAPAction: '"http://schemas.microsoft.com/DRM/2007/03/protocols/AcquireLicense"',
                    'X-Cr-Content-Id': audio.guid,
                    'X-Cr-Video-Token': stream.token,
                },
                serverCertificate: api.config.SERVER_CERTIFICATE,
                audioRobustness: 'SW_SECURE_CRYPTO',
                videoRobustness: 'SW_SECURE_CRYPTO',
                sessionType: 'temporary',
            },
            'com.apple.fairplay': {
                priority: 3,
                certificateURL: 'https://lic.drmtoday.com/license-server-fairplay/cert/',
                licenseURL: 'https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/fairPlay',
                audioRobustness: 'SW_SECURE_CRYPTO',
                videoRobustness: 'SW_SECURE_CRYPTO',
                sessionType: 'temporary',
            },
        }
        dashPlayer.setProtectionData(drmConfig)
        dashPlayer.registerLicenseRequestFilter(requestDashLicense(stream.profile))
        dashPlayer.registerLicenseResponseFilter(decodeLicense)
    }
    return dashPlayer
}

/**
 * Compute title for playing content
 * @param {Object} content
 * @returns {String}
 */
const computeTitle = (content) => {
    /** @type {Array<String>} */
    const title = []
    if (content) {
        title.push(content.title)
        if (content.type === 'episode') {
            let epNumber = null
            if (content.episode_metadata) {
                epNumber = content.episode_metadata.episode_number
            } else {
                epNumber = content.episode_number
            }
            if (epNumber) {
                title.push('-')
                title.push(epNumber)
            }
        }
        if (content.subTitle) {
            title.push('-')
            title.push(content.subTitle)
        }
    }
    return title.filter(e => e).join(' ')
}

/**
 * @param {Stream} stream
 * @returns {Promise<{intro: SkiptEvent, credits: SkiptEvent, preview: SkiptEvent, recap: SkiptEvent}>}
 */
const findSkipEvents = async (stream) => {
    /** @type {{intro: SkiptEvent, credits: SkiptEvent, preview: SkiptEvent, recap: SkiptEvent}} */
    let out = null
    try {
        const res = await fetchUtils.customFetch(stream.skipUrl)
        if (200 <= res.status && res.status < 300) {
            out = await res.json()
            if (out.recap) {
                out.recap.title = $L('Skip Recap')
            }
            if (out.intro) {
                out.intro.title = $L('Skip Intro')
            }
            if (out.credits) {
                out.credits.title = $L('Skip Credits')
            }
            if (out.preview) {
                out.preview.title = $L('Skip Preview')
            }
        }
    } catch (e) {
        logger.error(e)
    }
    return out
}

/**
 * @todo @fixme bug after playing video music "comet" of yoasobi
 */
const Player = ({ ...rest }) => {
    /** @type {[Boolean, Function]} */
    const [loading, setLoading] = useState(true)
    /** @type {Function} */
    const getLang = useGetLanguage()
    /** @type {import('crunchyroll-js-api').Types.Profile}*/
    const profile = useRecoilValue(currentProfileState)
    /** @type {[Object, Function]} */
    const [playContent, setPlayContent] = useRecoilState(playContentState)
    /** @type {Object} */
    const content = useMemo(() => {
        return Object.assign({}, playContent, playContent.episode_metadata || {})
    }, [playContent])
    /** @type {Array<import('./AudioList').Audio} */
    const audios = useMemo(() => {
        return searchAudios({ content, getLang })
    }, [content, getLang])
    const poster = useMemo(() => findPoster({ content }), [content])
    /** @type {{current: LangConfig}}*/
    const langConfigRef = useRef({
        audio: profile.preferred_content_audio_language,
        subtitle: profile.preferred_content_subtitle_language,
    })
    /** @type {[import('./AudioList').Audio, Function]} */
    const [audio, setAudio] = useState({})
    /** @type {[import('./SubtitleList').Subtitle, Function]} */
    const [subtitle, setSubtitle] = useState(null)
    /** @type {[{chunks: Array<{start: int, end: int, url: String}>}, Function]} */
    const [previews, setPreviews] = useState({ chunks: [] })
    /** @type {[String, Function]} */
    const [preview, setPreview] = useState(null)
    /** @type {[Event, Function]} */
    const [endEvent, setEndEvent] = useState(null)
    /** @type {{current: import('@enact/moonstone/VideoPlayer/VideoPlayer').VideoPlayerBase}} */
    const playerCompRef = useRef(null)
    /** @type {{current: import('dashjs-webos5').MediaPlayerClass}} */
    const playerRef = useRef(null)
    /** @type {Stream} */
    const emptyStream = useMemo(() => {
        return {
            id: null, urls: null, bif: null, token: null, session: null, audios: [],
            subtitles: [], profile: null, skipUrl: null,
        }
    }, [])
    /** @type {String} */
    const title = useMemo(() => computeTitle(content), [content])
    /** @type {[Stream, Function]} */
    const [stream, setStream] = useState(emptyStream)
    /** @type {[StreamSession, Function]} */
    const [session, setSession] = useState(null)
    /** @type {[Boolean, Function]} */
    const [isPaused, setIsPaused] = useState(null)
    /** @type {[Number, Function]} */
    const [jumpBy, setJumpBy] = useState(5)
    /** @type {[{intro: SkiptEvent, credits: SkiptEvent, preview: SkiptEvent, recap: SkiptEvent}, Function]} */
    const [skipEvents, setSkipEvents] = useState(null)
    /** @type {[SkiptEvent, Function]} */
    const [currentSkipEvent, setCurrentSkipEvent] = useState(null)
    /** @type {[String, Function]}  */
    const [message, setMessage] = useState('')

    // Add memory management hook here
    useEffect(() => {
        // Activate memory saving mode when player mounts - frees UI memory
        if (MemoryManager.instance) {
            logger.info("Player: Activating media mode to free memory");
            MemoryManager.instance.activateMediaMode();
        } else {
            logger.warn("Player: MemoryManager instance not found");
        }
        
        return () => {
            // Restore regular memory management when player unmounts
            if (MemoryManager.instance) {
                logger.info("Player: Deactivating media mode");
                MemoryManager.instance.deactivateMediaMode();
            }
        };
    }, []);

// In your Player component, add this useEffect for WebOS 3.5

useEffect(() => {
  // Check if we're on WebOS 3.5
  const isLegacyWebOS = utils.isTv() && 
    window.webOS && 
    window.webOS.device && 
    (parseFloat(window.webOS.device.platformVersion) <= 4);
    
  if (isLegacyWebOS) {
    // Make video controls simpler for WebOS 3.5
    document.body.classList.add('webos35-mode');
    
    // 1. Disable thumbnails completely for WebOS 3.5
    setPreviews({ chunks: [] });
    
    // 2. Simplify video controls - hide unnecessary buttons when not focused
    const simplifyControls = () => {
      const controls = document.querySelectorAll('.moon-VideoPlayer_controlsFrame');
      controls.forEach(control => {
        control.classList.add('simplified-controls');
      });
    };
    
    // Apply simplifications after component is mounted
    setTimeout(simplifyControls, 1000);
    
    // 3. Disable complex animations in the player
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .webos35-mode .moon-VideoPlayer_controlsFrame {
        transition: opacity 0.2s linear !important;
      }
      .webos35-mode .moon-Slider_fill,
      .webos35-mode .moon-Slider_knob {
        transition: all 0.1s linear !important;
      }
      .webos35-mode .simplified-controls:not(:focus-within) .rightComponents,
      .webos35-mode .simplified-controls:not(:focus-within) .leftComponents {
        opacity: 0.5;
        transform: scale(0.9);
      }
    `;
    document.head.appendChild(styleElement);
    
    // 4. Monitor video performance and reduce quality if needed
    let frameDropMonitor = null;
    if (playerRef.current) {
      let lastDroppedFrames = 0;
      let highDropRateCount = 0;
      
      frameDropMonitor = setInterval(() => {
        try {
          const metrics = playerRef.current.getMetricsFor('video');
          const droppedFrames = playerRef.current.getDroppedFrames();
          
          if (droppedFrames && lastDroppedFrames) {
            const newDroppedFrames = droppedFrames.droppedFrames - lastDroppedFrames;
            const dropRate = newDroppedFrames / 30; // Assuming 30fps target
            
            if (dropRate > 0.1) { // More than 10% frames dropped
              highDropRateCount++;
              
              if (highDropRateCount >= 3) {
                // Consistent frame drops - reduce quality even more
                playerRef.current.updateSettings({
                  streaming: {
                    abr: {
                      maxHeight: 360,
                      maxBitrate: {
                        video: 500000 // 500 Kbps
                      }
                    }
                  }
                });
                console.log("Reducing quality due to dropped frames");
              }
            } else {
              highDropRateCount = Math.max(0, highDropRateCount - 1);
            }
            
            lastDroppedFrames = droppedFrames.droppedFrames;
          } else if (droppedFrames) {
            lastDroppedFrames = droppedFrames.droppedFrames;
          }
        } catch (e) {
          console.error("Error monitoring frame drops", e);
        }
      }, 5000);
    }
    
    return () => {
      document.body.classList.remove('webos35-mode');
      if (frameDropMonitor) clearInterval(frameDropMonitor);
      if (styleElement) styleElement.remove();
    };
  }
}, [playerRef]);

// Add this useEffect to implement extreme downscaling
// Insert it after your existing WebOS 3.5 detection effect
useEffect(() => {
  // Reference to the cleanup function
  let cleanupOptimization = null;
  
  // Check if we're on WebOS 3.5
  const isLegacyWebOS = utils.isTv() && 
    window.webOS && 
    window.webOS.device && 
    (parseFloat(window.webOS.device.platformVersion) <= 4);
    
  if (isLegacyWebOS) {
    // Apply immediate optimizations to document
    document.body.classList.add('webos35-extreme-mode');
    
    // Wait a bit for the video element to be available
    const applyVideoOptimizations = () => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        // Extreme downscaling - render at 30% quality and scale up
        videoElement.style.width = '30%';
        videoElement.style.height = '30%';
        videoElement.style.transformOrigin = 'top left';
        videoElement.style.transform = 'scale(3.33)';
        videoElement.style.backfaceVisibility = 'hidden';
        videoElement.style.filter = 'blur(1px)'; // Further reduce quality
        
        // Apply optimization to parent container
        const playerElement = videoElement.closest('.moon-VideoPlayer');
        if (playerElement) {
          playerElement.style.willChange = 'auto';
          playerElement.style.webkitTransform = 'translateZ(0)';
        }
        
        // Apply extra CSS rules
        const styleEl = document.createElement('style');
        styleEl.id = 'extreme-video-optimization';
        styleEl.textContent = `
          video {
            will-change: transform;
            image-rendering: optimizeSpeed !important;
            image-rendering: pixelated !important;
          }
        `;
        document.head.appendChild(styleEl);
        
        // Store cleanup function
        cleanupOptimization = () => {
          if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        };
      } else {
        // Try again if video not found
        setTimeout(applyVideoOptimizations, 100);
      }
    };
    
    // Start applying optimizations
    applyVideoOptimizations();
  }
  
  return () => {
    // Clean up
    if (cleanupOptimization) cleanupOptimization();
    document.body.classList.remove('webos35-extreme-mode');
  };
}, []);

// Add this useEffect right after your other useEffects
useEffect(() => {
  if (playerRef.current && !loading) {
    // Create a debugging element to show current quality
    const debugDiv = document.createElement('div');
    debugDiv.id = 'quality-debug';
    debugDiv.style.position = 'absolute';
    debugDiv.style.top = '10px';
    debugDiv.style.left = '10px';
    debugDiv.style.color = 'white';
    debugDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
    debugDiv.style.padding = '5px';
    debugDiv.style.zIndex = '9999';
    document.body.appendChild(debugDiv);
    
    // Update quality info every 5 seconds
    const qualityInterval = setInterval(() => {
      try {
        const player = playerRef.current;
        const videoQualities = player.getBitrateInfoListFor('video');
        const currentQuality = player.getQualityFor('video');
        const currentInfo = videoQualities[currentQuality];
        
        debugDiv.textContent = `Resolution: ${currentInfo.height}p @ ${Math.round(currentInfo.bitrate/1000)}kbps`;
      } catch (e) {
        debugDiv.textContent = 'Error reading quality';
      }
    }, 5000);
    
    return () => {
      if (debugDiv && debugDiv.parentNode) {
        debugDiv.parentNode.removeChild(debugDiv);
      }
      clearInterval(qualityInterval);
    };
  }
}, [playerRef, loading]);

useEffect(() => {
  // Engage extreme performance mode for playback
  const networkManager = NetworkManager.getInstance();
  const domFreezer = DOMFreezer.getInstance();
  
  // Block non-essential network requests
  networkManager.enablePlaybackMode();
  
  // Freeze non-essential DOM updates
  domFreezer.freeze();
  
  // Optimize video element when it's available
  const videoElement = document.querySelector('video');
  if (videoElement) {
    optimizeVideoElement(videoElement);
  }
  
  // Apply WebOS system optimizations if available
  if (window.webOS && window.webOS.systemService) {
    // Request foreground priority
    window.webOS.systemService.request("luna://com.webos.service.tvpower", {
      method: "setMediaState",
      parameters: { "state": "media" }
    });
    
    // Request CPU priority
    window.webOS.systemService.request("luna://com.webos.service.resourcemanager", {
      method: "requestResourceLock",
      parameters: { 
        "requestType": "resource", 
        "resourceType": "CPU",
        "priority": "high"
      }
    });
  }
  
  return () => {
    // Release resources when component unmounts
    networkManager.disablePlaybackMode();
    domFreezer.unfreeze();
    
    // Release WebOS system priorities
    if (window.webOS && window.webOS.systemService) {
      window.webOS.systemService.request("luna://com.webos.service.tvpower", {
        method: "setMediaState",
        parameters: { "state": "none" }
      });
      
      window.webOS.systemService.request("luna://com.webos.service.resourcemanager", {
        method: "releaseResourceLock",
        parameters: { 
          "resourceType": "CPU" 
        }
      });
    }
  };
}, []);

    /** @type {Function} */
    const selectAudio = useCallback((select) => {
        setAudio(audios[select])
        langConfigRef.current.audio = audios[select].audio_locale
    }, [setAudio, audios])

    /** @type {Function} */
    const selectSubtitle = useCallback((select) => {
        setSubtitle(stream.subtitles[select])
        langConfigRef.current.subtitle = stream.subtitles[select].locale
    }, [stream, setSubtitle])

    /** @type {Function} */
    const onScrub = useCallback(({ proportion }) => {
        // Check if we're running on WebOS 3.5 or lower
        const isLegacyWebOS = utils.isTv() && 
            window.webOS && 
            window.webOS.device && 
            (parseFloat(window.webOS.device.platformVersion) <= 4);

        // Skip preview handling on WebOS 3.5
        if (isLegacyWebOS) {
            return;
        }
        
        // Original preview handling
        if (previews.chunks.length > 0 && proportion && !isNaN(proportion)) {
            const chunk = previews.chunks[Math.floor(proportion * previews.chunks.length)]
            if (chunk) {
                setPreview(chunk.url)
            } else {
                setPreview(null)
            }
        }
    }, [previews, setPreview])

    /** @type {Function} */
    const onChangeEp = useCallback(async (changeEp) => {
        await updatePlayHead({ profile, content, playerCompRef })
        if (changeEp && changeEp.total > 0) {
            setAudio({})
            setPlayContent({ ...changeEp.data[0] })
        } else {
            back.doBack()
        }
    }, [playerCompRef, profile, content, setPlayContent, setAudio])

    /** @type {Function} */
    const onNextEp = useCallback((ev) => {
        ev.preventDefault()
        setLoading(true)
        playerRef.current.pause()
        findNextEp({ profile, content, step: +1 }).then(onChangeEp)
    }, [profile, content, onChangeEp, setLoading])

    /** @type {Function} */
    const onPrevEp = useCallback((ev) => {
        ev.preventDefault()
        playerRef.current.pause()
        if (playerRef.current.time() <= 30) {
            setLoading(true)
            findNextEp({ profile, content, step: -1 }).then(onChangeEp)
        } else {
            playerRef.current.seek(0)
            playerRef.current.play()
        }
    }, [profile, content, onChangeEp, setLoading])

    /** @type {Function} */
    const onEndVideo = useCallback((ev) => setEndEvent(ev), [setEndEvent])

    /** @type {Function} */
    const markAsWatched = useCallback(() => {
        api.discover.markAsWatched(profile, content.id)
            .then(() => console.log('watched'))
            .catch(console.error)
        onNextEp(new Event('fake'))
    }, [profile, content, onNextEp])

    /** @type {Function} */
    const onPlayPause = useCallback(() => {
        if (playerCompRef.current) {
            const { paused } = playerCompRef.current.getMediaState()
            setIsPaused(!paused)
        }
    }, [])

    /** @type {Function} */
    const onSkipBtnNavigate = useCallback(() => {
        if (!Spotlight.focus(rest.spotlightId + '_mediaControls')) {
            playerCompRef.current.showControls()
        }
    }, [rest.spotlightId])

    /** @type {Function} */
    const resetCurrentSkipEvent = useCallback(oldValue => {
        if (oldValue) {
            if (!Spotlight.focus(rest.spotlightId + '_mediaControls')) {
                const ctrlButton = document.querySelector('#media-controls').parentElement
                Spotlight.focus(ctrlButton.parentElement.nextElementSibling)
            }
        }
        return null
    }, [rest.spotlightId])

    /** @type {Function} */
    const onSkipEvent = useCallback(() => {
        if (currentSkipEvent.end - currentSkipEvent.start > 5) {
            playerRef.current.seek(currentSkipEvent.end - 5)
        } else {
            playerRef.current.seek(currentSkipEvent.end)
        }
        setCurrentSkipEvent(resetCurrentSkipEvent)
    }, [currentSkipEvent, resetCurrentSkipEvent])

    /** @type {Function} set skip button bottom */
    const onMediaControlShow = useCallback(({ available }) => {
        const skipDoc = document.querySelector('#skip-button')
        if (available) {
            const ctrlButton = document.querySelector('#media-controls').parentElement
            const posicionElementoB = ctrlButton.getBoundingClientRect().top
            skipDoc.style.bottom = `${window.innerHeight - posicionElementoB + 15}px`
        } else {
            skipDoc.style.bottom = '2.5rem'
            if (skipDoc.style.display === 'inline-block') {
                setTimeout(() => Spotlight.focus('#skip-button'), 100)
            }
        }
    }, [])

    /** @type {Function} */
    const onClosePopup = useCallback(() => setMessage(''), [setMessage])

    /** @type {Function} */
    const handleCrunchyError = useCallback((err) => {
        if (err instanceof CrunchyrollError) {
            if (err.httpStatus === 403) {
                setMessage(err.message + '. ' + $L('Maybe it is a premium content.'))
            } else if (err.httpStatus === 420 && err.message === 'TOO_MANY_ACTIVE_STREAMS') {
                setMessage($L('Too many active streams.'))
            } else {
                setMessage(err.message || err.httpStatusText)
            }
        } else if (err) {
            setMessage(err.message || `${err}`)
        } else {
            setMessage($L('An error occurred'))
        }
    }, [setMessage])

    /** @type {Function} */
    const triggerActivity = useCallback(() => {
        playerCompRef.current?.activityDetected()
    }, [])

    useEffect(() => {  // find audios, it's needed to find stream url
        findAudio({ profile, langConfig: langConfigRef.current, audios }).then(setAudio)
    }, [profile, audios, setAudio, setEndEvent])

    useEffect(() => {  // find stream url
        if (audios.includes(audio)) {
            findStream({ profile, langConfig: langConfigRef.current, audios, audio, getLang, content })
                .then(setStream)
                .catch(handleCrunchyError)
        }
        return () => {
            setStream(lastStream => {
                if (lastStream.token) {
                    api.drm.deleteToken(profile, { episodeId: audio.guid, token: lastStream.token })
                }
                return emptyStream
            })
        }
    }, [profile, content, audios, audio, getLang, setStream, emptyStream, handleCrunchyError])

    useEffect(() => {  // find subtitles preview and skip events
        if (stream.urls) {
            findSubtitle(stream).then(setSubtitle)
            findPreviews(stream).then(setPreviews)
            findSkipEvents(stream).then(setSkipEvents)
        }
        return () => {
            setPreviews(lastPreview => {
                lastPreview.chunks.forEach(prev => window.URL.revokeObjectURL(prev))
                return { chunks: [], data: null }
            })
            setSubtitle(null)
            setSkipEvents(null)
        }
    }, [profile, stream, setSubtitle, setPreviews, setSkipEvents])

    useEffect(() => {  // attach subs
    let interval = null
    if (stream.urls && subtitle && stream.id === content.id) {
        interval = setInterval(() => {
            if (playerCompRef.current) {
                clearInterval(interval)
                createDashPlayer(audio, stream, content, subtitle).then(player => {
                    playerRef.current = player
                    playerRef.current.play()
                    setLoading(false)
                    setIsPaused(false)
                }).catch(handleCrunchyError)
            }
        }, 100)
    }
    return () => {
        setLoading(true)
        if (playerRef.current) {
            // Add this line to clean up quality enforcement interval
            if (typeof cleanupPlayer === 'function') {
                cleanupPlayer(playerRef.current);
            }
            playerRef.current.pause()
            playerRef.current.destroy()
            playerRef.current = null
        }
        clearInterval(interval)
    }
}, [profile, content, stream, audio, subtitle, setLoading, handleCrunchyError])

    useEffect(() => {  // set stream session
        if (stream === emptyStream) {
            setSession(null)
        } else {
            setSession(stream.session)
        }
    }, [stream, emptyStream])

    useEffect(() => {  // renew session keep alive stream
        let sessionTimeout = null
        if (session && stream.token) {
            sessionTimeout = setTimeout(() => {
                /** @type {{paused: boolean, currentTime: number}} */
                const state = playerCompRef.current.getMediaState()
                api.drm.keepAlive(stream.profile, {
                    episodeId: audio.guid,
                    token: stream.token,
                    playhead: state.currentTime,
                }).then(setSession).catch(e => {  // if fail retry in 2 second
                    logger.error('Error keep alive stream')
                    logger.error(e)
                    setSession(lastSession => {
                        const retries = (lastSession.retries || 0) + 1
                        let out = null
                        if (retries <= 12) {
                            out = {
                                ...lastSession,
                                renewSeconds: 18,
                                retries,
                            }
                        } else {
                            handleCrunchyError(e)
                        }
                        return out
                    })
                })

            }, (session.renewSeconds - 20) * 1000)
        }
        return () => clearTimeout(sessionTimeout)
    }, [profile, audio, stream, session, setSession, handleCrunchyError])

    useEffect(() => {  // plause / play watch
        let timeout = null
        if (session && isPaused) {
            timeout = setTimeout(() => {
                back.doBack()
            }, session.maximumPauseSeconds * 1000)
        }
        return () => { clearTimeout(timeout) }
    }, [session, isPaused])

    useEffect(() => {  // loop playHead
        if (!_PLAY_TEST_) {
            if (!loading && playerCompRef.current && content) {
                return updatePlayHeadLoop({ profile, content, playerCompRef })
            }
        }
    }, [profile, content, playerCompRef, loading])

    useEffect(() => {  // play next video
        let timeout = null
        if (endEvent) {
            timeout = setTimeout(() => {
                setEndEvent(null)
                if (!_PLAY_TEST_) {
                    onNextEp(endEvent)
                }
            }, 1000 * 2)
        }
        return () => clearTimeout(timeout)
    }, [endEvent, onNextEp, audios])

    useEffect(() => {  // incremental seek
        /** @type {Function} */
        const increaseSeek = () => { setJumpBy(Math.min(jumpBy << 1, 30)) }
        let timeout = null
        if (jumpBy <= 5) {
            // nothing
        } else if (jumpBy <= 10) {
            timeout = setTimeout(() => { setJumpBy(5) }, 2 * 1000)
        } else {
            timeout = setTimeout(() => { setJumpBy(5) }, 5 * 1000)
        }
        if (playerRef.current) {
            playerRef.current.on('playbackSeeking', increaseSeek)
        }
        return () => {
            if (playerRef.current) {
                playerRef.current.off('playbackSeeking', increaseSeek)
            }
            clearTimeout(timeout)
        }
    }, [loading, setJumpBy, jumpBy])

    useEffect(() => {  // skip events
        /** @type {Array<String>} */
        let availableEvents = []
        let timeout = null
        let timeloop = null
        /** @type {Function} */
        const processFn = update => {
            for (const type of availableEvents) {
                const gapSeconds = Math.min(15, skipEvents[type].end - skipEvents[type].start)
                const end = Math.min(skipEvents[type].start + gapSeconds, skipEvents[type].end)
                if (skipEvents[type].start <= update.time && update.time <= end && update.time > 0) {
                    setCurrentSkipEvent(oldValue => {
                        if (oldValue !== skipEvents[type]) {
                            playerCompRef.current.hideControls()
                            clearInterval(timeloop)
                            timeloop = setInterval(() => {
                                if (Spotlight.focus('#skip-button')) {
                                    clearInterval(timeloop)
                                }
                            }, 100)
                            clearTimeout(timeout)
                            timeout = setTimeout(() => setCurrentSkipEvent(resetCurrentSkipEvent), 1000 * gapSeconds)
                        }
                        return skipEvents[type]
                    })

                }
            }
        }
        if (!loading && skipEvents && playerRef.current) {
            availableEvents = ['recap', 'intro', 'credits', 'preview'].filter(type => skipEvents[type])
            playerRef.current.on('playbackTimeUpdated', processFn)
        }
        return () => {
            if (playerRef.current) {
                playerRef.current.off('playbackTimeUpdated', processFn)
            }
            clearTimeout(timeout)
            clearInterval(timeloop)
            setCurrentSkipEvent(resetCurrentSkipEvent)
        }
    }, [loading, skipEvents, resetCurrentSkipEvent])

    return (
        <div className={rest.className}>
            <VideoPlayer {...rest}
                title={title}
                poster={poster}
                thumbnailSrc={preview}
                onScrub={onScrub}
                onJumpBackward={onPrevEp}
                onJumpForward={onNextEp}
                onEnded={onEndVideo}
                onPause={onPlayPause}
                onPlay={onPlayPause}
                jumpBy={jumpBy}
                loading={loading}
                ref={playerCompRef}
                onControlsAvailable={onMediaControlShow}
                noAutoPlay>
                <video id={content.id}>
                    <source src={emptyVideo} />
                </video>
                <MediaControls id="media-controls">
                    <leftComponents>
                        <ContentInfo content={content} />
                        {['episode'].includes(content.type) && (<>
                            <IconButton
                                backgroundOpacity="lightTranslucent"
                                onClick={markAsWatched}
                                tooltipText={$L('Mark as watched')}>
                                checkselection
                            </IconButton>
                            <Rating profile={profile} content={content} />

                        </>)}
                    </leftComponents>
                    <rightComponents>
                        {stream.subtitles.length > 1 &&
                            <SubtitleSelect subtitles={stream.subtitles}
                                subtitle={subtitle}
                                selectSubtitle={selectSubtitle}
                                triggerActivity={triggerActivity} />
                        }
                        {stream.audios.length > 1 &&
                            <AudioSelect audios={stream.audios}
                                audio={audio}
                                selectAudio={selectAudio}
                                triggerActivity={triggerActivity} />
                        }
                        <ContactMe origin='/profiles/home/player' />
                    </rightComponents>
                </MediaControls>
            </VideoPlayer>
            <QualityDebug playerRef={playerRef} loading={loading} />
            <Button id="skip-button"
                style={{
                    position: 'absolute',
                    right: '2.5rem',
                    bottom: '2.5rem',
                    display: currentSkipEvent ? 'inline-block' : 'none',
                }}
                onClick={onSkipEvent}
                spotlightDisabled={!currentSkipEvent}
                onSpotlightDown={onSkipBtnNavigate}
                onSpotlightLeft={onSkipBtnNavigate}
                onSpotlightRight={onSkipBtnNavigate}
                onSpotlightUp={onSkipBtnNavigate}>
                {currentSkipEvent && currentSkipEvent.title}
            </Button>
            <PopupMessage show={!!message} type='error' onClose={onClosePopup}>
                {message}
            </PopupMessage>
        </div>
    )
}

export default Player
