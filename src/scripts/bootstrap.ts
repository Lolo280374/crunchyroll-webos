import { Engine, mount, on, Route } from "./vine"

on(window, 'load', async () => {

    // Template helpers
    Engine.helper('store', (key: string, _default: any) => {
        const value = localStorage.getItem(key)
        return value !== null ? value : _default
    })

    // Route definitions
    let base = window.location.pathname.replace('index.html', '')

    Route.init({
        mode: 'hash',
        base: base
    })

    // Component mounts
    await mount(document.body)

})
