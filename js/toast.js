// ============================================================================
// toast.js — notificaciones breves de confirmación/error
// ============================================================================

const stack = document.getElementById("toastStack");

export function showToast(message, { type = "success" } = {}) {
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " toast--error" : ""}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.2s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 2600);
}
