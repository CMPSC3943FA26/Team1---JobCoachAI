// FieldGroup.tsx
// Reusable input wrapper used across the various form sections.
// This keeps every field aligned with the existing design styling.

import type { ReactNode } from 'react'

type FieldGroupProps = {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}

export function FieldGroup({ label, required = false, hint, children }: FieldGroupProps) {
  return (
    <div className="field-group">
      <div className="label-row">
        <label>
          {label}
          {required && <span> *</span>}
        </label>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
