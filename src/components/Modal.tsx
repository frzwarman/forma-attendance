import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useTheme } from "../theme";
import { X } from "./icons";

// Accessible popup: focus moves into it, Tab stays inside, Escape or the backdrop closes it.
export function Modal({
  label,
  maxWidth,
  onClose,
  children,
}: {
  label: string;
  maxWidth: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") return onClose();
    if (event.key !== "Tab") return;
    const items = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [role='button'][tabindex='0']") ?? [],
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const close: CSSProperties = {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "none",
    backgroundColor: c.surface,
    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "rgba(0, 18, 33, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          width: "100%",
          maxWidth,
          maxHeight: "100%",
          overflowY: "auto",
          backgroundColor: c.surface,
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          animation: "reveal 320ms ease-out",
        }}
      >
        <button type="button" aria-label="Tutup" onClick={onClose} style={close}>
          <X size={20} color={c.text} />
        </button>
        {children}
      </div>
    </div>
  );
}
