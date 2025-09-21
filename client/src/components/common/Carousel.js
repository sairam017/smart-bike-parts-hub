import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Simple, dependency-free carousel
 * Props:
 * - items: any[]
 * - renderItem: (item, index) => JSX
 * - autoPlayMs: number (default 3000)
 * - showDots: boolean
 * - showArrows: boolean
 */
export default function Carousel({
  items = [],
  renderItem,
  autoPlayMs = 3000,
  showDots = true,
  showArrows = true,
  className = '',
  ariaLabel = 'Carousel'
}) {
  const len = items?.length || 0;
  const [index, setIndex] = useState(0);
  const timer = useRef(null);
  const canAuto = useMemo(() => len > 1 && autoPlayMs > 0, [len, autoPlayMs]);

  const go = (to) => {
    if (!len) return;
    setIndex(((to % len) + len) % len);
  };

  useEffect(() => {
    if (!canAuto) return;
    timer.current && clearInterval(timer.current);
    timer.current = setInterval(() => go(index + 1), autoPlayMs);
    return () => timer.current && clearInterval(timer.current);
  }, [index, autoPlayMs, canAuto, go]);

  const pause = () => timer.current && clearInterval(timer.current);
  const resume = () => {
    if (!canAuto) return;
    // Kick autoplay by advancing once; effect will recreate the interval
    go(index + 1);
  };

  return (
    <div
      className={`carousel ${className}`}
      role="region"
      aria-label={ariaLabel}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((item, i) => (
          <div className="carousel-slide" key={item._id || i}>
            {renderItem ? renderItem(item, i) : null}
          </div>
        ))}
      </div>
      {showArrows && len > 1 && (
        <>
          <button className="carousel-arrow left" aria-label="Previous" onClick={() => go(index - 1)}>‹</button>
          <button className="carousel-arrow right" aria-label="Next" onClick={() => go(index + 1)}>›</button>
        </>
      )}
      {showDots && len > 1 && (
        <div className="carousel-dots">
          {items.map((_, i) => (
            <button key={i} className={`dot ${i === index ? 'active' : ''}`} aria-label={`Go to slide ${i + 1}`} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
