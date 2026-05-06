/** Immediate skeleton shown during soft navigations while segment chunks load */
export default function RouteSegmentLoading() {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center bg-gray-50 px-4">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900"
        aria-label="Loading"
      />
    </div>
  )
}
