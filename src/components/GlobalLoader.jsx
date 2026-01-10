import React from "react";
import "../App.css";

function GlobalLoader({ loaded = 0, total = 0 }) {
  const percent =
    total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div className="global-loader">
      <div className="global-loader__spinner" />
      <div className="global-loader__text">
        Загружаем и кэшируем ресурсы...
      </div>
      <div className="global-loader__progress">
        <div
          className="global-loader__progress-bar"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="global-loader__progress-text">
        {loaded}/{total || "—"} • {percent}%
      </div>
    </div>
  );
}

export default GlobalLoader;
