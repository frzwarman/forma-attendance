import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { View } from "react-native";
import { FONT_STACK, useTheme } from "../theme";
import { useInputStyle } from "./NativeInput";
import { T } from "./ui";

export type DropdownOption = { value: string; label: string };

// Our own list instead of the system's: a button that opens the choices right under it, styled like the
// other inputs. Keyboard: Enter, Space or the arrows open it, the arrows move, Enter picks, Escape closes;
// a click outside, a scroll or a resize closes it. Focus stays on the button, so it reads as one control.
// The list is rendered into <body> at the button's position, so no card can clip it.
export function Dropdown({
  label,
  value,
  options,
  onChange,
  width = 200,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  width?: number;
}) {
  const c = useTheme();
  const style = useInputStyle();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0, width: 0 });
  const current = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [active, setActive] = useState(current);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", outside);
    window.addEventListener("resize", close);
    // Scrolling anywhere (the admin page scrolls inside a container, not the window) moves the button away.
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function show() {
    const rect = root.current?.getBoundingClientRect();
    if (rect) setAt({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setActive(current);
    setOpen(true);
  }
  function pick(index: number) {
    onChange(options[index].value);
    setOpen(false);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === "ArrowDown") setActive((i) => Math.min(options.length - 1, i + 1));
    else if (event.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (event.key === "Enter" || event.key === " ") pick(active);
    else if (event.key === "Escape" || event.key === "Tab") setOpen(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
  }

  const chosen = options[current];
  return (
    <View style={{ gap: 7, width }}>
      <T size={14} weight="semibold">
        {label}
      </T>
      <div ref={root} style={{ position: "relative" }} onKeyDown={onKeyDown}>
        <button
          type="button"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => (open ? setOpen(false) : show())}
          style={{
            ...style,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            textAlign: "left",
            cursor: "pointer",
            color: value ? c.text : c.muted,
            borderColor: open ? c.accent : c.border,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chosen?.label ?? ""}</span>
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={c.muted}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open &&
          createPortal(
            <ul
              ref={list}
              id={id}
              role="listbox"
              aria-label={label}
              aria-activedescendant={`${id}-${active}`}
              onKeyDown={onKeyDown}
              style={{
                position: "fixed",
                top: at.top,
                left: at.left,
                minWidth: at.width,
                maxHeight: 280,
                overflowY: "auto",
                margin: 0,
                padding: 6,
                listStyle: "none",
                zIndex: 1100,
                backgroundColor: c.surface,
                border: `1px solid ${c.border}`,
                borderRadius: 12,
                boxShadow: "0 18px 40px rgba(0, 18, 33, 0.18)",
                fontFamily: FONT_STACK,
              }}
            >
              {options.map((option, i) => {
                const selected = i === current;
                return (
                  <li
                    key={option.value || "__blank"}
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(i)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: selected ? 700 : 500,
                      color: option.value ? c.text : c.muted,
                      backgroundColor: i === active ? c.accentSoft : "transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    {option.label}
                    {selected && (
                      <svg
                        width={16}
                        height={16}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={c.accent}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )}
      </div>
    </View>
  );
}
