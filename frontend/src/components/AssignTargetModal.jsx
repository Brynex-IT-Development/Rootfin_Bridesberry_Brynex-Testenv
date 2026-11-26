/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Target, X } from "lucide-react";
import baseUrl from "../api/api";
import { baseExpenseCats } from "../config/expenseCategories";

import AppSelect from "./AppSelect.jsx";
const API_ROOT = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

export default function AssignTargetModal({ open, onClose, stores = [], defaultStoreCode, onSaved }) {
  const [storeCode, setStoreCode] = useState(defaultStoreCode || "");
  const [category, setCategory] = useState(baseExpenseCats[0].value);
  const [subCategory, setSubCategory] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedCategory = useMemo(
    () => baseExpenseCats.find((item) => item.value === category) || baseExpenseCats[0],
    [category]
  );

  useEffect(() => {
    if (!open) return;
    setStoreCode(defaultStoreCode || stores?.[0]?.locCode || "");
    setMessage("");
  }, [open, defaultStoreCode, stores]);

  useEffect(() => {
    if (!open || !storeCode || !category) return;
    const controller = new AbortController();
    const loadTarget = async () => {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ storeCode, category, subCategory });
        const response = await fetch(`${API_ROOT}/api/expense-targets?${params}`, {
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || "Unable to load limit");
        setExisting(Boolean(json.data));
        setTargetAmount(json.data?.targetAmount ?? "");
      } catch (error) {
        if (error.name !== "AbortError") setMessage(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadTarget();
    return () => controller.abort();
  }, [open, storeCode, category, subCategory]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!storeCode || targetAmount === "" || Number(targetAmount) < 0) {
      setMessage("Select a store and enter a valid limit amount.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${API_ROOT}/api/expense-targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeCode, category, subCategory, targetAmount: Number(targetAmount) }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Unable to save limit");
      setExisting(true);
      setMessage("Expense limit saved successfully.");
      onSaved?.(json.data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Target size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Set Expense Limit</h2>
              <p className="text-xs text-slate-500">The limit repeats every month.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Store
              <AppSelect value={storeCode} onChange={(event) => setStoreCode(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium normal-case text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100">
                {stores.map((store) => <option key={store.locCode} value={store.locCode}>{store.locName}</option>)}
              </AppSelect>
            </label>
            <label className="space-y-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Category
              <AppSelect value={category} onChange={(event) => { setCategory(event.target.value); setSubCategory(""); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium normal-case text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100">
                {baseExpenseCats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </AppSelect>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Subcategory
              <AppSelect value={subCategory} onChange={(event) => setSubCategory(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium normal-case text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100">
                <option value="">All subcategories</option>
                {(selectedCategory.subs || []).map((item) => <option key={item} value={item}>{item}</option>)}
              </AppSelect>
            </label>
            <label className="space-y-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Monthly Limit
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₹</span>
                <input type="number" min="0" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} className="w-full rounded-lg border border-slate-300 py-2.5 pl-8 pr-3 text-sm font-semibold normal-case text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" placeholder="0.00" />
                {loading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-purple-600" />}
              </div>
            </label>
          </div>

          <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
            <span className={existing ? "rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700" : "text-slate-400"}>
              {existing ? "Existing limit found" : "New limit"}
            </span>
            {message && <span className={message.includes("successfully") ? "font-medium text-emerald-600" : "font-medium text-rose-600"}>{message}</span>}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-[#0a142f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {existing ? "Update Limit" : "Save Limit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
