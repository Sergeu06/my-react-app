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

  useEffect(() => {
    let active = true;

    if (!name && !fallbackSrc) {
      setResolvedSrc(fallbackSrc);
      return () => {};
    }

    const resolver = preferLocal
      ? getCardImageUrl({ name, fallbackUrl: fallbackSrc })
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
  }, [name, fallbackSrc]);

  return <img src={resolvedSrc} alt={alt} className={className} {...props} />;
}

export default CardImage;
