// react-dom is installed for the web build but without its types; the app only uses createPortal
// (src/components/Modal.tsx).
declare module "react-dom" {
  import type { ReactNode, ReactPortal } from "react";
  export function createPortal(children: ReactNode, container: Element | DocumentFragment): ReactPortal;
}
