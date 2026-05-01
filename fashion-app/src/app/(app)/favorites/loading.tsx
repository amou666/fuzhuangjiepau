export default function FavoritesLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Header skeleton */}
      <div className="hidden md:flex md:items-center md:gap-3 md:mb-1">
        <div className="w-10 h-10 rounded-xl" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
        <div className="w-28 h-7 rounded" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-xl" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.4), rgba(248,250,252,0.6), rgba(203,213,225,0.4))', backgroundSize: '200% 100%', animation: `shimmer 1.4s ease-in-out ${i * 0.05}s infinite` }} />
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="fashion-glass rounded-2xl overflow-hidden" style={{ animation: `fade-up 0.4s ease-out ${i * 0.06}s both` }}>
            <div className="w-full aspect-[3/4]" style={{
              backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s ease-in-out infinite',
            }} />
            <div className="p-2 md:p-3 flex flex-col gap-1.5">
              <div className="w-3/4 h-3.5 rounded" style={{
                backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s ease-in-out infinite',
              }} />
              <div className="w-1/2 h-3 rounded" style={{
                backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s ease-in-out infinite',
              }} />
              <div className="w-2/5 h-2.5 rounded" style={{
                backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s ease-in-out infinite',
              }} />
              <div className="w-full h-7 rounded-lg mt-1" style={{
                backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.4), rgba(248,250,252,0.6), rgba(203,213,225,0.4))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s ease-in-out infinite',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
