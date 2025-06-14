import type { Callback } from "./vine"
import { on, off, register, unwatch, watch } from "./vine"

/**
 * On mount
 * @param component
 */
const onMount: Callback = ({ element }) => {

    const showLoading = () => {
        element.classList.add('active')
    }
    const hideLoading = () => {
        element.classList.remove('active')
    }

    // Private
    on(element, 'show', (event) => {
        event.preventDefault()
        showLoading()
    })

    on(element, 'hide', (event) => {
        event.preventDefault()
        hideLoading()
    })

    // Public
    watch(element, 'loading::show', showLoading)
    watch(element, 'loading::hide', hideLoading)

}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {

    off(element, 'show')
    off(element, 'hide')

    unwatch(element, 'loading::show')
    unwatch(element, 'loading::hide')

}

register('[data-loading]', {
    onMount,
    onDestroy
})
