import React, { useEffect, useState } from "react";
import { getCardImageUrl } from "./imageCache";

function CardImage({ name, fallbackSrc, alt, className, ...props }) {
  const [resolvedSrc, setResolvedSrc] = useState(fallbackSrc);

  useEffect(() => {
    let active = true;

    if (!name && !fallbackSrc) {
      setResolvedSrc(fallbackSrc);
      return () => {};
    }

    getCardImageUrl({ name, fallbackUrl: fallbackSrc })
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
