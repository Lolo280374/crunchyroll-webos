import { $, Engine, fire } from "./vine"
import { Api } from "./api"
import type { Data } from "./api"

/**
 * Retrieve template as text
 * @param name
 * @param data
 * @returns
 */
const getTemplate = async (name: string, data: any) => {
    const element = $('script#template-' + name)
    const template = element.innerHTML
    return Engine.parse(template, data)
}

/**
 * Retrieve image information
 * @param images
 * @returns
 */
const getImage = (images: any[]) => {

    const image = { source: '' }
    if( images && images.length ){
        image.source = images[0][0].source
    }

    return image
}

/**
 * Format error for better visualization
 * @param error
 * @returns
 */
const formatError = (error: Error) => {
    const message = error.message + "\n\n" + error.stack;
    return message.split("\n").join("<br/>")
}

/**
 * Run application login process
 * @param username
 * @param password
 */
const login = async (username: string, password: string) => {

    // Store login data
    localStorage.setItem('username', username)
    localStorage.setItem('password', password)

    // Request login session
    const login = await Api.makeLogin(username, password)

    if( login.error ){
        throw new Error('Invalid login, please check and try again.')
    }

    // Save login session data
    const expiresIn = new Date()
    expiresIn.setSeconds( expiresIn.getSeconds() + login.expires_in )

    localStorage.setItem('scope', login.scope)
    localStorage.setItem('tokenType', login.token_type)
    localStorage.setItem('accessToken', login.access_token)
    localStorage.setItem('refreshToken', login.refresh_token)
    localStorage.setItem('expiresIn', expiresIn.toISOString())

    localStorage.setItem('accountId', login.account_id)
    localStorage.setItem('profileId', login.profile_id)
    localStorage.setItem('country', login.country)

    // Request profile information
    const accessToken = localStorage.getItem('accessToken')
    const profile = await Api.getProfile(accessToken)

    // Save profile information
    localStorage.setItem('avatar', Api.avatar(profile.avatar, 170))
    localStorage.setItem('matureContentFlagManga', profile.mature_content_flag_manga)
    localStorage.setItem('maturityRating', profile.maturity_rating)
    localStorage.setItem('preferredCommunicationLanguage', profile.preferred_communication_language)
    localStorage.setItem('preferredContentAudioLanguage', profile.preferred_content_audio_language)
    localStorage.setItem('preferredContentSubtitleLanguage', profile.preferred_content_subtitle_language)
    localStorage.setItem('profileName', profile.profile_name)
    localStorage.setItem('user', profile.username)
    localStorage.setItem('email', profile.email)

    // Request cookies
    const cookies = await Api.getCookies(accessToken)

    localStorage.setItem('cookiesBucket', cookies.cms.bucket)
    localStorage.setItem('cookiesSignature', cookies.cms.signature)
    localStorage.setItem('cookiesPolicy', cookies.cms.policy)
    localStorage.setItem('cookiesKeyParId', cookies.cms.key_pair_id)
    localStorage.setItem('cookiesExpiresIn', cookies.cms.expires)

    // Request text and audio languages
    const textLanguages = await Api.textLanguages()
    const audioLanguages = await Api.audioLanguages()

    // Save text and audio languages
    localStorage.setItem('textLanguages', JSON.stringify(textLanguages))
    localStorage.setItem('audioLanguages', JSON.stringify(audioLanguages))

    // Request categories
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')
    const categories = await Api.categories(accessToken, {
        'include_subcategories': 'true',
        'locale': preferredCommunicationLanguage,
    })

    // Save categories
    localStorage.setItem('categories', JSON.stringify(categories.items))

    // Trigger notification
    await fire('auth::changed')

}

/**
 * Run application logout process
 */
const logout = async () => {

    // Login data
    localStorage.removeItem('username')
    localStorage.removeItem('password')

    // Session data
    localStorage.removeItem('scope')
    localStorage.removeItem('tokenType')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('expiresIn')

    localStorage.removeItem('accountId')
    localStorage.removeItem('profileId')
    localStorage.removeItem('country')

    // Profile data
    localStorage.removeItem('avatar')
    localStorage.removeItem('matureContentFlagManga')
    localStorage.removeItem('maturityRating')
    localStorage.removeItem('preferredCommunicationLanguage')
    localStorage.removeItem('preferredContentAudioLanguage')
    localStorage.removeItem('preferredContentSubtitleLanguage')
    localStorage.removeItem('profileName')
    localStorage.removeItem('user')
    localStorage.removeItem('email')

    // Cookies
    localStorage.removeItem('cookiesBucket')
    localStorage.removeItem('cookiesSignature')
    localStorage.removeItem('cookiesPolicy')
    localStorage.removeItem('cookiesKeyParId')
    localStorage.removeItem('cookiesExpiresIn')

    // Text and audio languages
    localStorage.removeItem('textLanguages')
    localStorage.removeItem('audioLanguages')

    // Categories
    localStorage.removeItem('categories')

    // Trigger notification
    await fire('auth::changed')

}

