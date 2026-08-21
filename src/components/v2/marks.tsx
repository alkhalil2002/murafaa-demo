/**
 * Re-export shim.
 *
 * These marks now live in the shared UI library (`@/components/ui/marks`) so
 * the v1, v2 and v3 shells draw from one source. This file stays so existing
 * imports keep resolving — prefer importing from `@/components/ui` in new code.
 */
export { SealMark, ScaleMark } from '@/components/ui/marks';
