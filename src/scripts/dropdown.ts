import type { Callback } from "./vine"
import { $, fire, off, on, register, trigger, unwatch, watch } from "./vine"

/**
 * On mount
 * @param component
 */
const onMount: Callback = ({ element }) => {

    const input = $('input', element) as HTMLInputElement
    const dropdownValue = $('.dropdown-value', element)

    const isParentOf = (child: HTMLElement) => {

        while (child) {
            if (child == element) {
                return true
            }
            child = child.parentElement
        }

        return false
    }

    on(element, 'click', '.dropdown-value', () => {
        element.classList.add('active')
        const firstLI = $('li', element)
        fire('active::element::set', firstLI)
    })

    on(element, 'click', 'li', (_event, target) => {

        dropdownValue.innerText = target.innerText
        input.value = target.dataset.value
        trigger(input, 'change')

        element.classList.remove('active')
        fire('active::element::set', element)

    })

    on(element, 'blur', (_event, target) => {
        if (!target.contains(element)) {
            element.classList.remove('active')
        }
    })

    watch(element, 'active::element::updated', (activeElement: HTMLElement) => {
        if (!activeElement || !isParentOf(activeElement)) {
            element.classList.remove('active')
        }
    })

    const current = $('li[data-value="' + input.value + '"]', element)
    if (current) {
        dropdownValue.innerText = current.innerText
    }

}

/**
 * On destroy
 * @param component
 */
const onDestroy: Callback = ({ element }) => {

    off(element, 'click', '.dropdown-value')
    off(element, 'click', 'li')
    off(element, 'blur')

    unwatch(element, 'active::element::updated')

}

register('[data-dropdown]', {
    onMount,
    onDestroy
})
