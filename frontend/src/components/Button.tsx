// Button.tsx
// Small reusable button component.
// Keeps the design language consistent across auth, navigation, export, and save actions.
// The component maps the original button styles into a single API so screens can
// reference specific variants without repeating CSS classes manually.

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text'
  children: ReactNode
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'button button-primary'
      : variant === 'secondary'
        ? 'button button-secondary'
        : 'text-button'

  return (
    <button className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
