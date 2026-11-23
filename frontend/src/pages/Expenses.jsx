import { useEffect, useMemo, useState } from "react";
import SingleImageUpload from "../components/SingleImageUpload";
import AssignTargetModal from "../components/AssignTargetModal.jsx";
import baseUrl from "../api/api";
import { BsBank2 } from "react-icons/bs";
import { MdCurrencyRupee } from "react-icons/md";
import { ChevronDown, Loader2, Menu } from "lucide-react";
import { Helmet } from "react-helmet";
import { useSidebar } from "../hooks/useSidebar.js";
import { baseExpenseCats } from "../config/expenseCategories.js";
import { useActiveStores } from "../utils/storeService.js";

const currentDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getPreferredStoreCode = (user, stores = []) => {
  const code = String(user.locCode || "").trim();
  if (stores.some((store) => store.locCode === code)) return code;
  return code || stores[0]?.locCode || "";
};

const Expenses = () => {
  const isSidebarOpen = useSidebar();
  const currentusers = useMemo(
    () => JSON.parse(localStorage.getItem("rootfinuser")) || {},
    []
  );
  const { stores, loading: storesLoading } = useActiveStores();
  const role = String(currentusers.role || "").toLowerCase();
  const power = String(currentusers.power || "").toLowerCase();
  const canSelectStore = power === "admin" || ["admin", "superadmin", "financial_head", "cluster_manager"].includes(role);
  // Store logins: no Refund category, cash-only payment
  const isStoreLogin = !canSelectStore;
  const cats = useMemo(
    () => (isStoreLogin ? baseExpenseCats.filter((c) => c.value !== "other expenses") : baseExpenseCats),
    [isStoreLogin]
  );
  const canSetLimits = power === "admin" || ["admin", "superadmin", "financial_head"].includes(role);
  const allowedStores = useMemo(() => {
    if (role !== "cluster_manager") return stores;
    const allowed = new Set((currentusers.allowedLocCodes || []).map(String));
    return stores.filter((store) => allowed.has(store.locCode));
  }, [currentusers.allowedLocCodes, role, stores]);

  const [selectedCategory, setSelectedCategory] = useState(cats[0]);
  const [selectedStore, setSelectedStore] = useState(() => getPreferredStoreCode(currentusers));
  const [subCategory, setSubCategory] = useState(cats[0]?.subs?.[0] || "");
  const [expenseType, setExpenseType] = useState("indirect");
  const [date, setDate] = useState(currentDate());
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [splitPayment, setSplitPayment] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const preferred = getPreferredStoreCode(currentusers, allowedStores);
    if (preferred && (!selectedStore || !allowedStores.some((store) => store.locCode === selectedStore))) {
      setSelectedStore(preferred);
    }
  }, [allowedStores, currentusers, selectedStore]);

  const handleCategoryChange = (val) => {
    const cat = cats.find((c) => c.value === val);
    if (!cat) return;
    const defaultSubCategory = cat.subs?.[0] || "";
    setSelectedCategory(cat);
    if (cat.value === "bulk amount transfer") {
      setPaymentMethod("cash");
      setSplitPayment(false);
    }
    setSubCategory(defaultSubCategory);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback("");
    if (splitPayment) {
      const total =
        parseFloat(cashAmount || 0) + parseFloat(bankAmount || 0) + parseFloat(upiAmount || 0);
      if (Math.abs(total - parseFloat(amount || 0)) > 0.01) {
        alert("Sum of cash, bank, and UPI must equal the total amount.");
        setIsSubmitting(false);
        return;
      }
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount.");
      setIsSubmitting(false);
      return;
    }
    if (!remark.trim()) {
      alert("Please enter a remark.");
      setIsSubmitting(false);
      return;
    }
    if (!attachmentFile) {
      alert("Attachment is required for Expense.");
      setIsSubmitting(false);
      return;
    }

    const effectiveStoreCode = canSelectStore
      ? selectedStore
      : getPreferredStoreCode(currentusers, allowedStores);
    if (!effectiveStoreCode) {
      alert("Please select a store location.");
      setIsSubmitting(false);
      return;
    }

    const data = {
      type: "expense",
      category: selectedCategory.value,
      subCategory: subCategory || undefined,
      expenseType,
      entryType: canSetLimits ? "accountant_entry" : "branch_entry",
      remark,
      locCode: effectiveStoreCode,
      isAdminLevel: canSetLimits,
      amount: `-${amount}`,
      cash: splitPayment ? `-${cashAmount || "0"}` : paymentMethod === "cash" ? `-${amount}` : "0",
      bank: splitPayment ? `-${bankAmount || "0"}` : paymentMethod === "bank" ? `-${amount}` : "0",
      upi:  splitPayment ? `-${upiAmount  || "0"}` : paymentMethod === "upi"  ? `-${amount}` : "0",
      paymentMethod: splitPayment ? "split" : paymentMethod,
      date,
      attachment: attachmentFile?.base64 || null,
    };

    try {
      const res = await fetch(`${baseUrl.baseUrl}user/createPayment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        alert("Error: " + (json?.message || "Unknown error"));
      } else {
        setFeedback(`Expense ${json.invoiceNo || ""} recorded successfully.`.trim());
        setAmount("");
        setCashAmount("");
        setBankAmount("");
        setUpiAmount("");
        setRemark("");
        setAttachmentFile(null);
        setSubCategory(selectedCategory.subs?.[0] || "");
      }
    } catch {
      alert("Failed to create transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setAmount("");
    setRemark("");
    setAttachmentFile(null);
    setSubCategory(cats[0]?.subs?.[0] || "");
    setCashAmount("");
    setBankAmount("");
    setUpiAmount("");
    setPaymentMethod("cash");
    setSplitPayment(false);
    setSelectedCategory(cats[0]);
    setExpenseType("indirect");
    setDate(currentDate());
    setFeedback("");
  };

  return (
    <div
      className={`min-h-screen bg-[#f1f4ff] transition-all duration-300 ${
        isSidebarOpen ? "md:ml-64" : "ml-0"
      }`}
    >
      <Helmet>
        <title>Expenses | RootFin</title>
      </Helmet>

      <main className="w-full px-5 py-8 sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("toggle-sidebar"))
              }
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              title="Toggle Sidebar Menu"
              aria-label="Toggle sidebar menu"
            >
              <Menu size={23} />
            </button>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-xl font-bold uppercase tracking-wide text-[#07132e] sm:text-2xl">
                Expenses
              </h1>
              <p className="mt-0.5 text-sm text-[#617091] sm:text-base">
                Record &amp; Track your business transactions
              </p>
            </div>
          </div>

          {canSetLimits && (
            <button
              type="button"
              onClick={() => setShowTargetModal(true)}
              className="inline-flex h-12 items-center justify-center rounded-[10px] bg-[#07132e] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#111f3e] sm:text-base"
            >
              Set Expense Limit
            </button>
          )}
        </header>

        <section className="rounded-[20px] border border-[#dfe5f2] bg-white p-6 shadow-[0_1px_5px_rgba(30,41,59,0.08)] sm:p-8 lg:p-9">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-7 lg:min-h-[calc(100vh-235px)]"
          >
            <div className="w-full lg:w-1/3">
              <label
                htmlFor="expense-store"
                className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
              >
                Store
              </label>
              {canSelectStore ? (
                <div className="relative">
                  <select
                    id="expense-store"
                    value={selectedStore}
                    onChange={(event) => setSelectedStore(event.target.value)}
                    disabled={storesLoading}
                    required
                    className="h-[68px] w-full appearance-none rounded-xl border border-[#d7deef] bg-white px-6 pr-12 text-base text-[#17213b] outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:cursor-wait disabled:bg-slate-50 sm:text-lg"
                  >
                    {storesLoading && <option value="">Loading stores...</option>}
                    {!storesLoading && allowedStores.length === 0 && (
                      <option value="">No stores available</option>
                    )}
                    {allowedStores.map((store) => (
                      <option key={store.locCode} value={store.locCode}>
                        {store.locName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={20}
                    className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#98a2b3]"
                  />
                </div>
              ) : (
                <div className="flex h-[68px] items-center rounded-xl border border-[#d7deef] bg-slate-50 px-6 text-base font-medium text-[#17213b] sm:text-lg">
                  {currentusers.storeName ||
                    currentusers.locName ||
                    currentusers.username ||
                    currentusers.locCode ||
                    "Assigned store"}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
                  <div>
                    <label
                      htmlFor="expense-category"
                      className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                    >
                      Category
                    </label>
                    <div className="relative">
                      <select
                        id="expense-category"
                        value={selectedCategory.value}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="h-[54px] w-full appearance-none rounded-xl border border-[#d7deef] bg-white px-5 pr-12 text-base text-[#17213b] outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 sm:text-lg"
                      >
                        {cats.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={20}
                        className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#98a2b3]"
                      />
                    </div>
                  </div>

                  {selectedCategory.subs?.length > 0 && (
                    <div>
                      <label
                        htmlFor="expense-subcategory"
                        className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                      >
                        Sub Category
                      </label>
                      <div className="relative">
                        <select
                          id="expense-subcategory"
                          value={subCategory}
                          onChange={(e) => setSubCategory(e.target.value)}
                          className="h-[54px] w-full appearance-none rounded-xl border border-[#d7deef] bg-white px-5 pr-12 text-base text-[#17213b] outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 sm:text-lg"
                        >
                          {selectedCategory.subs.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={20}
                          className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#98a2b3]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="expense-amount"
                      className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                    >
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-medium text-[#8390aa]">
                        ₹
                      </span>
                      <input
                        id="expense-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="h-[54px] w-full rounded-xl border border-[#d7deef] bg-white py-3 pl-11 pr-5 text-base text-[#17213b] outline-none transition placeholder:text-[#8c98af] focus:border-purple-500 focus:ring-2 focus:ring-purple-100 sm:text-lg"
                      />
                    </div>
                  </div>
            </div>

            <div className="border-t border-[#e2e7f2] pt-7">

                <div>
                  <p className="mb-4 block text-sm font-semibold uppercase text-[#667085]">
                    Way of Payment
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    {[
                      { id: "cash", label: "Cash", icon: <MdCurrencyRupee size={20} /> },
                      ...(selectedCategory.value !== "bulk amount transfer" && !isStoreLogin
                        ? [
                            { id: "bank", label: "Bank", icon: <BsBank2 size={18} /> },
                            {
                              id: "upi",
                              label: "UPI",
                              icon: <span className="text-sm font-black italic">UPI</span>,
                            },
                          ]
                        : []),
                    ].map(({ id, label, icon }) => {
                      const active = !splitPayment && paymentMethod === id;
                      return (
                        <label
                          key={id}
                          className={`flex h-12 cursor-pointer select-none items-center gap-2 rounded-xl border px-4 text-base transition ${
                            active
                              ? "border-[#a12cff] bg-[#fbf7ff] text-[#9329f4]"
                              : "border-[#dce1eb] bg-white text-[#2f3a50] hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={id}
                            checked={active}
                            onChange={() => {
                              setPaymentMethod(id);
                              setSplitPayment(false);
                            }}
                            className="h-[18px] w-[18px] accent-[#9d27f5]"
                          />
                          <span className="flex items-center gap-1.5">
                            {icon} {label}
                          </span>
                        </label>
                      );
                    })}

                    {selectedCategory.value !== "bulk amount transfer" && !isStoreLogin && (
                      <label
                        className={`flex h-12 cursor-pointer select-none items-center gap-2 rounded-xl border px-4 text-base transition ${
                          splitPayment
                            ? "border-[#a12cff] bg-[#fbf7ff] text-[#9329f4]"
                            : "border-[#dce1eb] bg-white text-[#2f3a50] hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={splitPayment}
                          onChange={(event) => setSplitPayment(event.target.checked)}
                          className="h-[18px] w-[18px] rounded accent-[#9d27f5]"
                        />
                        <span>Split Payment (Cash + Bank + UPI)</span>
                      </label>
                    )}
                  </div>

                  {/* Split Inputs */}
                  {splitPayment && (
                    <div className="mt-5 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        ["Cash", cashAmount, setCashAmount],
                        ["Bank", bankAmount, setBankAmount],
                        ["UPI", upiAmount, setUpiAmount],
                      ].map(([lbl, val, setVal]) => (
                        <div key={lbl} className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600">
                            {lbl} Amount
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#8390aa]">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={val}
                              onChange={(e) => setVal(e.target.value)}
                              placeholder="0.00"
                              className="h-12 w-full rounded-xl border border-[#d7deef] pl-9 pr-4 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            />
                          </div>
                        </div>
                      ))}
                      </div>
                      <p className={`text-xs font-semibold ${Math.abs((Number(cashAmount) || 0) + (Number(bankAmount) || 0) + (Number(upiAmount) || 0) - (Number(amount) || 0)) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
                        Balance: ₹{Math.abs((Number(amount) || 0) - (Number(cashAmount) || 0) - (Number(bankAmount) || 0) - (Number(upiAmount) || 0)).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
              <div>
                <label
                  htmlFor="expense-remarks"
                  className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                >
                  Remarks
                </label>
                <textarea
                  id="expense-remarks"
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  required
                  placeholder="Enter your transaction details here..."
                  className="h-[124px] w-full resize-none rounded-xl border border-[#d7deef] px-5 py-3 text-base text-[#17213b] outline-none transition placeholder:text-[#8c98af] focus:border-purple-500 focus:ring-2 focus:ring-purple-100 sm:text-lg"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold uppercase text-[#667085]">
                  Attachment <span className="text-red-500">*</span>
                </p>
                <SingleImageUpload
                  onImageSelect={setAttachmentFile}
                  existingImage={attachmentFile}
                  required
                  variant="expense-card"
                />
              </div>
            </div>

            {feedback && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {feedback}
              </div>
            )}

            <div className="mt-auto flex flex-col-reverse items-stretch justify-end gap-4 pt-7 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleCancel}
                className="h-12 rounded-xl px-7 text-base font-medium text-[#17213b] transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 min-w-[218px] items-center justify-center gap-2 rounded-xl bg-[#a23aeb] px-8 text-base font-semibold text-white shadow-sm transition hover:bg-[#9228dd] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{isSubmitting ? "Submitting..." : "Submit Expense"}</span>
              </button>
            </div>
          </form>
        </section>
      </main>

      <AssignTargetModal
        open={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        stores={allowedStores}
        defaultStoreCode={
          selectedStore || getPreferredStoreCode(currentusers, allowedStores)
        }
      />
    </div>
  );
};

export default Expenses;
