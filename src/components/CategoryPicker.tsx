import { CATEGORY_ICON } from '../lib/categories'

export function CategoryPicker({
  open,
  title,
  options,
  value,
  onChange,
  onClose,
}: {
  open: boolean
  title: string
  options: readonly string[]
  value: string
  onChange: (next: string) => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="monthPickerOverlay" onClick={onClose}>
      <div className="monthPickerPanel" onClick={(e) => e.stopPropagation()}>
        <div className="monthPickerTitle">{title}</div>
        <div className="categoryPickerGrid">
          {options.map((item) => (
            <button
              type="button"
              key={item}
              className={value === item ? 'categoryChip categoryChipActive' : 'categoryChip'}
              onClick={() => {
                onChange(item)
                onClose()
              }}
            >
              <span className="categoryChipIcon">{CATEGORY_ICON[item] ?? '🏷️'}</span>
              <span className="categoryChipText">{item}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

