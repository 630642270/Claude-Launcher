import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { popStyleFromGeom, useComboPopover } from './useComboPopover'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
}

/** 静态选项下拉框，与 ModelSelect 共用同一套 combo 弹层样式与定位逻辑 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = '请选择'
}: SelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const activeElRef = useRef<HTMLLIElement>(null)
  const { geom, beginOpen } = useComboPopover({ triggerRef: containerRef, popRef, listRef, open })

  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent): void => {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (popRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  useEffect(() => {
    activeElRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const select = (optionValue: string): void => {
    onChange(optionValue)
    setOpen(false)
  }

  const openCombo = (): void => {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
    beginOpen()
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        openCombo()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (options[activeIndex]) select(options[activeIndex].value)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="combo" ref={containerRef}>
        <button
          type="button"
          className={`field-input combo-trigger ${selected ? '' : 'combo-placeholder'}`}
          onClick={() => (open ? setOpen(false) : openCombo())}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="combo-value" title={selected?.label ?? value}>
            {selected ? selected.label : value || placeholder}
          </span>
          <svg
            className={`combo-chevron ${open ? 'combo-chevron-open' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open &&
        createPortal(
          <div className="combo-pop" ref={popRef} style={popStyleFromGeom(geom)}>
            <ul className="combo-list" role="listbox" ref={listRef}>
              {options.map((option, index) => {
                const isCurrent = option.value === value
                return (
                  <li
                    key={option.value}
                    ref={index === activeIndex ? activeElRef : undefined}
                    role="option"
                    aria-selected={isCurrent}
                    className={[
                      'combo-item',
                      index === activeIndex ? 'combo-item-active' : '',
                      isCurrent ? 'combo-item-selected' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(option.value)}
                  >
                    <span className="combo-item-name combo-item-name--full">{option.label}</span>
                    {isCurrent && (
                      <span className="combo-check" aria-hidden="true">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  )
}