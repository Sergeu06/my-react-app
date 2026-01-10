import React, { useEffect, useState } from "react";
import { getCachedImageUrl } from "./imageCache";

function CachedImage({ src, alt, className, ...props }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    if (!src) {
      setResolvedSrc(src);
      return () => {};
    }

    getCachedImageUrl(src)
      .then((url) => {
        if (!active) {
          if (url && url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
          return;
        }
        if (url && url.startsWith("blob:")) {
          objectUrl = url;
        }
        setResolvedSrc(url || src);
      })
      .catch(() => setResolvedSrc(src));

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  return <img src={resolvedSrc} alt={alt} className={className} {...props} />;
}

export default CachedImage;
