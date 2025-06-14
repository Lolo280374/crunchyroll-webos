import type { Callback, Template } from "./vine"
import { $, fire, on, off, register, Route } from "./vine"
import { App } from "./app"

/**
 * Return template
 * @param component
 * @returns
 */
const template: Template = async ({ state }) => {
    return await App.getTemplate('login', state)
}

/**
 * Try make login from input data
 * @param component
 */
const makeLogin: Callback = async ({ element, render }) => {

    const username = $('input#username', element) as HTMLInputElement
    const password = $('input#password', element) as HTMLInputElement

    fire('loading::show')

    try {
        await App.login(username.value, password.value)
        Route.redirect('/home')
    } catch (error) {
        await render({
            message: App.formatError(error)
        })
    }

    fire('loading::hide')

}

/**
 * On mount
 * @param component
 */
const onMount: Callback = (component) => {

    const element = component.element

    on(element, 'submit', 'form', (event) => {
        event.preventDefault()
        makeLogin(component)
    })

    on(element, 'click', 'button', (event) => {
        event.preventDefault()
        makeLogin(component)
    })

}

/**
 * On render
 * @param component
 */
const onRender: Callback = ({ element }) => {
    const username = $('input#username', element)
    fire('active::element::set', username)
}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {
    off(element, 'submit', 'form')
    off(element, 'click', 'button')
}

register('[data-login]', {
    template,
    onMount,
    onRender,
    onDestroy
})

Route.add({
    id: 'login',
    path: '/login',
    title: 'Login',
    component: '<div data-login></div>',
    unauthenticated: true
})
