import type { Callback } from "./vine"
import { fire, register, Route } from "./vine"
import { App } from "./app"

/**
 * On mount
 */
const onMount: Callback = async () => {

    fire('loading::show')

    try {
        await App.logout()
    } catch (error) {
        console.log(error.message)
    }

    setTimeout(() => {
        fire('loading::hide')
        Route.redirect('/login')
    }, 1000)

}

register('[data-logout]', {
    onMount
})

Route.add({
    id: 'logout',
    path: '/logout',
    title: 'Logout',
    component: '<div data-logout></div>',
    authenticated: true
})
