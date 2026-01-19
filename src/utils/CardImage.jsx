import React, { useEffect, useState } from "react";
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
  }, [name, fallbackSrc, preferLocal]);

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
      {...props}
    />
  );
}

export default CardImage;
