import { Loader2 } from 'lucide-react'

export function Loading({ text }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      {text && <p className="mt-2 text-sm text-gray-500">{text}</p>}
    </div>
  )
}

export function PageLoading() {
  return <div className="min-h-screen flex items-center justify-center"><Loading text="Loading..." /></div>
}
