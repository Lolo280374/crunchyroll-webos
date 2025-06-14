import type { Callback, RouteChange } from "./vine"
import { destroy, fire, mount, register, Route, trigger, unwatch, watch } from "./vine"
import { App } from "./app"

/**
 * Attach route component changes
 * @param component
 */
const onMount: Callback = ({ element }) => {

    watch(element, 'route::before::change', (change: RouteChange) => {

        // Kind of global 404
        if (!change.next) {
            change.next = Route.match('/home')
        }

        // Check login
        if (!App.isLoggedIn(true)) {
            change.next = Route.match('/login')
        }

    })

    watch(element, 'route::after::change', async (change: RouteChange) => {

        const previous = change.previous
        const next = change.next
        const body = document.body

        // Prevent in case of change to the same URL
        if (previous && next) {
            if (previous.path === next.path) {
                fire('view::reload')
                return
            }
        }

        // Destroy previous route
        if (previous && previous.id) {
            body.classList.remove('page-' + previous.id)
        }

        if (previous && previous.component) {
            await destroy(element)
        }

        // Route unauthenticated only
        if (next && next.unauthenticated) {
            if (App.isLoggedIn(true)) {
                return Route.redirect('/home')
            }
        }

        // Route authenticated only
        if (next && next.authenticated) {
            if (!App.isLoggedIn(true)) {
                return Route.redirect('/login')
            }
        }

        // Mount next component
        if (next && next.id) {
            body.classList.add('page-' + next.id)
        }

        if (next && next.component) {
            element.innerHTML = next.component
            await mount(element)
        }

    })

}

/**
 * Trigger initial popstate event
 */
const onRender: Callback = () => {
    trigger(window, 'popstate')
}

/**
 * Detach route component changes
 * @param component
 */
const onDestroy: Callback = ({ element }) => {

    unwatch(element, 'route::before::change')
    unwatch(element, 'route::after::change')

}

register('[data-view]', {
    onMount,
    onRender,
    onDestroy
})