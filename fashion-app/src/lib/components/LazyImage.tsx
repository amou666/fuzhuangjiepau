import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// ─── 本会话已加载图片追踪（解决页面切换后重挂载闪动） ───
const loadedImageUrls = new Set<string>();

interface LazyImageProps {
  src: string;
  alt: string;
  onClick?: () => void;
  className?: string;
  /** 传递给外层 wrapper div 的 className */
  wrapperClassName?: string;
  /** 额外的 img 样式（会与默认样式合并） */
  imgStyle?: React.CSSProperties;
}

export function LazyImage({ src, alt, onClick, className, wrapperClassName, imgStyle }: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const prevSrcRef = useRef(src);

  // 如果该 URL 本次会话已经加载过，直接从 loaded=true 开始
  const [loaded, setLoaded] = useState(() => loadedImageUrls.has(src));

  // src 变化时重置 loaded 状态
  if (prevSrcRef.current !== src) {
    prevSrcRef.current = src;
    const wasLoaded = loadedImageUrls.has(src);
    setLoaded(wasLoaded);
  }

  useLayoutEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
      loadedImageUrls.add(src);
    }
  }, [src]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    loadedImageUrls.add(src);
  }, [src]);

  // 已加载过的图片：跳过所有过渡，瞬间显示
  const previouslyLoaded = loadedImageUrls.has(src);

  const defaultImgStyle: React.CSSProperties = {
    opacity: loaded ? 1 : 0,
    transition: previouslyLoaded ? 'none' : 'opacity 0.3s ease, transform 0.3s ease',
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'cover',
  };

  return (
    <div className={wrapperClassName ?? 'relative w-full h-full'} style={{ minHeight: '60px' }}>
      {!loaded && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(203,213,225,0.8), rgba(248,250,252,0.9), rgba(203,213,225,0.8))',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s ease-in-out infinite',
            borderRadius: 'inherit',
          }}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={previouslyLoaded ? 'eager' : 'lazy'}
        className={className}
        style={{ ...defaultImgStyle, ...imgStyle }}
        onLoad={handleLoad}
        onClick={onClick}
      />
    </div>
  );
}
