import type { Callback, State, Template } from "./vine"
import { fire, on, off, register, Route, unwatch, watch } from "./vine"
import { App } from "./app"

/**
 * Initial state
 * @returns
 */
const state: State = () => {

    // Categories
    const categories = []
    categories.push({ id: 'popular', name: 'Popular' })
    categories.push({ id: 'new', name: 'Newest' })
    categories.push({ id: 'alphabetical', name: 'Alphabetical' })

    App.getCategories().map((item) => {
        categories.push({
            id: item.slug,
            name: item.localization.title
        })
    })

    return {
        categories: categories,
        category: 'popular',
        sort: 'popularity',
        page: 1,
        limit: 20,
        special: true,
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
    return await App.getTemplate('explore', state)
}

/**
 * Parse route params to the component
 * @param component
 */
const parseParams: Callback = ({ state }) => {

    const category = String(Route.getParam('category') || 'popular')
    const sort = String(Route.getQuery('sort') || 'popularity')
    const page = Number(Route.getQuery('page') || 1)

    state.category = category
    state.sort = sort
    state.page = page
    state.special = ['popular', 'new', 'alphabetical'].includes(category)

    // Ensure that sort is correct for special categories
    if ( category === 'popular' ){
        state.sort = 'popularity'
    } else if ( category === 'new' ){
        state.sort = 'newly_added'
    } else if ( category === 'alphabetical' ){
        state.sort = 'alphabetical'
    }

}

/**
 * List results
 * @param component
 */
const listResults: Callback = async ({ state, render }) => {

    const category = String(state.category)
    const sort = String(state.sort)
    const page = Number(state.page)
    const limit = Number(state.limit)
    const special = Boolean(state.special)
    const offset = (page - 1) * limit

    fire('loading::show')

    try {

        let total = 0
        let items = []

        // Special listings
        if ( category && special ){
            const response = await App.browser({
                'type': 'series',
                'sort_by': sort,
                'start': offset.toString(),
                'n': limit.toString()
            })

            total = (response.total || 0)
            items = (response.data || []).map((item) => {
                return {
                    id: item.id,
                    name: item.title,
                    description: item.description,
                    image: App.getImage(item.images.poster_wide).source
                }
            })

        // Other categories
        } else {
            const response = await App.browser({
                'type': 'series',
                'categories': category,
                'sort_by': sort,
                'start': offset.toString(),
                'n': limit.toString()
            })

            total = (response.total || 0)
            items = (response.data || []).map((item) => {
                return {
                    id: item.id,
                    name: item.title,
                    description: item.description,
                    image: App.getImage(item.images.poster_wide).source
                }
            })
        }

        const base = 'explore/' + category + '?sort=' + sort + '&page={PAGE}'
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

    on(element, 'change', 'input#category', (_event, target: HTMLInputElement) => {
        Route.redirect('/explore/' + target.value)
    })

    on(element, 'change', 'input#sort', (_event, target: HTMLInputElement) => {
        const category = String(component.state.category)
        Route.redirect('/explore/' + category + '?sort=' + target.value)
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

    off(element, 'change', 'input#category')
    off(element, 'change', 'input#sort')

    unwatch(element, 'view::reload')

}

register('[data-explore]', {
    state,
    template,
    onMount,
    onDestroy
})

Route.add({
    id: 'explore',
    menuId: 'explore',
    path: '/explore',
    title: 'Explore',
    component: '<div data-explore></div>',
    authenticated: true
})
Route.add({
    id: 'explore',
    menuId: 'explore',
    path: '/explore/:category',
    title: 'Explore',
    component: '<div data-explore></div>',
    authenticated: true
})