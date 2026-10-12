/**
 * Skeleton — shimmer de carga (manual SSOT §7.5). Decorativo: aria-hidden.
 */
export interface SkeletonProps {
  width?: number | string;
  height?: number;
}

export function Skeleton({ width = '100%', height = 16 }: SkeletonProps) {
  return <div className="ds-skeleton" aria-hidden="true" style={{ width, height }} />;
}
