import React, { useState, useEffect, useRef } from "react";
import { timestampLabel } from "../../shared/format.mjs";
export function Icon({ name, size = 18, ...props }) {
  const paths = {
    arrow: "M4 12h16m-6-6 6 6-6 6",
    left: "m14 5-7 7 7 7",
    right: "m10 5 7 7-7 7",
    refresh: "M20 8a8 8 0 1 0 0 8M20 3v5h-5",
    close: "m6 6 12 12M6 18 18 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    expand: "M14 3h7v7M21 3l-8 8M10 21H3v-7M3 21l8-8",
    flip: "M3 9a9 9 0 0 1 15-5l3 3M21 2v5h-5M21 15a9 9 0 0 1-15 5l-3-3M3 22v-5h5",
    external: "M14 3h7v7M21 3 10 14M10 3H3v18h18v-7",
    check: "m4 12 5 5 11-11",
    calendar: "M7 3v4M17 3v4M3 10h18M3 5h18v16H3z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
export function SafeImage({
  src,
  alt = "",
  className = "",
  fallback = "",
  ...props
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...props}
    />
  ) : (
    <span
      className={`image-fallback ${className}`}
      aria-label={alt || "Image unavailable"}
    >
      {fallback || "OS"}
    </span>
  );
}
export function Loading({ label = "Reading the hockey ledger…" }) {
  return (
    <div className="loading" role="status">
      <span className="loading-puck" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorPanel({ error, retry }) {
  return (
    <div className="error-panel" role="alert">
      <span className="eyebrow">A pause in play</span>
      <h3>We couldn’t reach the data source.</h3>
      <p>{error}</p>
      {retry && (
        <button className="button small" onClick={retry}>
          <Icon name="refresh" />
          Try again
        </button>
      )}
    </div>
  );
}
export function SourceNote({ meta, error, className = "" }) {
  if (!meta && !error) return null;
  return (
    <div
      className={`source-note ${meta?.stale || error ? "is-stale" : ""} ${className}`}
    >
      <span className="source-dot" />
      <span>
        {error
          ? "Refresh failed · displayed data may be out of date"
          : meta?.stale
            ? "Saved data · not live"
            : meta?.source || "NHL data"}
        {meta?.fetchedAt && <> · Retrieved {timestampLabel(meta.fetchedAt)}</>}
        {meta?.warning && <strong>{meta.warning}</strong>}
      </span>
    </div>
  );
}
export function PageHeading({ eyebrow, title, accent, description, children }) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>
          {title} {accent && <em>{accent}</em>}
        </h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function Modal({ children, onClose, label, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    el?.querySelector("button")?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusable = [
          ...el.querySelectorAll(
            'button,[href],input,select,textarea,[tabindex="0"]',
          ),
        ].filter((x) => !x.disabled && x.getClientRects().length);
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      before?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className="modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={ref}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close player details"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        {children}
      </section>
    </div>
  );
}
