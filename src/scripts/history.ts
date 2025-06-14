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
        limit: Number(Route.getQuery('limit') || 12),
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
    return await App.getTemplate('history', state)
}

/**
 * List history
 * @param component
 */
const listHistory: Callback = async ({ state, render }) => {

    const pageNumber = Number(state.pageNumber)
    const limit = Number(state.limit)

    fire('loading::show')

    try {

        const response = await App.history({
            'page': pageNumber.toString(),
            'page_size': limit.toString()
        })

        const data = response.data || []
        const items = data.filter((item) => {
            return item.panel.type === 'episode'
        }).map((item) => {
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
        listHistory(component)
    })

    listHistory(component)

}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {
    unwatch(element, 'view::reload')
}

register('[data-history]', {
    state,
    template,
    onMount,
    onDestroy
})

Route.add({
    id: 'history',
    menuId: 'history',
    path: '/history',
    title: 'History',
    component: '<div data-history></div>',
    authenticated: true
})
Route.add({
    id: 'history',
    menuId: 'history',
    path: '/history/:pageNumber',
    title: 'History',
    component: '<div data-history></div>',
    authenticated: true
})
