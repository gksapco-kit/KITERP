import { useBranch } from '@/contexts/BranchContext'

/** Branch-aware store URLs (`?branch=` preserved in per-BU template mode). */
export function useStorePath() {
  return useBranch().storePath
}
