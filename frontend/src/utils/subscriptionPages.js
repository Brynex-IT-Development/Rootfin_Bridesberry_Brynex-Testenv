import { useEffect, useState } from "react";
import baseUrl from "../api/api";

// Pages the provider has hidden for this installation (set on /subscriptionadmin).
// Loaded once per page load and shared by the menu and the route guard.

const API = `${(baseUrl?.baseUrl || "").replace(/\/$/, "")}/api/subscription`;
const CACHE_KEY = "rf-subscription-hidden-pages";

// These can never be hidden
export const LOCKED_PAGES = ["/", "/manage-users/subscription"];

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

let hiddenPages = readCache();
let loadPromise = null;
const listeners = new Set();

const load = () => {
  if (!loadPromise) {
    loadPromise = fetch(API)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        hiddenPages = Array.isArray(data?.hiddenPages) ? data.hiddenPages : [];
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(hiddenPages));
        } catch {
          /* ignore */
        }
        listeners.forEach((fn) => fn(hiddenPages));
      })
      .catch(() => {}); // if the server can't be reached, hide nothing
  }
  return loadPromise;
};

/**
 * True when `path` is a hidden page or lives under one
 * (hiding "/purchase/orders" also hides "/purchase/orders/123").
 */
export const isPathHidden = (path, list = hiddenPages) => {
  if (!path || LOCKED_PAGES.includes(path)) return false;
  return list.some((p) => p !== "/" && (path === p || path.startsWith(`${p}/`)));
};

export const useHiddenPages = () => {
  const [list, setList] = useState(hiddenPages);
  useEffect(() => {
    listeners.add(setList);
    load();
    return () => listeners.delete(setList);
  }, []);
  return { hiddenPages: list, isHidden: (path) => isPathHidden(path, list) };
};
