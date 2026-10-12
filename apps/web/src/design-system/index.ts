/**
 * Design System «Clay Serenity» — punto único de exportación (PWA).
 * Fuente: manual-identidad-visual.md §7 · Matriz ARIA: ESTANDAR_ACCESIBILIDAD.md §4.
 * Regla: texto SIEMPRE via i18n en el caller; estos componentes no hardcodean copy.
 */
export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';
export { Card } from './Card';
export type { CardProps } from './Card';
export { Field, Input } from './Input';
export type { FieldProps, InputProps } from './Input';
export { MoneyInput } from './MoneyInput';
export type { MoneyInputProps } from './MoneyInput';
export { Segmented } from './Segmented';
export type { SegmentedProps, SegmentedOption } from './Segmented';
export { Chip, ChipButton } from './Chip';
export type { ChipProps, ChipButtonProps, ChipTone } from './Chip';
export { Toggle } from './Toggle';
export type { ToggleProps } from './Toggle';
export { Progress } from './Progress';
export type { ProgressProps } from './Progress';
export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';
export { Toast } from './Toast';
export type { ToastProps, ToastTone } from './Toast';
export { Modal } from './Modal';
export type { ModalProps } from './Modal';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { TxRow } from './TxRow';
export type { TxRowProps } from './TxRow';
export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
export { usePrefersReducedMotion } from './usePrefersReducedMotion';
