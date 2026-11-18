import { Skeleton } from '@/components/ui/skeleton'

export default function LoadingShell() {
  return (
    <div className="min-h-dvh bg-background p-4 pt-8 sm:p-7" role="status" aria-label="Loading admin dashboard">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-72 max-w-[70vw]" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 w-full rounded-xl" />)}
      </div>
    </div>
  )
}
