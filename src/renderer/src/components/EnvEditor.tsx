import type { EnvPair } from '@shared/types'

interface EnvEditorProps {
  value: EnvPair[]
  onChange: (value: EnvPair[]) => void
}

export function EnvEditor({ value, onChange }: EnvEditorProps): React.JSX.Element {
  const updatePair = (index: number, field: keyof EnvPair, next: string): void => {
    const copy = [...value]
    copy[index] = { ...copy[index], [field]: next }
    onChange(copy)
  }

  const addPair = (): void => {
    onChange([...value, { key: '', value: '' }])
  }

  const removePair = (index: number): void => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="stack">
      <div className="env-header">
        <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: '#d1d5db' }}>
          自定义环境变量
        </h3>
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.875rem' }} onClick={addPair}>
          添加
        </button>
      </div>

      {value.length === 0 ? (
        <p className="text-muted">暂无自定义变量，将使用上方模型与环境配置。</p>
      ) : (
        <div className="env-list">
          {value.map((pair, index) => (
            <div key={index} className="env-grid">
              <input
                className="field-input"
                placeholder="KEY"
                value={pair.key}
                onChange={(e) => updatePair(index, 'key', e.target.value)}
              />
              <input
                className="field-input"
                placeholder="VALUE"
                value={pair.value}
                onChange={(e) => updatePair(index, 'value', e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={() => removePair(index)}>
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
