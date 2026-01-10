import React from "react";
import "../App.css";

function GlobalLoader() {
  return (
    <div className="global-loader">
      <div className="global-loader__spinner" />
      <div className="global-loader__text">
        Загружаем и кэшируем ресурсы...
      </div>
    </div>
  );
}

export default GlobalLoader;
