import React, { useEffect, useState, useCallback, useRef } from "react";
import { Check, Trash2 } from "lucide-react";

/**
 * RootFin UI Kit — Standardized Confirmation & Alert Modal
 * Matches the clean rounded-20px card with centered title & description,
 * soft gray Cancel button on the left, and purple/soft-red action button on the right.
 */
export const RootfinConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmIcon = null,
  variant = "primary", // "primary" (purple) | "danger" (soft red)
  loading = false,
  hideCancel = false,
  children,
}) => {
  if (!open) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-[#FEE2E2] hover:bg-[#FECACA] text-[#EF4444]"
      : "bg-[#F2572B] hover:bg-[#D9431A] text-white shadow-[0_2px_8px_rgba(242, 87, 43,0.28)]";

  return (
    <div
      className="rf-modal-backdrop fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={loading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="rf-modal-card bg-white rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.16)] w-full max-w-[390px] px-7 py-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[18px] font-semibold text-[#1B1B1B] tracking-tight leading-snug">
          {title}
        </h2>
        {description && (
          <p className="text-[13px] text-[#6A6A6A] mt-2.5 leading-relaxed whitespace-pre-line">
            {description}
          </p>
        )}
        {children && <div className="mt-4 text-left">{children}</div>}

        <div
          className={`mt-7 flex items-center gap-3 ${
            hideCancel ? "justify-center" : "justify-between"
          }`}
        >
          {!hideCancel && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-[40px] px-5 rounded-[10px] bg-[#F4F4F5] hover:bg-[#E5E5E5] text-[#1B1B1B] text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`h-[40px] px-5 rounded-[10px] text-[13px] font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-50 ${
              hideCancel ? "min-w-[130px]" : ""
            } ${confirmClasses}`}
          >
            {confirmIcon}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────────────────
 * Global Dialog Bus (rfConfirm & rfAlert) + Global Submit Confirmation Host
 * ─────────────────────────────────────────────────────────────────────────── */
let pushDialog = null;

/**
 * Show a RootFin confirmation modal from anywhere (returns Promise<boolean>).
 */
export const rfConfirm = (optionsOrMessage) => {
  const opts =
    typeof optionsOrMessage === "string"
      ? {
          title: "Confirm Action?",
          description: optionsOrMessage,
          confirmLabel: "Confirm",
          variant: /delete|remove|reject|undo|reset/i.test(optionsOrMessage)
            ? "danger"
            : "primary",
        }
      : optionsOrMessage || {};

  return new Promise((resolve) => {
    if (!pushDialog) {
      resolve(true);
      return;
    }
    pushDialog({
      mode: "confirm",
      title: opts.title || "Confirm Action?",
      description: opts.description || "",
      cancelLabel: opts.cancelLabel || "Cancel",
      confirmLabel: opts.confirmLabel || "Confirm",
      variant: opts.variant || "primary",
      iconType: opts.iconType || (opts.variant === "danger" ? "trash" : "check"),
      resolve,
    });
  });
};

/**
 * Classify a plain alert message into a clean RootFin title & variant.
 */
const classifyAlertMessage = (rawMessage) => {
  const text = String(rawMessage ?? "").trim();
  const clean = text.replace(/^[✅❌⚠️]+\s*/, "").replace(/^Error:\s*/i, "");
  const isError =
    /^error\b|failed|unable|cannot|invalid|required|please\s+(enter|select|fill|provide|choose)|must\s+be|not\s+found|already\s+(exists|saved)/i.test(
      text
    );
  const isSuccess =
    !isError &&
    /success|recorded|created|updated|saved|deleted|marked|sent|completed|approved|received|transferred|adjusted/i.test(
      text
    );

  if (isError) {
    return {
      title: "Action Required",
      description: clean || text,
      variant: "danger",
      confirmLabel: "OK",
      iconType: "none",
    };
  }
  if (isSuccess) {
    return {
      title: "Success",
      description: clean || text,
      variant: "primary",
      confirmLabel: "OK",
      iconType: "check",
    };
  }
  return {
    title: "Notice",
    description: clean || text,
    variant: "primary",
    confirmLabel: "OK",
    iconType: "check",
  };
};

/**
 * Show a RootFin alert modal from anywhere (returns Promise<void>).
 */
export const rfAlert = (rawMessage) => {
  const parsed = classifyAlertMessage(rawMessage);
  return new Promise((resolve) => {
    if (!pushDialog) {
      resolve();
      return;
    }
    pushDialog({
      mode: "alert",
      ...parsed,
      resolve,
    });
  });
};

// Expose globally so any page can call window.rfConfirm(...) without extra imports if needed
if (typeof window !== "undefined") {
  window.rfConfirm = rfConfirm;
  window.rfAlert = rfAlert;
}

// Button labels that represent final submit/save actions when triggered via button[type="button"]
const SUBMIT_BTN_REGEX =
  /^(submit|save|save\s+changes|save\s+as\s+\w+|save\s*(&|and)\s*\w+(\s+\w+)?|save\s+(item|group|vendor|bill|order|receive|invoice|adjustment|credit|permissions|expense|income|target|user|store|customer|price\s*list)|update\s+(item|group|vendor|bill|order|receive|invoice|adjustment|credit|user|store|customer|password|profile)|create\s+(invoice|bill|order|vendor|item|group|user|store|adjustment|receive|credit)|record\s+(payment|expense|income)|close\s+day\s*book|submit\s+[\w\s]+|confirm\s*(&|and)\s*\w+|mark\s+as\s+(received|paid|open|issued|approved|transferred|adjusted)|reset\s+password)$/i;

const SKIP_FORM_BTN_REGEX = /^(login|sign\s*in|log\s*in|search|filter|apply|clear|cancel|back|close)$/i;

const formatConfirmTitle = (label) => {
  const clean = (label || "").replace(/\s+/g, " ").trim();
  if (!clean || /^submit$/i.test(clean)) return "Confirm Submission?";
  if (/^save$/i.test(clean)) return "Save Changes?";
  return `${clean}?`;
};

export const RootfinDialogHost = () => {
  const [queue, setQueue] = useState([]);
  const bypassedFormsRef = useRef(new WeakSet());
  const bypassedButtonsRef = useRef(new WeakSet());

  const enqueue = useCallback((dialog) => {
    setQueue((prev) => [...prev, dialog]);
  }, []);

  // Register global bus + override native window.alert
  useEffect(() => {
    pushDialog = enqueue;
    const originalAlert = window.alert;
    window.alert = (msg) => {
      rfAlert(msg);
    };
    window.rfConfirm = rfConfirm;
    window.rfAlert = rfAlert;

    return () => {
      pushDialog = null;
      window.alert = originalAlert;
    };
  }, [enqueue]);

  // Global capture-phase interceptor for form submits and Save/Submit buttons
  useEffect(() => {
    const isLoginRoute = () =>
      typeof window !== "undefined" &&
      (window.location.pathname === "/login" ||
        window.location.pathname.startsWith("/login/"));

    const handleFormSubmitCapture = (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (isLoginRoute()) return;
      if (form.dataset.noConfirm === "true") return;
      if (form.closest(".rf-modal-backdrop")) return;

      // Allow bypassed submission through once
      if (bypassedFormsRef.current.has(form)) {
        bypassedFormsRef.current.delete(form);
        return;
      }

      const submitter =
        e.submitter ||
        form.querySelector('button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled)');
      const label = (submitter?.textContent || submitter?.value || "Submit")
        .replace(/\s+/g, " ")
        .trim();

      if (SKIP_FORM_BTN_REGEX.test(label)) return;
      if (submitter?.dataset?.noConfirm === "true") return;

      // Let native HTML5 validation run first if form is invalid
      if (typeof form.checkValidity === "function" && !form.checkValidity()) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const isDanger = /delete|remove|reject/i.test(label);
      rfConfirm({
        title: formatConfirmTitle(label),
        description: "Are you sure you want to submit this?",
        cancelLabel: "Cancel",
        confirmLabel: label || "Submit",
        variant: isDanger ? "danger" : "primary",
        iconType: isDanger ? "trash" : "check",
      }).then((confirmed) => {
        if (!confirmed) return;
        bypassedFormsRef.current.add(form);
        if (typeof form.requestSubmit === "function") {
          try {
            if (submitter && form.contains(submitter)) {
              form.requestSubmit(submitter);
            } else {
              form.requestSubmit();
            }
            return;
          } catch {
            // Fall back to dispatchEvent below
          }
        }
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    };

    const handleButtonClickCapture = (e) => {
      if (isLoginRoute()) return;
      const btn = e.target?.closest?.("button");
      if (!btn || btn.disabled) return;
      if (btn.dataset.noConfirm === "true") return;
      // Don't intercept clicks inside any open modal or anchor link
      if (btn.closest(".rf-modal-backdrop, .fixed.inset-0, a")) return;
      // Let form submit handler handle type="submit" buttons inside forms
      const btnType = (btn.getAttribute("type") || "").toLowerCase();
      if (btn.closest("form") && (btnType === "submit" || btnType === "")) return;

      // Allow bypassed click through once
      if (bypassedButtonsRef.current.has(btn)) {
        bypassedButtonsRef.current.delete(btn);
        return;
      }

      const label = (btn.textContent || "").replace(/\s+/g, " ").trim();
      if (!label || !SUBMIT_BTN_REGEX.test(label)) return;

      e.preventDefault();
      e.stopPropagation();

      const isDanger = /delete|remove|reject/i.test(label);
      rfConfirm({
        title: formatConfirmTitle(label),
        description: "Are you sure you want to proceed with this action?",
        cancelLabel: "Cancel",
        confirmLabel: label,
        variant: isDanger ? "danger" : "primary",
        iconType: isDanger ? "trash" : "check",
      }).then((confirmed) => {
        if (!confirmed) return;
        bypassedButtonsRef.current.add(btn);
        btn.click();
      });
    };

    document.addEventListener("submit", handleFormSubmitCapture, true);
    document.addEventListener("click", handleButtonClickCapture, true);
    return () => {
      document.removeEventListener("submit", handleFormSubmitCapture, true);
      document.removeEventListener("click", handleButtonClickCapture, true);
    };
  }, []);

  const current = queue[0] || null;

  const handleClose = useCallback(() => {
    if (!current) return;
    current.resolve(current.mode === "confirm" ? false : undefined);
    setQueue((prev) => prev.slice(1));
  }, [current]);

  const handleConfirm = useCallback(() => {
    if (!current) return;
    current.resolve(current.mode === "confirm" ? true : undefined);
    setQueue((prev) => prev.slice(1));
  }, [current]);

  // Support Escape key to dismiss
  useEffect(() => {
    if (!current) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, handleClose]);

  if (!current) return null;

  const icon =
    current.iconType === "trash" ? (
      <Trash2 size={15} />
    ) : current.iconType === "check" ? (
      <Check size={15} />
    ) : null;

  return (
    <RootfinConfirmModal
      open={true}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={current.title}
      description={current.description}
      cancelLabel={current.cancelLabel || "Cancel"}
      confirmLabel={current.confirmLabel || "OK"}
      confirmIcon={icon}
      variant={current.variant || "primary"}
      hideCancel={current.mode === "alert"}
    />
  );
};

export default RootfinConfirmModal;
