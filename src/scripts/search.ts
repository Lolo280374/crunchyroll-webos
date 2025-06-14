import type { Callback, State, Template } from "./vine"
import { fire, on, off, register, Route, unwatch, watch } from "./vine"
import { App } from "./app"

/**
 * Initial state
 * @returns
 */
const state: State = () => {
    return {
        query: '',
        page: 1,
        limit: 20,
        loaded: false,
        error: false,
        message: '',
        total: 0,
        items: [],
        nextPage: '',
        previousPage: ''
    }
}

/**
 * Return template
 * @param component
 * @returns
 */
const template: Template = async ({ state }) => {
    return await App.getTemplate('search', state)
}

/**
 * Parse route params to the component
 * @param component
 */
const parseParams: Callback = ({ state }) => {

    const query = String(Route.getQuery('query') || '')
    const page = Number(Route.getQuery('page') || 1)

    state.query = query
    state.page = page

}

/**
 * List results
 * @param component
 */
const listResults: Callback = async ({ state, render }) => {

    const query = String(state.query)
    const page = Number(state.page)
    const limit = Number(state.limit)
    const offset = (page - 1) * limit

    if( !query ){
        return
    }

    fire('loading::show')

    try {

        const response = await App.search({
            'type': 'series',
            'q': query,
            'start': offset.toString(),
            'n': limit.toString()
        })

        const data = {
            count: 0,
            items: []
        }

        if( response.data && response.data.length ){
            data.count = response.data[0].count || 0
            data.items = response.data[0].items || []
        }

        const total = data.count
        const items = data.items.map((item) => {
            return {
                id: item.id,
                name: item.title,
                description: item.description,
                image: App.getImage(item.images.poster_wide).source
            }
        })

        const base = 'search?query=' + query + '&page={PAGE}'
        const nextPage = (total > offset + limit) ? base.replace('{PAGE}', Number(page + 1).toString()) : ''
        const previousPage = (page > 1) ? base.replace('{PAGE}', Number(page - 1).toString()) : ''

        await render({
            loaded: true,
            total: total,
            items: items,
            nextPage: nextPage,
            previousPage: previousPage,
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
const onMount: Callback = async (component) => {

    const element = component.element

    on(element, 'change', 'input#query', (_event, target: HTMLInputElement) => {
        Route.redirect('/search?query=' + encodeURI(target.value))
    })

    watch(element, 'view::reload', async () => {
        await parseParams(component)
        await listResults(component)
    })

    await parseParams(component)
    await listResults(component)

}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {

    off(element, 'change', 'input#query')
    unwatch(element, 'view::reload')

}

register('[data-search]', {
    state,
    template,
    onMount,
    onDestroy
})

Route.add({
    id: 'search',
    menuId: 'search',
    path: '/search',
    title: 'Search',
    component: '<div data-search></div>',
    authenticated: true
})
