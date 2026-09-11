import DOMMatrix from "dommatrix"

if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrix as any
}