/**
 * Return if user is logged in and login is not expired
 * Also check if user can refresh session
 * @returns
 */
const isLoggedIn = (checkRefreshToken: boolean) => {
    const accountId = localStorage.getItem('accountId')
    if( !accountId ){
        return false
    }

    const expiresIn = localStorage.getItem('expiresIn')
    if( !expiresIn ){
        return false
    }

    const refreshToken = localStorage.getItem('refreshToken')
    if( checkRefreshToken && refreshToken ){
        return true
    }

    const currentDate = new Date()
    const expiresInDate = new Date(expiresIn)
    const isExpired = currentDate > expiresInDate
    return !isExpired
}

/**
 * Refresh session if is expired
 */
const refreshSession = async () => {

    // Check if session is expired
    if( isLoggedIn(false) ){
        return
    }

    // Request refresh token
    const refreshToken = localStorage.getItem('refreshToken')
    const result = await Api.refreshLogin(refreshToken)

    if( result.error ){
        throw new Error('Could not refresh session, please login again.')
    }

    // Save new session data
    const newExpiresIn = new Date()
    newExpiresIn.setSeconds( newExpiresIn.getSeconds() + result.expires_in )

    localStorage.setItem('accessToken', result.access_token)
    localStorage.setItem('refreshToken', result.refresh_token)
    localStorage.setItem('expiresIn', newExpiresIn.toISOString())

    // Request refreshed cookies
    const accessToken = localStorage.getItem('accessToken')
    const cookies = await Api.getCookies(accessToken)

    // Save new cookie information
    localStorage.setItem('cookiesBucket', cookies.cms.bucket)
    localStorage.setItem('cookiesSignature', cookies.cms.signature)
    localStorage.setItem('cookiesPolicy', cookies.cms.policy)
    localStorage.setItem('cookiesKeyParId', cookies.cms.key_pair_id)
    localStorage.setItem('cookiesExpiresIn', cookies.cms.expires)

    // Trigger notification
    await fire('auth::refreshed')

}

/**
 * Retrieve profile data
 * @see Api.getProfile
 * @returns
 */
const getProfile = async () => {

    await refreshSession()
    const accessToken = localStorage.getItem('accessToken')

    return Api.getProfile(accessToken)
}

/**
 * Update profile data
 * @see Api.updateProfile
 * @param data
 * @returns
 */
const updateProfile = async (data: Data) => {

    await refreshSession()
    const accessToken = localStorage.getItem('accessToken')

    return Api.updateProfile(accessToken, data)
}

/**
 * Retrieve home feed data
 * @see Api.homeFeed
 * @param filters
 * @returns
 */
const homeFeed = async (filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.homeFeed(
        accessToken,
        accountId,
        filters
    )
}

/**
 * Retrieve browser data
 * @see Api.browser
 * @param filters
 * @returns
 */
const browser = async (filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.browser(
        accessToken,
        filters
    )
}

/**
 * Retrieve search results
 * @see Api.search
 * @param filters
 * @returns
 */
const search = async (filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['locale'] = preferredCommunicationLanguage

    return Api.search(
        accessToken,
        filters
    )
}

/**
 * Retrieve recommendations results
 * @see Api.recommendations
 * @param filters
 * @returns
 */
const recommendations = async (filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.recommendations(
        accessToken,
        accountId,
        filters
    )
}

/**
 * Retrieve watchlist results
 * @see Api.watchlist
 * @param filters
 * @returns
 */
const watchlist = async (filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.watchlist(
        accessToken,
        accountId,
        filters
    )
}

/**
 * Retrieve in watchlist results
 * @see Api.inWatchlist
 * @param filters
 * @returns
 */
const inWatchlist = async (filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.inWatchlist(
        accessToken,
        accountId,
        filters
    )
}

/**
 * Add serie to watchlist
 * @see Api.addToWatchlist
 * @param contentId
 * @param filters
 * @returns
 */
const addToWatchlist = async (contentId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.addToWatchlist(
        accessToken,
        accountId,
        contentId,
        filters
    )
}

/**
 * Remove serie from watchlist
 * @see Api.removeFromWatchlist
 * @param contentId
 * @param filters
 * @returns
 */
const removeFromWatchlist = async (contentId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.removeFromWatchlist(
        accessToken,
        accountId,
        contentId,
        filters
    )
}

/**
 * Retrieve history results
 * @see Api.history
 * @param filters
 * @returns
 */
const history = async (filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.history(
        accessToken,
        accountId,
        filters
    )
}

/**
 * Retrieve up next episode
 * @see Api.upNext
 * @param contentId
 * @param filters
 * @returns
 */
const upNext = async (contentId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.upNext(
        accessToken,
        contentId,
        filters
    )
}

/**
 * Retrieve previous episode
 * @see Api.previousEpisode
 * @param contentId
 * @param filters
 * @returns
 */
