export function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="mb-3 h-40 rounded bg-gray-200" />
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-full rounded bg-gray-100" />
          <div className="mt-1 h-3 w-2/3 rounded bg-gray-100" />
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-12 rounded-full bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
