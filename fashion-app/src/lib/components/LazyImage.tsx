import { useEffect, useRef, useState } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  onClick?: () => void;
  className?: string;
}

export function LazyImage({ src, alt, onClick, className }: LazyImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-full h-full" style={{ minHeight: '60px' }}>
      {(!inView || !loaded) && (
        <div
          className="w-full bg-gradient-to-r from-slate-200/80 via-slate-50/90 to-slate-200/80 animate-[shimmer_1.4s_ease-in-out_infinite]"
          style={{ backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.8), rgba(248,250,252,0.9), rgba(203,213,225,0.8))', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: 'inherit', minHeight: '60px' }}
        />
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          className={className}
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'cover',
          }}
          onLoad={() => setLoaded(true)}
          onClick={onClick}
        />
      )}
    </div>
  );
}
