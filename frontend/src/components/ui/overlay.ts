import { useEffect, type KeyboardEvent } from 'react'

let scrollLockCount = 0
let savedBodyOverflow: string | null = null

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('disabled'))
}

export function trapFocusWithin(event: KeyboardEvent<HTMLElement>, container: HTMLElement | null) {
  if (event.key !== 'Tab' || !container) return

  const elements = focusableElements(container)
  if (elements.length === 0) return

  const first = elements[0]
  const last = elements[elements.length - 1]
  const activeElement = document.activeElement

  if (event.shiftKey && (activeElement === first || activeElement === container)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    if (scrollLockCount === 0) {
      savedBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    scrollLockCount += 1

    return () => {
      scrollLockCount -= 1
      if (scrollLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow ?? ''
        savedBodyOverflow = null
      }
    }
  }, [locked])
}
