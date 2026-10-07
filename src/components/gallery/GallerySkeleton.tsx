export function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-card border border-line bg-surface motion-reduce:animate-none"
        >
          <div className="h-40 w-full bg-elevated" />
          <div className="p-4">
            <div className="h-4 w-3/4 rounded bg-line" />
            <div className="mt-3 h-3 w-full rounded bg-elevated" />
            <div className="mt-2 h-3 w-2/3 rounded bg-elevated" />
            <div className="mt-4 flex gap-2">
              <div className="h-5 w-12 rounded-full bg-line" />
              <div className="h-5 w-16 rounded-full bg-line" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
