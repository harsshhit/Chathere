import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";

export function ScreenHeader({ title, action, children }) {
  return <header className="screen-header safe-top">
    {children}
    {title && <h1>{title}</h1>}
    {action}
  </header>;
}

export function Section({ title, children }) {
  return <section className="ui-section">
    {title && <h2>{title}</h2>}
    {children}
  </section>;
}

export function SettingsGroup({ children, className = "" }) {
  return <div className={`settings-group card ${className}`}>{children}</div>;
}

export function SettingsRow({
  icon: Icon, label, value, onClick, danger = false, control, children, chevron = true, className = "",
}) {
  const content = <>
    {Icon && <Icon size={20} aria-hidden="true" />}
    <span className="settings-row-label">{label}</span>
    {value && <span className="settings-row-value">{value}</span>}
    {control}
    {children}
    {onClick && chevron && !control && <ChevronRight size={17} aria-hidden="true" />}
  </>;
  const classNames = `settings-row row ${danger ? "is-danger" : ""} ${className}`;
  return onClick
    ? <button type="button" className={classNames} onClick={onClick}>{content}</button>
    : <div className={classNames}>{content}</div>;
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="toggle"
  />;
}

export function Segmented({ value, options, onChange, label }) {
  const reduceMotion = useReducedMotion();
  const onKeyDown = (event) => {
    const currentIndex = options.findIndex((option) => option.value === value);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else return;
    event.preventDefault();
    onChange(options[nextIndex].value);
    event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll('[role="radio"]')[nextIndex]?.focus();
  };
  return <div className="segmented" role="radiogroup" aria-label={label}>
    {options.map((option) => <button
      type="button"
      role="radio"
      aria-checked={value === option.value}
      key={option.value}
      tabIndex={value === option.value ? 0 : -1}
      onClick={() => onChange(option.value)}
      onKeyDown={onKeyDown}
      className={`segmented-option ${value === option.value ? "is-active" : ""}`}
    >
      {value === option.value && <motion.span layoutId={`segmented-${label}`} className="segmented-active-pill" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 30 }} />}
      <span className="relative z-[1]">{option.label}</span>
    </button>)}
  </div>;
}

export function StatCard({ label, value }) {
  return <div className="stat-card card">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>;
}

export function Sheet({ open, onClose, title, children }) {
  const reduceMotion = useReducedMotion();
  const sheetRef = useRef(null);
  const startY = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    sheetRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key === "Tab" && sheetRef.current) {
        const items = sheetRef.current.querySelectorAll("button:not([disabled]), a[href], input, textarea, select");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previous?.focus?.();
    };
  }, [open]);
  return <AnimatePresence>
    {open && <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onCloseRef.current()}>
      <motion.section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet glass"
        initial={reduceMotion ? false : { y: "100%" }}
        animate={{ y: 0 }}
        exit={reduceMotion ? undefined : { y: "100%" }}
        transition={{ duration: reduceMotion ? 0 : .2 }}
        onTouchStart={(event) => { startY.current = event.touches[0].clientY; }}
        onTouchEnd={(event) => {
          if (startY.current !== null && event.changedTouches[0].clientY - startY.current > 80) onCloseRef.current();
          startY.current = null;
        }}
      >
        <div className="sheet-handle" />
        <header><h2>{title}</h2><button type="button" className="icon-btn-glass min-h-11 min-w-11" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        {children}
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
