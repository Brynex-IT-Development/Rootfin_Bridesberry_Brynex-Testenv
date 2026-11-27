import { useEffect, useMemo, useState } from "react";
import SingleImageUpload from "../components/SingleImageUpload";
import baseUrl from "../api/api";
import { BsBank2 } from "react-icons/bs";
import { MdCurrencyRupee } from "react-icons/md";
import { Loader2 } from "lucide-react";
import { Helmet } from "react-helmet";
import { useSidebar } from "../hooks/useSidebar.js";
import { useActiveStores } from "../utils/storeService.js";
import Header from "../components/Header.jsx";
import AppSelect from "../components/AppSelect.jsx";
const baseIncomeCats = [
  {
    value: "compensation from cancellation",
    label: "Compensation from Cancellation",
  },
  {
    value: "compensation from product damage",
    label: "Compensation from Product Damage",
  },
  {
    value: "bank to cash",
    label: "Cash to Branch (*Bank to Cash)",
  },
];

const currentDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getCurrentStoreName = (user) =>
  user.storeName || user.locName || user.username || "Assigned store";

const Income = () => {
  const isSidebarOpen = useSidebar();
  const currentusers = useMemo(
    () => JSON.parse(localStorage.getItem("rootfinuser")) || {},
    []
  );
  const { stores, loading: storesLoading } = useActiveStores();
  const power = String(currentusers.power || "").toLowerCase();
  const role = String(currentusers.role || "").toLowerCase();
  const isAdmin = power === "admin";
  const isAdminLevelEntry =
    isAdmin || ["admin", "superadmin", "financial_head"].includes(role);
  const canSelectStore =
    isAdmin ||
    ["admin", "superadmin", "financial_head", "cluster_manager"].includes(role);
  const cats = isAdmin
    ? baseIncomeCats
    : baseIncomeCats.filter((category) => category.value !== "bank to cash");

  const selectableStores = useMemo(() => {
    const scopedStores =
      role === "cluster_manager"
        ? stores.filter((store) =>
            (currentusers.allowedLocCodes || [])
              .map(String)
              .includes(String(store.locCode))
          )
        : stores;
    const result = [...scopedStores];
    const currentCode = String(currentusers.locCode || "").trim();

    if (
      currentCode &&
      !result.some((store) => String(store.locCode) === currentCode)
    ) {
      result.unshift({
        locCode: currentCode,
        locName: getCurrentStoreName(currentusers),
      });
    }

    return result;
  }, [currentusers, role, stores]);

  const [selectedCategory, setSelectedCategory] = useState(cats[0]);
  const [selectedStore, setSelectedStore] = useState(() =>
    String(currentusers.locCode || "")
  );
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [remark, setRemark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [splitPayment, setSplitPayment] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (
      selectedStore &&
      selectableStores.some(
        (store) => String(store.locCode) === String(selectedStore)
      )
    ) {
      return;
    }

    const preferredCode = String(
      currentusers.locCode || selectableStores[0]?.locCode || ""
    );
    if (preferredCode) setSelectedStore(preferredCode);
  }, [currentusers.locCode, selectableStores, selectedStore]);

  const handleCategoryChange = (value) => {
    const category = cats.find((item) => item.value === value);
    if (!category) return;

    setSelectedCategory(category);
    if (category.value === "bank to cash") {
      setPaymentMethod("cash");
      setSplitPayment(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (splitPayment) {
      const total =
        parseFloat(cashAmount || 0) +
        parseFloat(bankAmount || 0) +
        parseFloat(upiAmount || 0);
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

    const effectiveStoreCode = canSelectStore
      ? selectedStore
      : String(currentusers.locCode || selectedStore);
    if (!effectiveStoreCode) {
      alert("Please select a store or branch.");
      setIsSubmitting(false);
      return;
    }

    const data = {
      type: "income",
      category: selectedCategory.value,
      remark,
      locCode: effectiveStoreCode,
      isAdminLevel: isAdminLevelEntry,
      entryType: isAdminLevelEntry ? "accountant_entry" : "branch_entry",
      amount,
      cash: splitPayment
        ? cashAmount || "0"
        : paymentMethod === "cash"
          ? amount
          : "0",
      bank: splitPayment
        ? bankAmount || "0"
        : paymentMethod === "bank"
          ? amount
          : "0",
      upi: splitPayment
        ? upiAmount || "0"
        : paymentMethod === "upi"
          ? amount
          : "0",
      paymentMethod: splitPayment ? "split" : paymentMethod,
      quantity: selectedCategory.value === "shoe sales" ? quantity : "",
      date: currentDate(),
      attachment: attachmentFile?.base64 || null,
    };

    try {
      const response = await fetch(`${baseUrl.baseUrl}user/createPayment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (!response.ok) {
        alert("Error: " + (json?.message || "Unknown error"));
      } else {
        alert("Income recorded successfully!");
        setAmount("");
        setCashAmount("");
        setBankAmount("");
        setUpiAmount("");
        setRemark("");
        setQuantity("");
        setAttachmentFile(null);
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
    setQuantity("");
    setCashAmount("");
    setBankAmount("");
    setUpiAmount("");
    setPaymentMethod("cash");
    setSplitPayment(false);
    setSelectedCategory(cats[0]);
  };

  const paymentOptions = [
    { id: "cash", label: "Cash", icon: <MdCurrencyRupee size={20} /> },
    ...(selectedCategory.value !== "bank to cash"
      ? [
          { id: "bank", label: "Bank", icon: <BsBank2 size={18} /> },
          {
            id: "upi",
            label: "UPI",
            icon: <span className="text-sm font-black italic">UPI</span>,
          },
        ]
      : []),
  ];

  const splitBalance = Math.abs(
    (Number(amount) || 0) -
      (Number(cashAmount) || 0) -
      (Number(bankAmount) || 0) -
      (Number(upiAmount) || 0)
  );

  return (
    <div className="invoice-page-wrapper min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Helmet>
        <title>Income | RootFin</title>
      </Helmet>

      <Header title="Income" />

      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "ml-[240px]" : "ml-0"
        }`}
      >
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-semibold text-[#1B1B1B] leading-snug">
              Income
            </h1>
            <p className="text-[12px] text-[#8A8A8A] mt-0.5">
              Record &amp; track your business transactions
            </p>
          </div>
        </div>

        <main className="p-5 md:p-6 max-w-[1200px] w-full">
          <section className="rounded-[16px] border border-[#E5E5E5] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#F2572B]">
                INCOME DETAILS
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* Store / Branch */}
                <div>
                  <label htmlFor="income-store" className="rf-field-label">
                    Store / Branch <span className="text-[#EF4444]">*</span>
                  </label>
                  <AppSelect
                    id="income-store"
                    value={selectedStore}
                    onChange={(event) => setSelectedStore(event.target.value)}
                    disabled={!canSelectStore || storesLoading}
                    required
                  >
                    {!selectedStore && storesLoading && (
                      <option value="">Loading stores...</option>
                    )}
                    {!storesLoading && selectableStores.length === 0 && (
                      <option value="">No stores available</option>
                    )}
                    {selectableStores.map((store) => (
                      <option key={store.locCode} value={store.locCode}>
                        {store.locName} ({store.locCode})
                      </option>
                    ))}
                  </AppSelect>
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="income-category" className="rf-field-label">
                    Category <span className="text-[#EF4444]">*</span>
                  </label>
                  <AppSelect
                    id="income-category"
                    value={selectedCategory.value}
                    onChange={(event) =>
                      handleCategoryChange(event.target.value)
                    }
                  >
                    {cats.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </AppSelect>
                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="income-amount" className="rf-field-label">
                    Amount <span className="text-[#EF4444]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[#7A7A7A] pointer-events-none">
                      ₹
                    </span>
                    <input
                      id="income-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      required
                      className="rf-input !h-[42px] !pl-8 bg-white"
                    />
                  </div>
                </div>

                {selectedCategory.value === "shoe sales" && (
                  <div>
                    <label htmlFor="income-quantity" className="rf-field-label">
                      Quantity <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      id="income-quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder="Enter quantity"
                      required
                      className="rf-input !h-[42px] bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Way of Payment */}
              <div className="border-t border-[#F0F0F0] pt-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#F2572B] mb-3">
                  WAY OF PAYMENT
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {paymentOptions.map(({ id, label, icon }) => {
                    const active = !splitPayment && paymentMethod === id;
                    return (
                      <label
                        key={id}
                        className={`flex h-[42px] cursor-pointer select-none items-center gap-2 rounded-[10px] border px-4 text-[13px] font-medium transition-colors ${
                          active
                            ? "border-[#F2572B] bg-[#FEF3EE] text-[#F2572B]"
                            : "border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#FAFAFA]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="incomePaymentMethod"
                          value={id}
                          checked={active}
                          onChange={() => {
                            setPaymentMethod(id);
                            setSplitPayment(false);
                          }}
                          className="h-4 w-4 accent-[#F2572B] cursor-pointer"
                        />
                        <span className="flex items-center gap-1.5">
                          {icon} {label}
                        </span>
                      </label>
                    );
                  })}

                  {selectedCategory.value !== "bank to cash" && (
                    <label
                      className={`flex h-[42px] cursor-pointer select-none items-center gap-2 rounded-[10px] border px-4 text-[13px] font-medium transition-colors ${
                        splitPayment
                          ? "border-[#F2572B] bg-[#FEF3EE] text-[#F2572B]"
                          : "border-[#E5E5E5] bg-white text-[#212121] hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(event) =>
                          setSplitPayment(event.target.checked)
                        }
                        className="h-4 w-4 rounded-[4px] accent-[#F2572B] cursor-pointer"
                      />
                      <span>Split Payment (Cash + Bank + UPI)</span>
                    </label>
                  )}
                </div>

                {splitPayment && (
                  <div className="mt-4 space-y-2.5 rounded-[12px] border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {[
                        ["Cash", cashAmount, setCashAmount],
                        ["Bank", bankAmount, setBankAmount],
                        ["UPI", upiAmount, setUpiAmount],
                      ].map(([label, value, setValue]) => (
                        <label key={label} className="block">
                          <span className="rf-field-label">{label} Amount</span>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[#7A7A7A] pointer-events-none">
                              ₹
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={value}
                              onChange={(event) => setValue(event.target.value)}
                              placeholder="0.00"
                              className="rf-input !h-[40px] !pl-8 bg-white"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                    <p
                      className={`text-[12px] font-semibold ${
                        splitBalance < 0.01
                          ? "text-[#16A34A]"
                          : "text-[#D97706]"
                      }`}
                    >
                      Balance: ₹{splitBalance.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Remarks & Attachment */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 border-t border-[#F0F0F0] pt-5">
                <div>
                  <label htmlFor="income-remarks" className="rf-field-label">
                    Remarks <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea
                    id="income-remarks"
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    required
                    placeholder="Enter your transaction details here..."
                    className="h-[130px] w-full resize-none rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[13px] text-[#212121] outline-none transition placeholder:text-[#A1A1AA] focus:border-[#F2572B] focus:ring-2 focus:ring-[#F2572B]/15"
                  />
                </div>

                <div>
                  <p className="rf-field-label">Attachment (Optional)</p>
                  <SingleImageUpload
                    onImageSelect={setAttachmentFile}
                    existingImage={attachmentFile}
                    variant="expense-card"
                  />
                </div>
              </div>

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
                  <span>{isSubmitting ? "Submitting..." : "Submit Income"}</span>
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Income;