const previousEpisode = async (contentId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.previousEpisode(
        accessToken,
        contentId,
        filters
    )
}

/**
 * Retrieve playheads results
 * @see Api.playHeads
 * @param contentIds
 * @param filters
 * @returns
 */
const playHeads = async (contentIds: string[], filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage
    filters['content_ids'] = contentIds.join(',')

    return Api.playHeads(
        accessToken,
        accountId,
        filters
    )
}

/**
 * Set progress
 * @see Api.setProgress
 * @param filters
 * @param data
 * @returns
 */
const setProgress = async (filters: Data, data: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const accountId = localStorage.getItem('accountId')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.setProgress(
        accessToken,
        accountId,
        filters,
        data
    )
}

/**
 * Retrieve serie info
 * @see Api.serie
 * @param serieId
 * @param filters
 * @returns
 */
const serie = async (serieId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.serie(
        accessToken,
        serieId,
        filters
    )
}

/**
 * Retrieve seasons results
 * @see Api.seasons
 * @param seriesId
 * @param filters
 * @returns
 */
const seasons = async (seriesId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')
    const cookiesBucket = localStorage.getItem('cookiesBucket')
    const cookiesSignature = localStorage.getItem('cookiesSignature')
    const cookiesPolicy = localStorage.getItem('cookiesPolicy')
    const cookiesKeyParId = localStorage.getItem('cookiesKeyParId')

    filters['Signature'] = cookiesSignature
    filters['Policy'] = cookiesPolicy
    filters['Key-Pair-Id'] = cookiesKeyParId
    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage
    filters['series_id'] = seriesId

    return Api.seasons(
        accessToken,
        cookiesBucket,
        filters
    )
}

/**
 * Retrieve episodes results
 * @see Api.episodes
 * @param seasonId
 * @param filters
 * @returns
 */
const episodes = async (seasonId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')
    const cookiesBucket = localStorage.getItem('cookiesBucket')
    const cookiesSignature = localStorage.getItem('cookiesSignature')
    const cookiesPolicy = localStorage.getItem('cookiesPolicy')
    const cookiesKeyParId = localStorage.getItem('cookiesKeyParId')

    filters['Signature'] = cookiesSignature
    filters['Policy'] = cookiesPolicy
    filters['Key-Pair-Id'] = cookiesKeyParId
    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage
    filters['season_id'] = seasonId

    return Api.episodes(
        accessToken,
        cookiesBucket,
        filters
    )
}

/**
 * Retrieve episode information
 * @see Api.episode
 * @param episodeId
 * @param filters
 * @returns
 */
const episode = async (episodeId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')

    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.episode(
        accessToken,
        episodeId,
        filters
    )
}

/**
 * Retrieve streams results
 * @see Api.streams
 * @param episodeId
 * @param filters
 * @returns
 */
const streams = async (episodeId: string, filters: Data) => {

    await refreshSession()

    const accessToken = localStorage.getItem('accessToken')
    const preferredContentAudioLanguage = localStorage.getItem('preferredContentAudioLanguage')
    const preferredCommunicationLanguage = localStorage.getItem('preferredCommunicationLanguage')
    const cookiesBucket = localStorage.getItem('cookiesBucket')
    const cookiesSignature = localStorage.getItem('cookiesSignature')
    const cookiesPolicy = localStorage.getItem('cookiesPolicy')
    const cookiesKeyParId = localStorage.getItem('cookiesKeyParId')

    filters['Signature'] = cookiesSignature
    filters['Policy'] = cookiesPolicy
    filters['Key-Pair-Id'] = cookiesKeyParId
    filters['preferred_audio_language'] = preferredContentAudioLanguage
    filters['locale'] = preferredCommunicationLanguage

    return Api.streams(
        accessToken,
        cookiesBucket,
        episodeId,
        filters
    )
}

/**
 * Retrieve categories
 * @returns
 */
const getCategories = () => {
    const value = localStorage.getItem('categories')
    const categories = JSON.parse(value || '[]')
    return categories as Data[]
}

/**
 * Retrieve audio languages
 * @returns
 */
const getAudioLanguages = () => {
    const languages = localStorage.getItem('audioLanguages')
    const options = JSON.parse(languages || '[]')
    return options as string[]
}

/**
 * Retrieve text/subtitles languages
 * @returns
 */
const getTextLanguages = () => {
    const languages = localStorage.getItem('textLanguages')
    const options = JSON.parse(languages || '[]')
    return options as string[]
}

export const App = {
    getTemplate,
    getImage,
    formatError,
    login,
    logout,
    isLoggedIn,
    refreshSession,
    getProfile,
    updateProfile,
    homeFeed,
    browser,
    search,
    history,
    recommendations,
    watchlist,
    inWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    upNext,
    previousEpisode,
    playHeads,
    setProgress,
    serie,
    seasons,
    episode,
    episodes,
    streams,
    getCategories,
    getAudioLanguages,
    getTextLanguages
}