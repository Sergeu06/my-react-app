import React, { useEffect, useRef, useState } from "react";
import { getCachedImageUrl, getCardImageUrl } from "./imageCache";

function CardImage({
  name,
  fallbackSrc,
  preferLocal = true,
  alt,
  className,
  ...props
}) {
  const [resolvedSrc, setResolvedSrc] = useState(fallbackSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [preferredSize, setPreferredSize] = useState(null);
  const imageRef = useRef(null);

  useEffect(() => {
    if (!imageRef.current) return () => {};

    const updatePreferredSize = () => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect?.width) return;
      const dpr = window.devicePixelRatio || 1;
      const target = rect.width * dpr;
      if (target <= 260) {
        setPreferredSize(256);
      } else if (target <= 600) {
        setPreferredSize(512);
      } else {
        setPreferredSize(1024);
      }
    };

    updatePreferredSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePreferredSize);
      return () => {
        window.removeEventListener("resize", updatePreferredSize);
      };
    }

    const observer = new ResizeObserver(() => updatePreferredSize());
    observer.observe(imageRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    if (!name && !fallbackSrc) {
      setResolvedSrc(fallbackSrc);
      setIsLoaded(false);
      return () => {};
    }

    const resolver = preferLocal
      ? getCardImageUrl({
          name,
          fallbackUrl: fallbackSrc,
        })
      : getCachedImageUrl(fallbackSrc);

    Promise.resolve(resolver)
      .then((url) => {
        if (!active) return;
        setResolvedSrc(url || fallbackSrc);
      })
      .catch(() => setResolvedSrc(fallbackSrc));

    return () => {
      active = false;
    };
  }, [name, fallbackSrc, preferLocal, preferredSize]);

  useEffect(() => {
    let active = true;

    if (!resolvedSrc) {
      setIsLoaded(false);
      return () => {};
    }

    setIsLoaded(false);
    const img = new Image();
    img.src = resolvedSrc;

    const finish = () => {
      if (!active) return;
      setIsLoaded(true);
    };

    if (img.decode) {
      img.decode().then(finish).catch(finish);
    } else {
      img.onload = finish;
      img.onerror = finish;
    }

    return () => {
      active = false;
    };
  }, [resolvedSrc]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      data-loaded={isLoaded}
      decoding="async"
      ref={imageRef}
      {...props}
    />
  );
}

export default CardImage;
