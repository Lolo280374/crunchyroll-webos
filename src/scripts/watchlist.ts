import type { Callback, State, Template } from "./vine"
import { fire, register, Route, unwatch, watch } from "./vine"
import { App } from "./app"

/**
 * Initial state
 * @returns
 */
const state: State = () => {
    return {
        pageNumber: Number(Route.getParam('pageNumber') || 1),
        limit: Number(Route.getQuery('limit') || 20),
        loaded: false,
        error: false,
        message: '',
        items: []
    }
}

/**
 * Return template
 * @param component
 * @returns
 */
const template: Template = async ({ state }) => {
    return await App.getTemplate('watchlist', state)
}

/**
 * List watchlist
 * @param component
 */
const listWatchlist: Callback = async ({ state, render }) => {

    const pageNumber = Number(state.pageNumber)
    const limit = Number(state.limit)
    const offset = (pageNumber - 1) * limit

    fire('loading::show')

    try {

        const response = await App.watchlist({
            'order': 'desc',
            'start': offset.toString(),
            'n': limit.toString(),
        })

        const data = response.data || []
        const items = data.map((item) => {
            const metadata = item.panel.episode_metadata
            return {
                id: item.panel.id,
                image: App.getImage(item.panel.images.thumbnail).source,
                number: metadata.episode_number || metadata.episode,
                name: item.panel.title,
                description: item.panel.description,
                duration: metadata.duration_ms / 1000,
                playhead: item.playhead,
                premium: metadata.is_premium_only,
                season_id: metadata.season_id,
                season_name: metadata.season_title,
                serie_id: metadata.series_id,
                serie_name: metadata.series_title,
            }
        })

        await render({
            loaded: true,
            items: items,
            error: false,
            message: ''
        })

    } catch (error) {

        await render({
            loaded: true,
            error: true,
            message: App.formatError(error)
        })

    }

    fire('loading::hide')
    fire('active::element::set')

}

/**
 * On mount
 * @param component
 */
const onMount: Callback = (component) => {

    watch(component.element, 'view::reload', () => {
        listWatchlist(component)
    })

    listWatchlist(component)

}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {
    unwatch(element, 'view::reload')
}

register('[data-watchlist]', {
    state,
    template,
    onMount,
    onDestroy
})

Route.add({
    id: 'watchlist',
    menuId: 'watchlist',
    path: '/watchlist',
    title: 'Watchlist',
    component: '<div data-watchlist></div>',
    authenticated: true
})
Route.add({
    id: 'watchlist',
    menuId: 'watchlist',
    path: '/watchlist/:pageNumber',
    title: 'Watchlist',
    component: '<div data-watchlist></div>',
    authenticated: true
})