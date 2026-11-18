import { useEffect, useMemo, useState } from "react";
import SingleImageUpload from "../components/SingleImageUpload";
import baseUrl from "../api/api";
import { BsBank2 } from "react-icons/bs";
import { MdCurrencyRupee } from "react-icons/md";
import { ChevronDown, Loader2, Menu } from "lucide-react";
import { Helmet } from "react-helmet";
import { useSidebar } from "../hooks/useSidebar.js";
import { useActiveStores } from "../utils/storeService.js";

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
      ["155", "858"].includes(currentCode) &&
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
    ["155", "858"].includes(String(currentusers.locCode)) ? String(currentusers.locCode) : ""
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
    <div
      className={`min-h-screen bg-[#f1f4ff] transition-all duration-300 ${
        isSidebarOpen ? "md:ml-64" : "ml-0"
      }`}
    >
      <Helmet>
        <title>Income | RootFin</title>
      </Helmet>

      <main className="w-full px-5 py-10 sm:px-8 lg:px-12">
        <header className="mb-8 flex items-start gap-3">
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
              Income
            </h1>
            <p className="mt-0.5 text-sm text-[#617091] sm:text-base">
              Record &amp; Track your business transactions
            </p>
          </div>
        </header>

        <section className="rounded-[20px] border border-[#dfe5f2] bg-white p-6 shadow-[0_1px_5px_rgba(30,41,59,0.08)] sm:p-8 lg:p-9">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-7 lg:min-h-[calc(100vh-195px)]"
          >
            <div>
              <label
                htmlFor="income-store"
                className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
              >
                Store / Branch
              </label>
              <div className="relative">
                <select
                  id="income-store"
                  value={selectedStore}
                  onChange={(event) => setSelectedStore(event.target.value)}
                  disabled={!canSelectStore || storesLoading}
                  required
                  className="h-[68px] w-full appearance-none rounded-xl border border-[#d7deef] bg-white px-6 py-4 pr-12 text-base text-[#17213b] outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:cursor-default disabled:bg-white sm:text-lg"
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
                </select>
                <ChevronDown
                  size={20}
                  className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#98a2b3]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
              <div>
                <label
                  htmlFor="income-category"
                  className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                >
                  Category
                </label>
                <div className="relative">
                  <select
                    id="income-category"
                    value={selectedCategory.value}
                    onChange={(event) =>
                      handleCategoryChange(event.target.value)
                    }
                    className="h-[54px] w-full appearance-none rounded-xl border border-[#d7deef] bg-white px-5 py-3 pr-12 text-base text-[#17213b] outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 sm:text-lg"
                  >
                    {cats.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={20}
                    className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#98a2b3]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="income-amount"
                  className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                >
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-base font-medium text-[#8390aa]">
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
                    className="h-[54px] w-full rounded-xl border border-[#d7deef] bg-white py-3 pl-11 pr-5 text-base text-[#17213b] outline-none transition placeholder:text-[#8c98af] focus:border-purple-500 focus:ring-2 focus:ring-purple-100 sm:text-lg"
                  />
                </div>
              </div>

              {selectedCategory.value === "shoe sales" && (
                <div className="lg:col-span-2">
                  <label
                    htmlFor="income-quantity"
                    className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                  >
                    Quantity
                  </label>
                  <input
                    id="income-quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Enter quantity"
                    required
                    className="h-[50px] w-full rounded-xl border border-[#d7deef] px-5 text-base outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-[#e2e7f2] pt-7">
              <p className="mb-4 text-sm font-semibold uppercase text-[#667085]">
                Way of Payment
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {paymentOptions.map(({ id, label, icon }) => {
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
                        name="incomePaymentMethod"
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

                {selectedCategory.value !== "bank to cash" && (
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
                      onChange={(event) =>
                        setSplitPayment(event.target.checked)
                      }
                      className="h-[18px] w-[18px] rounded accent-[#9d27f5]"
                    />
                    <span>Split Payment (Cash + Bank + UPI)</span>
                  </label>
                )}
              </div>

              {splitPayment && (
                <div className="mt-5 space-y-2">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      ["Cash", cashAmount, setCashAmount],
                      ["Bank", bankAmount, setBankAmount],
                      ["UPI", upiAmount, setUpiAmount],
                    ].map(([label, value, setValue]) => (
                      <label
                        key={label}
                        className="text-xs font-semibold uppercase text-[#667085]"
                      >
                        {label} Amount
                        <div className="relative mt-1.5">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#8390aa]">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            placeholder="0.00"
                            className="h-12 w-full rounded-xl border border-[#d7deef] bg-white pl-9 pr-4 text-sm font-normal text-[#17213b] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                  <p
                    className={`text-xs font-semibold ${
                      splitBalance < 0.01
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    Balance: ₹{splitBalance.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
              <div>
                <label
                  htmlFor="income-remarks"
                  className="mb-2 block text-sm font-semibold uppercase text-[#667085]"
                >
                  Remarks
                </label>
                <textarea
                  id="income-remarks"
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  required
                  placeholder="Enter your transaction details here..."
                  className="h-[124px] w-full resize-none rounded-xl border border-[#d7deef] px-5 py-3 text-base text-[#17213b] outline-none transition placeholder:text-[#8c98af] focus:border-purple-500 focus:ring-2 focus:ring-purple-100 sm:text-lg"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold uppercase text-[#667085]">
                  Attachment (Optional)
                </p>
                <SingleImageUpload
                  onImageSelect={setAttachmentFile}
                  existingImage={attachmentFile}
                  variant="expense-card"
                />
              </div>
            </div>

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
                className="inline-flex h-12 min-w-[208px] items-center justify-center gap-2 rounded-xl bg-[#a23aeb] px-8 text-base font-semibold text-white shadow-sm transition hover:bg-[#9228dd] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{isSubmitting ? "Submitting..." : "Submit Income"}</span>
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Income;
