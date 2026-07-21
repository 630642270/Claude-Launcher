import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AvailableModel } from '@shared/types'
import { popStyleFromGeom, useComboPopover } from './useComboPopover'

interface ModelSelectProps {
  label: string
  value: string
  options: AvailableModel[]
  onChange: (value: string) => void
}

function formatOption(model: AvailableModel): string {
  if (model.displayName && model.displayName !== model.id) {
    return `${model.displayName} (${model.id})`
  }
  return model.id
}

export function ModelSelect({
  label,
  value,
  options,
  onChange
}: ModelSelectProps): React.JSX.Element {
  const optionIds = new Set(options.map((model) => model.id))
  const isKnownModel = Boolean(value && optionIds.has(value))
  const [customMode, setCustomMode] = useState(() => Boolean(value && !optionIds.has(value)))

  // 父组件传入的 value/options 变化时在渲染期间同步 customMode（React 官方推荐的派生 state 模式，避免 effect 副作用）
  const [trackedValue, setTrackedValue] = useState(value)
  const [trackedOptions, setTrackedOptions] = useState(options)
  if (value !== trackedValue || options !== trackedOptions) {
    setTrackedValue(value)
    setTrackedOptions(options)
    if (value) {
      const known = options.some((model) => model.id === value)
      setCustomMode(!known && options.length > 0)
    }
  }

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const activeElRef = useRef<HTMLLIElement>(null)
  const { geom, beginOpen } = useComboPopover({ triggerRef: containerRef, popRef, listRef, open })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (model) =>
        model.id.toLowerCase().includes(q) ||
        (model.displayName ?? '').toLowerCase().includes(q)
    )
  }, [options, query])

  const openCombo = (): void => {
    setQuery('')
    setActiveIndex(0)
    setOpen(true)
    beginOpen()
  }

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
    if (open) searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    activeElRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const select = (id: string): void => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  if (options.length === 0) {
    return (
      <label>
        <span className="field-label">{label}</span>
        <input
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请先拉取模型列表"
        />
      </label>
    )
  }

  if (customMode) {
    return (
      <label>
        <span className="field-label">{label}</span>
        <div className="stack combo-custom">
          <input
            className="field-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="输入模型 ID"
          />
          <button
            type="button"
            className="btn btn-secondary combo-back-btn"
            onClick={() => {
              setCustomMode(false)
              if (!isKnownModel && options[0]) {
                onChange(options[0].id)
              }
            }}
          >
            从列表选择（共 {options.length} 个）
          </button>
        </div>
      </label>
    )
  }

  const selected = options.find((model) => model.id === value)
  const hasValue = Boolean(selected || value)

  const popStyle = popStyleFromGeom(geom)

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="combo" ref={containerRef}>
        <button
          type="button"
          className={`field-input combo-trigger ${hasValue ? '' : 'combo-placeholder'}`}
          onClick={() => (open ? setOpen(false) : openCombo())}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="combo-value" title={value}>
            {selected ? formatOption(selected) : value || '请选择模型'}
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
          <div className="combo-pop" ref={popRef} style={popStyle}>
            <div className="combo-search-wrap">
              <input
                ref={searchRef}
                className="field-input combo-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex((i) => Math.max(i - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (filtered[activeIndex]) select(filtered[activeIndex].id)
                  } else if (e.key === 'Escape') {
                    setOpen(false)
                    setQuery('')
                  }
                }}
                placeholder={`搜索 ${options.length} 个模型...`}
              />
            </div>

            {filtered.length > 0 ? (
              <ul className="combo-list" role="listbox" ref={listRef}>
                {filtered.map((model, index) => {
                  const isCurrent = model.id === value
                  const hasAlias = Boolean(model.displayName && model.displayName !== model.id)
                  return (
                    <li
                      key={model.id}
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
                      onClick={() => select(model.id)}
                    >
                      <span className="combo-item-name">
                        {hasAlias ? model.displayName : model.id}
                      </span>
                      {hasAlias && <span className="combo-item-id">{model.id}</span>}
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
            ) : (
              <div className="combo-empty">无匹配模型</div>
            )}

            <button
              type="button"
              className="combo-custom-btn"
              onClick={() => {
                setCustomMode(true)
                setOpen(false)
                setQuery('')
              }}
            >
              手动输入模型 ID...
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}