import { useEffect, useMemo, useState } from "react";
import SingleImageUpload from "../components/SingleImageUpload";
import AssignTargetModal from "../components/AssignTargetModal.jsx";
import baseUrl from "../api/api";
import { BsBank2 } from "react-icons/bs";
import { MdCurrencyRupee } from "react-icons/md";
import { Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";
import { useSidebar } from "../hooks/useSidebar.js";
import { baseExpenseCats } from "../config/expenseCategories.js";
import { useActiveStores } from "../utils/storeService.js";
import Header from "../components/Header.jsx";
import AppSelect from "../components/AppSelect.jsx";
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
    <div className="invoice-page-wrapper min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Helmet>
        <title>Expenses | RootFin</title>
      </Helmet>

      <Header title="Expenses" />

      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "ml-[240px]" : "ml-0"
        }`}
      >
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-semibold text-[#1B1B1B] leading-snug">
              Expenses
            </h1>
            <p className="text-[12px] text-[#8A8A8A] mt-0.5">
              Record &amp; track your business transactions
            </p>
          </div>

          {canSetLimits && (
            <button
              type="button"
              onClick={() => setShowTargetModal(true)}
              className="inline-flex h-[38px] items-center justify-center rounded-[10px] bg-[#1B1B1B] hover:bg-[#2E2E2E] px-4 text-[13px] font-medium text-white transition-colors cursor-pointer"
            >
              Set Expense Limit
            </button>
          )}
        </div>

        <main className="p-5 md:p-6 max-w-[1200px] w-full">
          <section className="rounded-[16px] border border-[#E5E5E5] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9D43D6]">
                EXPENSE DETAILS
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* Store */}
                <div>
                  <label htmlFor="expense-store" className="rf-field-label">
                    Store <span className="text-[#EF4444]">*</span>
                  </label>
                  {canSelectStore ? (
                    <AppSelect
                      id="expense-store"
                      value={selectedStore}
                      onChange={(event) => setSelectedStore(event.target.value)}
                      disabled={storesLoading}
                      required
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
                    </AppSelect>
                  ) : (
                    <div className="flex h-[42px] items-center rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] px-3.5 text-[13px] font-medium text-[#212121]">
                      {currentusers.storeName ||
                        currentusers.locName ||
                        currentusers.username ||
                        currentusers.locCode ||
                        "Assigned store"}
                    </div>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="expense-category" className="rf-field-label">
                    Category <span className="text-[#EF4444]">*</span>
                  </label>
                  <AppSelect
                    id="expense-category"
                    value={selectedCategory.value}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {cats.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </AppSelect>
                </div>

                {/* Sub Category (conditional) */}
                {selectedCategory.subs?.length > 0 && (
                  <div>
                    <label htmlFor="expense-subcategory" className="rf-field-label">
                      Sub Category
                    </label>
                    <AppSelect
                      id="expense-subcategory"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                    >
                      {selectedCategory.subs.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </AppSelect>
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label htmlFor="expense-amount" className="rf-field-label">
                    Amount <span className="text-[#EF4444]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[#7A7A7A] pointer-events-none">
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
                      className="rf-input !h-[42px] !pl-8 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Way of Payment */}
              <div className="border-t border-[#F0F0F0] pt-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9D43D6] mb-3">
                  WAY OF PAYMENT
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { id: "cash", label: "Cash", icon: <MdCurrencyRupee size={18} /> },
                    ...(selectedCategory.value !== "bulk amount transfer" && !isStoreLogin
                      ? [
                          { id: "bank", label: "Bank", icon: <BsBank2 size={15} /> },
                          {
                            id: "upi",
                            label: "UPI",
                            icon: <span className="text-[12px] font-black italic">UPI</span>,
                          },
                        ]
                      : []),
                  ].map(({ id, label, icon }) => {
                    const active = !splitPayment && paymentMethod === id;
                    return (
                      <label
                        key={id}
                        className={`flex h-[42px] cursor-pointer select-none items-center gap-2 rounded-[10px] border px-4 text-[13px] font-medium transition-colors ${
                          active
                            ? "border-[#9D43D6] bg-[#FBF5FC] text-[#9D43D6]"
                            : "border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#FAFAFA]"
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
                          className="h-4 w-4 accent-[#9D43D6] cursor-pointer"
                        />
                        <span className="flex items-center gap-1.5">
                          {icon} {label}
                        </span>
                      </label>
                    );
                  })}

                  {selectedCategory.value !== "bulk amount transfer" && !isStoreLogin && (
                    <label
                      className={`flex h-[42px] cursor-pointer select-none items-center gap-2 rounded-[10px] border px-4 text-[13px] font-medium transition-colors ${
                        splitPayment
                          ? "border-[#9D43D6] bg-[#FBF5FC] text-[#9D43D6]"
                          : "border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(event) => setSplitPayment(event.target.checked)}
                        className="h-4 w-4 rounded-[4px] accent-[#9D43D6] cursor-pointer"
                      />
                      <span>Split Payment (Cash + Bank + UPI)</span>
                    </label>
                  )}
                </div>

                {/* Split Inputs */}
                {splitPayment && (
                  <div className="mt-4 space-y-2.5 rounded-[12px] border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        ["Cash", cashAmount, setCashAmount],
                        ["Bank", bankAmount, setBankAmount],
                        ["UPI", upiAmount, setUpiAmount],
                      ].map(([lbl, val, setVal]) => (
                        <div key={lbl}>
                          <label className="rf-field-label">{lbl} Amount</label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[#7A7A7A] pointer-events-none">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={val}
                              onChange={(e) => setVal(e.target.value)}
                              placeholder="0.00"
                              className="rf-input !h-[40px] !pl-8 bg-white"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p
                      className={`text-[12px] font-semibold ${
                        Math.abs(
                          (Number(cashAmount) || 0) +
                            (Number(bankAmount) || 0) +
                            (Number(upiAmount) || 0) -
                            (Number(amount) || 0)
                        ) < 0.01
                          ? "text-[#16A34A]"
                          : "text-[#D97706]"
                      }`}
                    >
                      Balance: ₹
                      {Math.abs(
                        (Number(amount) || 0) -
                          (Number(cashAmount) || 0) -
                          (Number(bankAmount) || 0) -
                          (Number(upiAmount) || 0)
                      ).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Remarks & Attachment */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 border-t border-[#F0F0F0] pt-5">
                <div>
                  <label htmlFor="expense-remarks" className="rf-field-label">
                    Remarks <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea
                    id="expense-remarks"
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    required
                    placeholder="Enter your transaction details here..."
                    className="h-[130px] w-full resize-none rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[13px] text-[#212121] outline-none transition placeholder:text-[#A1A1AA] focus:border-[#9D43D6] focus:ring-2 focus:ring-[#9D43D6]/15"
                  />
                </div>

                <div>
                  <p className="rf-field-label">
                    Attachment <span className="text-[#EF4444]">*</span>
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
                <div className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-[13px] font-medium text-[#15803D]">
                  {feedback}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#F0F0F0] pt-5">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rf-btn-cancel !h-[40px] !px-5 !text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rf-btn-primary !h-[40px] !px-6 !text-[13px] inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{isSubmitting ? "Submitting..." : "Submit Expense"}</span>
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>

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
