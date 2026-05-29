import { SectionHeading } from '../builder/SectionHeading'
import {
  SKELETON_LINE_WIDTHS,
  SKELETON_LOADER_DEFAULTS,
  SKELETON_ROUNDED_CLASS,
} from '../../lib/skeletonLoaderDefaults'
import type { Block } from '../../types/builder'

interface SkeletonLoaderBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
}

function boneClass(animation: string, rounded: keyof typeof SKELETON_ROUNDED_CLASS) {
  const round = SKELETON_ROUNDED_CLASS[rounded]
  if (animation === 'none') {
    return `bg-gray-200 dark:bg-gray-700 ${round}`
  }
  if (animation === 'pulse') {
    return `animate-pulse bg-gray-200 dark:bg-gray-700 ${round}`
  }
  return `bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.6s_ease-in-out_infinite] dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 ${round}`
}

function Bone({
  className = '',
  animation,
  rounded,
}: {
  className?: string
  animation: string
  rounded: keyof typeof SKELETON_ROUNDED_CLASS
}) {
  return <div className={`${boneClass(animation, rounded)} ${className}`} aria-hidden />
}

function TextSkeleton({
  lineCount,
  animation,
  rounded,
}: {
  lineCount: number
  animation: string
  rounded: keyof typeof SKELETON_ROUNDED_CLASS
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/50">
        <Bone className="mb-4 h-5 w-2/5" animation={animation} rounded={rounded} />
        {Array.from({ length: lineCount }).map((_, i) => (
          <Bone
            key={i}
            className={`h-3 ${SKELETON_LINE_WIDTHS[i % SKELETON_LINE_WIDTHS.length]}`}
            animation={animation}
            rounded={rounded}
          />
        ))}
    </div>
  )
}

function CardSkeleton({
  animation,
  rounded,
}: {
  animation: string
  rounded: keyof typeof SKELETON_ROUNDED_CLASS
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-900/50">
      <Bone className="aspect-[4/3] rounded-none" animation={animation} rounded={rounded} />
      <div className="space-y-3 p-4">
        <Bone className="h-4 w-3/4" animation={animation} rounded={rounded} />
        <Bone className="h-3 w-full" animation={animation} rounded={rounded} />
        <Bone className="h-3 w-2/3" animation={animation} rounded={rounded} />
        <div className="flex gap-2 pt-1">
          <Bone className="h-8 w-20" animation={animation} rounded={rounded} />
          <Bone className="h-8 w-16" animation={animation} rounded={rounded} />
        </div>
      </div>
    </div>
  )
}

function ProfileSkeleton({
  animation,
  rounded,
}: {
  animation: string
  rounded: keyof typeof SKELETON_ROUNDED_CLASS
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/50">
      <Bone className="h-16 w-16 shrink-0 rounded-full" animation={animation} rounded="lg" />
      <div className="min-w-0 flex-1 space-y-3">
        <Bone className="h-4 w-1/3" animation={animation} rounded={rounded} />
        <Bone className="h-3 w-full" animation={animation} rounded={rounded} />
        <Bone className="h-3 w-4/5" animation={animation} rounded={rounded} />
      </div>
    </div>
  )
}

function ListRowSkeleton({
  animation,
  rounded,
}: {
  animation: string
  rounded: keyof typeof SKELETON_ROUNDED_CLASS
}) {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-4 last:border-0 dark:border-gray-800">
      <Bone className="h-11 w-11 shrink-0 rounded-full" animation={animation} rounded="lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bone className="h-3.5 w-2/5" animation={animation} rounded={rounded} />
        <Bone className="h-3 w-full" animation={animation} rounded={rounded} />
      </div>
      <Bone className="hidden h-8 w-16 sm:block" animation={animation} rounded={rounded} />
    </div>
  )
}

function ListSkeleton({
  rowCount,
  animation,
  rounded,
}: {
  rowCount: number
  animation: string
  rounded: keyof typeof SKELETON_ROUNDED_CLASS
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 dark:border-gray-700 dark:bg-gray-900/50 sm:px-6">
      {Array.from({ length: rowCount }).map((_, i) => (
        <ListRowSkeleton key={i} animation={animation} rounded={rounded} />
      ))}
    </div>
  )
}

function GridSkeleton({
  rows,
  columns,
  animation,
  rounded,
}: {
  rows: number
  columns: number
  animation: string
  rounded: keyof typeof SKELETON_ROUNDED_CLASS
}) {
  const colClass =
    columns <= 1
      ? 'grid-cols-1'
      : columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  const total = Math.min(12, Math.max(1, rows * columns))

  return (
    <div className={`grid gap-4 sm:gap-5 ${colClass}`}>
      {Array.from({ length: total }).map((_, i) => (
        <CardSkeleton key={i} animation={animation} rounded={rounded} />
      ))}
    </div>
  )
}

export function SkeletonLoaderBlock({ block, layoutStyle }: SkeletonLoaderBlockProps) {
  const { props, styles } = block
  const layout = props.skeletonLoaderLayout ?? SKELETON_LOADER_DEFAULTS.skeletonLoaderLayout
  const animation = props.skeletonAnimation ?? SKELETON_LOADER_DEFAULTS.skeletonAnimation
  const rounded = props.skeletonRounded ?? SKELETON_LOADER_DEFAULTS.skeletonRounded
  const lineCount = props.skeletonLineCount ?? SKELETON_LOADER_DEFAULTS.skeletonLineCount
  const rowCount = props.skeletonRowCount ?? SKELETON_LOADER_DEFAULTS.skeletonRowCount
  const columnCount = props.skeletonColumnCount ?? SKELETON_LOADER_DEFAULTS.skeletonColumnCount

  return (
    <section style={layoutStyle} className="w-full">
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />
      )}

      {layout === 'text' ? (
        <TextSkeleton lineCount={lineCount} animation={animation} rounded={rounded} />
      ) : layout === 'profile' ? (
        <ProfileSkeleton animation={animation} rounded={rounded} />
      ) : layout === 'list' ? (
        <ListSkeleton rowCount={rowCount} animation={animation} rounded={rounded} />
      ) : layout === 'grid' ? (
        <GridSkeleton rows={rowCount} animation={animation} rounded={rounded} columns={columnCount} />
      ) : (
        <CardSkeleton animation={animation} rounded={rounded} />
      )}
    </section>
  )
}
