import { useEffect, useRef, useState } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  onClick?: () => void;
  className?: string;
}

/**
 * 懒加载图片组件：使用 IntersectionObserver，
 * 未进入视口时显示骨架屏，进入视口后再加载真实图片。
 */
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
      { rootMargin: '100px' }, // 提前 100px 预加载
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="lazy-image-wrapper">
      {/* 骨架屏：图片加载前或未进入视口时显示 */}
      {(!inView || !loaded) && <div className="skeleton-shimmer" />}
      {inView && (
        <img
          src={src}
          alt={alt}
          className={className}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
          onLoad={() => setLoaded(true)}
          onClick={onClick}
        />
      )}
    </div>
  );
}
