export default function HistoryLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Header skeleton */}
      <div className="hidden md:flex md:items-center md:gap-3 md:mb-1">
        <div className="w-10 h-10 rounded-xl" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
        <div className="w-28 h-7 rounded" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="fashion-glass rounded-2xl p-3 md:p-5" style={{ animation: `fade-up 0.4s ease-out ${i * 0.06}s both` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-20 h-6 rounded-full" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div className="w-16 h-5 rounded-full" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div className="w-24 h-4 rounded-full ml-auto" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            </div>
            <div className="w-3/4 h-4 rounded mb-3" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            <div className="flex gap-3 mb-3">
              <div className="w-[110px] h-[80px] rounded-xl shrink-0" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div className="flex-1 flex gap-2">
                <div className="w-16 h-[80px] rounded-[10px]" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
                <div className="w-16 h-[80px] rounded-[10px]" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.6), rgba(248,250,252,0.8), rgba(203,213,225,0.6))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              </div>
            </div>
            <div className="w-full h-8 rounded-lg" style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.4), rgba(248,250,252,0.6), rgba(203,213,225,0.4))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
