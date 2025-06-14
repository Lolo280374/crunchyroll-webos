import type { Callback, Template } from "./vine"
import { $, register, Route, unwatch, watch } from "./vine"
import { App } from "./app"

/**
 * Return template
 * @param component
 * @returns
 */
const template: Template = async ({ state }) => {
    return await App.getTemplate('menu', state)
}

/**
 * Set active menu item
 * @param component
 */
const setActive: Callback = ({ element }) => {

    const path = Route.active()
    const id = path.menuId ? path.menuId : ''

    const next = $('a.link-' + id + '', element)
    const current = $('a.active', element)

    if (current) {
        current.classList.remove('active')
    }
    if (next) {
        next.classList.add('active')
    }

}

/**
 * On mount
 * @param component
 */
const onMount: Callback = (component) => {

    watch(component.element, 'route::after::change', () => {
        setActive(component)
    })

    watch(component.element, 'auth::changed', async () => {
        await component.render()
        await setActive(component)
    })

}

/**
 * On render
 * @param component
 */
const onRender: Callback = (component) => {
    setActive(component)
}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {

    unwatch(element, 'route::after::change')
    unwatch(element, 'auth::changed')

}

register('[data-menu]', {
    template,
    onMount,
    onRender,
    onDestroy
})
