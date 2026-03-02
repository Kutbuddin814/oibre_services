/**
 * Oibre Toast - Enhanced & Visually Appealing Toast Notifications
 */

let toastRoot = null;

// Icon mappings for each toast type
const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
};

const ensureToastRoot = () => {
  if (typeof document === "undefined") return null;
  if (toastRoot && document.body.contains(toastRoot)) return toastRoot;

  toastRoot = document.createElement("div");
  toastRoot.className = "oibre-toast-root";
  document.body.appendChild(toastRoot);
  return toastRoot;
};

export const showToast = (message, options = {}) => {
  const text = String(message || "").trim();
  if (!text) return;

  const root = ensureToastRoot();
  if (!root) return;

  const type = options.type || "info";
  const duration = Number(options.duration) > 0 ? Number(options.duration) : 3500;
  const icon = options.icon || TOAST_ICONS[type] || TOAST_ICONS.info;

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `oibre-toast oibre-toast--${type}`;
  toast.setAttribute("role", "alert");
  
  // Add icon
  const iconSpan = document.createElement("span");
  iconSpan.className = "oibre-toast-icon";
  iconSpan.textContent = icon;
  
  // Add content
  const contentSpan = document.createElement("span");
  contentSpan.className = "oibre-toast-content";
  contentSpan.textContent = text;
  
  // Add progress bar
  const progressBar = document.createElement("div");
  progressBar.className = "oibre-toast-progress";
  progressBar.style.animationDuration = `${duration}ms`;

  toast.appendChild(iconSpan);
  toast.appendChild(contentSpan);
  toast.appendChild(progressBar);
  root.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto-dismiss
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
};

// Convenience methods for different toast types
export const toast = {
  success: (message, options = {}) => 
    showToast(message, { ...options, type: 'success' }),
  
  error: (message, options = {}) => 
    showToast(message, { ...options, type: 'error' }),
  
  warning: (message, options = {}) => 
    showToast(message, { ...options, type: 'warning' }),
  
  info: (message, options = {}) => 
    showToast(message, { ...options, type: 'info' }),
};

export const installAlertToasts = () => {
  if (typeof window === "undefined") return;
  if (window.__oibreAlertToastInstalled) return;

  window.__oibreToast = showToast;
  window.__oibreToast.success = toast.success;
  window.__oibreToast.error = toast.error;
  window.__oibreToast.warning = toast.warning;
  window.__oibreToast.info = toast.info;

  // Override native alert
  window.alert = (message) => {
    showToast(message, { type: "info" });
  };

  window.__oibreAlertToastInstalled = true;
};

export default showToast;
