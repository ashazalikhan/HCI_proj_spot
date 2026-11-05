import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dragStart = useRef<number | null>(null)

  useEffect(() => {
    const panel = panelRef.current
    const shell = document.querySelector('.shell')
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (shell instanceof HTMLElement) shell.inert = true

    function focusables(): HTMLElement[] {
      if (!panel) return []
      return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.tabIndex !== -1)
    }

    function focusSheet() {
      const preferred = panel?.querySelector<HTMLElement>('[data-sheet-focus]')
      if (preferred) {
        preferred.focus()
        return
      }
      focusables()[0]?.focus()
    }

    focusSheet()

    function onKey(event: KeyboardEvent) {
      if (!panel) return
      const target = event.target
      const inside = target instanceof Node && panel.contains(target)
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (!inside) {
        event.preventDefault()
        event.stopPropagation()
        focusSheet()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      const current = document.activeElement
      if (event.shiftKey && (current === first || !panel.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || !panel.contains(current))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (shell instanceof HTMLElement) shell.inert = false
      returnTo?.focus()
    }
  }, [])

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div
          className="sheet-handle"
          aria-hidden="true"
          onPointerDown={(event) => {
            dragStart.current = event.clientY
          }}
          onPointerUp={(event) => {
            if (dragStart.current !== null && event.clientY - dragStart.current > 48) onCloseRef.current()
            dragStart.current = null
          }}
        />
        <h2 id="sheet-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
