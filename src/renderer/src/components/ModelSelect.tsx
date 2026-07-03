import { useEffect, useState } from 'react'
import type { AvailableModel } from '@shared/types'

interface ModelSelectProps {
  label: string
  value: string
  options: AvailableModel[]
  onChange: (value: string) => void
}

const CUSTOM_OPTION = '__custom__'

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

  useEffect(() => {
    if (!value) return
    const known = options.some((model) => model.id === value)
    setCustomMode(!known && options.length > 0)
  }, [value, options])

  if (options.length === 0) {
    return (
      <label>
        <span className="field-label">{label}</span>
        <input
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请先测试连接或刷新模型列表"
        />
      </label>
    )
  }

  if (customMode) {
    return (
      <label>
        <span className="field-label">{label}</span>
        <div className="stack" style={{ gap: '0.375rem' }}>
          <input
            className="field-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="输入模型 ID"
          />
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem', alignSelf: 'flex-start' }}
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

  return (
    <label>
      <span className="field-label">{label}</span>
      <select
        className="field-input"
        value={isKnownModel ? value : ''}
        onChange={(e) => {
          const next = e.target.value
          if (next === CUSTOM_OPTION) {
            setCustomMode(true)
            onChange('')
            return
          }
          onChange(next)
        }}
      >
        {!isKnownModel && (
          <option value="" disabled>
            请选择模型
          </option>
        )}
        {options.map((model) => (
          <option key={model.id} value={model.id}>
            {formatOption(model)}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>手动输入模型 ID...</option>
      </select>
    </label>
  )
}
