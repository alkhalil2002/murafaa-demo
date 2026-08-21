/**
 * Murafaa UI library.
 *
 * Structure mirrors Alkhalil's `packages/ui` so the two products are built the
 * same way; the palette and the signature marks are Murafaa's own.
 *
 * Prefer these over new bespoke classes in globals.css. The legacy stylesheet
 * still owns the existing screens and is not being rewritten — new surfaces
 * should be built from here.
 */
export { cn, type ClassValue } from './cn';
export { variants, type VariantProps } from './variants';

export { Button, buttonVariants, type ButtonProps } from './Button';
export { Card, CardHeader, CardTitle, CardBody, CardFooter, type CardProps } from './Card';
export { Badge, badgeVariants, type BadgeProps, type BadgeTone } from './Badge';
export {
  Input,
  Textarea,
  Label,
  Field,
  type InputProps,
  type TextareaProps,
  type LabelProps,
  type FieldProps,
} from './Input';
export { Checkbox, type CheckboxProps } from './Checkbox';

export { SealMark, ScaleMark, GoldRule, FrameCorners } from './marks';
export type { GoldRuleProps, FrameCornersProps } from './marks';

export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorAlert, type ErrorAlertProps } from './ErrorAlert';
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { ToastProvider, useToast, type Toast, type ToastTone } from './Toast';
export { PermissionGate, type PermissionGateProps } from './PermissionGate';
