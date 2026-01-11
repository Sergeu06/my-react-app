import React, { useEffect, useState } from "react";
import { getCachedImageUrl } from "./imageCache";

function CachedImage({ src, alt, className, ...props }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let active = true;

    if (!src) {
      setResolvedSrc(src);
      return () => {};
    }

    getCachedImageUrl(src)
      .then((url) => {
        if (!active) return;
        setResolvedSrc(url || src);
      })
      .catch(() => setResolvedSrc(src));

    return () => {
      active = false;
    };
  }, [src]);

  return <img src={resolvedSrc} alt={alt} className={className} {...props} />;
}

export default CachedImage;
