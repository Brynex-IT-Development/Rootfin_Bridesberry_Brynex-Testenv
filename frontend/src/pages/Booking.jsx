import React, { useMemo, useRef, useState } from "react";
import Headers from "../components/Header.jsx";
import { Helmet } from "react-helmet";
import { useSidebar } from "../hooks/useSidebar.js";
import { CSVLink } from "react-csv";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { Loader2 } from "lucide-react";
import baseUrl from "../api/api.js";
import ReportStoreFilter, { useReportStoreFilter } from "../components/ReportStoreFilter.jsx";

// Helper to format date into "01 Sep, 2026" format
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const cleanStr = String(dateStr).split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parts[2].padStart(2, "0");
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${day} ${monthNames[monthIndex]}, ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      return `${day} ${month}, ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

// Helper to format numbers with commas (Indian number format)
const formatNumber = (num) => {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-IN");
};

const Booking = () => {
  const isSidebarOpen = useSidebar();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);

  const printRef = useRef(null);
  const storeFilter = useReportStoreFilter();

  const handleFetch = async () => {
    if (!fromDate || !toDate) {
      alert("Please select both From Date and To Date");
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      alert("From Date cannot be after To Date");
      return;
    }

    setLoading(true);
    setHasFetched(true);

    try {
      // Admin/Super Admin can pick a store or "All Stores"; others use their own store
      const fetchForStore = async (locCode) => {
      const twsBase = "https://rentalapi.rootments.live/api/GetBooking";
      const bookingUrl = `${twsBase}/GetBookingList?LocCode=${locCode}&DateFrom=${fromDate}&DateTo=${toDate}`;

      // Optional override data fetch
      let overrideRows = [];
      try {
        const backendBase = baseUrl?.baseUrl || "http://localhost:7000/";
        const overrideRes = await fetch(
          `${backendBase}api/tws/getEditedTransactions?fromDate=${fromDate}&toDate=${toDate}&locCode=${locCode}`
        );
        if (overrideRes.ok) {
          const overrideJson = await overrideRes.json();
          overrideRows = overrideJson?.data || [];
        }
      } catch (err) {
        console.warn("Could not fetch overrides:", err);
      }

      const editedMap = new Map();
      overrideRows.forEach((row) => {
        const key = String(row.invoiceNo || row.invoice || "").trim();
        const category = (row.type || row.Category || "").toLowerCase();
        editedMap.set(`${key}-${category}`, row);
        editedMap.set(key, row);
      });

      const response = await fetch(bookingUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch booking data: ${response.statusText}`);
      }

      const resData = await response.json();
      const rawList = resData?.dataSet?.data || [];

      return rawList.map((item) => {
        const invKey = String(item.invoiceNo || "").trim();
        const override = editedMap.get(`${invKey}-booking`) || editedMap.get(invKey);

        const rawDate = override?.date || item.bookingDate || item.date || "";
        const invoiceNo = override?.invoiceNo || item.invoiceNo || "-";
        const customerName =
          override?.customerName ||
          item.customerName ||
          item.custName ||
          item.customer ||
          "-";
        const quantity = Number(override?.quantity ?? item.quantity ?? 1);
        const billValue = Number(
          override?.billValue ?? item.invoiceAmount ?? item.billValue ?? 0
        );
        const cash = Number(
          override?.cash ?? item.bookingCashAmount ?? item.cash ?? 0
        );
        const rbl = Number(
          override?.rbl ?? item.rblRazorPay ?? item.rbl ?? 0
        );
        const bank = Number(
          override?.bank ?? item.bookingBankAmount ?? item.bank ?? 0
        );
        const upi = Number(
          override?.upi ?? item.bookingUPIAmount ?? item.upi ?? 0
        );
        const totalAmount = cash + rbl + bank + upi;

        return {
          rawDate,
          date: formatDisplayDate(rawDate),
          invoiceNo,
          customerName,
          quantity,
          billValue,
          cash,
          rbl,
          bank,
          upi,
          totalAmount,
          storeName: storeFilter.storeLabel(locCode),
        };
      });
      };

      const codes = storeFilter.locCodesToQuery();
      const perStore = await Promise.all(codes.map((code) => fetchForStore(code)));
      const formattedList = perStore.flat().sort((a, b) => String(a.rawDate).localeCompare(String(b.rawDate)));
      setBookingData(formattedList);
    } catch (error) {
      console.error("Error fetching booking data:", error);
      alert("Error fetching data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary totals
  const totals = useMemo(() => {
    return bookingData.reduce(
      (acc, item) => {
        acc.quantity += Number(item.quantity || 0);
        acc.billValue += Number(item.billValue || 0);
        acc.cash += Number(item.cash || 0);
        acc.rbl += Number(item.rbl || 0);
        acc.bank += Number(item.bank || 0);
        acc.upi += Number(item.upi || 0);
        acc.totalAmount += Number(item.totalAmount || 0);
        return acc;
      },
      {
        quantity: 0,
        billValue: 0,
        cash: 0,
        rbl: 0,
        bank: 0,
        upi: 0,
        totalAmount: 0,
      }
    );
  }, [bookingData]);

  // CSV Export configuration
  const csvHeaders = [
    { label: "DATE", key: "date" },
    { label: "INVOICE NO.", key: "invoiceNo" },
    { label: "CUSTOMER NAME", key: "customerName" },
    { label: "QUANTITY", key: "quantity" },
    { label: "BILL VALUE", key: "billValue" },
    { label: "CASH", key: "cash" },
    { label: "RBL", key: "rbl" },
    { label: "BANK", key: "bank" },
    { label: "UPI", key: "upi" },
    { label: "TOTAL AMOUNT", key: "totalAmount" },
  ];

  const csvExportData = useMemo(() => {
    if (bookingData.length === 0) return [];
    return [
      ...bookingData,
      {
        date: "Total",
        invoiceNo: "",
        customerName: "",
        quantity: totals.quantity,
        billValue: totals.billValue,
        cash: totals.cash,
        rbl: totals.rbl,
        bank: totals.bank,
        upi: totals.upi,
        totalAmount: totals.totalAmount,
      },
    ];
  }, [bookingData, totals]);

  // Print PDF handler
  const handlePrint = () => {
    if (bookingData.length === 0) {
      alert("No data available to print.");
      return;
    }
    window.print();
  };

  return (
    <>
      <Helmet>
        <title>Booking Report | RootFin</title>
      </Helmet>

      {/* Print-specific styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
          }
          .no-print {
            display: none !important;
          }
          nav, aside, header {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #d1d5db !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
          th {
            background-color: #18181b !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tfoot tr {
            background-color: #e5e7eb !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="invoice-page-wrapper min-h-screen bg-[#FAFAFA] text-[#1B1B1B]">
        <div className="no-print">
          <Headers title={"Booking Report"} />
        </div>

        <div
          className={`transition-all duration-300 ${
            isSidebarOpen ? "ml-[240px]" : "ml-0"
          }`}
        >
          {/* Clean Page Title Header */}
          <div className="no-print bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <h1 className="text-[18px] font-semibold text-[#1B1B1B]">
              Booking Report
            </h1>
          </div>

          <div className="px-6 md:px-8 pt-6 pb-8">
            {/* Top Controls Bar */}
            <div className="no-print flex flex-wrap items-end justify-between gap-4 mb-5">
              {/* Left filter inputs */}
              <div className="flex flex-wrap items-end gap-3">
                {/* From Date */}
                <div className="rf-form-field !mb-0">
                  <label htmlFor="fromDate" className="rf-field-label">
                    From Date
                  </label>
                  <input
                    type="date"
                    id="fromDate"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rf-input !w-[172px] !h-[40px] !rounded-[10px]"
                  />
                </div>

                {/* To Date */}
                <div className="rf-form-field !mb-0">
                  <label htmlFor="toDate" className="rf-field-label">
                    To Date
                  </label>
                  <input
                    type="date"
                    id="toDate"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rf-input !w-[172px] !h-[40px] !rounded-[10px]"
                  />
                </div>

                <ReportStoreFilter filter={storeFilter} />

                {/* Fetch Data Button */}
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={handleFetch}
                  disabled={loading}
                  className="rf-btn-primary !h-[40px] !px-6 !rounded-[10px] !bg-[#F2572B] hover:!bg-[#D9431A] !text-[13px] !font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-[0_2px_8px_rgba(242, 87, 43,0.24)]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? "Fetching..." : "Fetch Data"}</span>
                </button>
              </div>

              {/* Right action buttons: Export CSV & Print PDF */}
              <div className="flex items-center gap-2.5">
                {/* Export CSV Button */}
                {bookingData.length > 0 ? (
                  <CSVLink
                    data={csvExportData}
                    headers={csvHeaders}
                    filename={`Booking_Report_${fromDate || "all"}_to_${
                      toDate || "all"
                    }.csv`}
                    className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors no-underline cursor-pointer"
                  >
                    <span>Export CSV</span>
                    <FiDownload className="w-4 h-4 text-[#1B1B1B]" />
                  </CSVLink>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] !text-[#8A8A8A] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 cursor-not-allowed opacity-70"
                  >
                    <span>Export CSV</span>
                    <FiDownload className="w-4 h-4 text-[#8A8A8A]" />
                  </button>
                )}

                {/* Print PDF Button */}
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={handlePrint}
                  disabled={bookingData.length === 0}
                  className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Print PDF</span>
                  <FiPrinter className="w-4 h-4 text-[#1B1B1B]" />
                </button>
              </div>
            </div>

            {/* Print Header only visible on paper/print */}
            <div className="hidden print:block mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                RootFin Booking Report
              </h2>
              <p className="text-sm text-gray-600">
                Period: {formatDisplayDate(fromDate)} to{" "}
                {formatDisplayDate(toDate)}
              </p>
            </div>

            {/* Report Table Card */}
            <div
              id="printable-report-area"
              ref={printRef}
              className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  {/* Dark Header */}
                  <thead>
                    <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em] select-none">
                      <th className="py-3.5 px-4 text-left whitespace-nowrap">DATE</th>
                      <th className="py-3.5 px-4 text-left whitespace-nowrap">INVOICE NO.</th>
                      <th className="py-3.5 px-4 text-left whitespace-nowrap">CUSTOMER NAME</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">QUANTITY</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">BILL VALUE</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">CASH</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">RBL</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">BANK</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">UPI</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">TOTAL AMOUNT</th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-[#F0F0F0] text-[13px] text-[#3F3F46] bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center text-[#6A6A6A]">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-7 h-7 animate-spin text-[#F2572B]" />
                            <span className="text-[13px] font-medium">
                              Fetching booking records...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : bookingData.length > 0 ? (
                      bookingData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#FEF3EE]/60 transition-colors">
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap font-medium text-[#212121]">
                            {row.date}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap text-[#3F3F46] tabular-nums">
                            {row.invoiceNo}
                            {storeFilter.isAllStores && row.storeName && (
                              <div className="text-[11px] text-[#8A8A8A] font-normal">{row.storeName}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap text-[#212121]">
                            {row.customerName}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                            {row.quantity}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                            {formatNumber(row.billValue)}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                            {formatNumber(row.cash)}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                            {formatNumber(row.rbl)}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                            {formatNumber(row.bank)}
                          </td>
                          <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                            {formatNumber(row.upi)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap font-semibold text-[#1B1B1B] tabular-nums">
                            {formatNumber(row.totalAmount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-14 text-center text-[#8A8A8A] font-medium text-[13px]">
                          {!hasFetched
                            ? "Select Date range and click Fetch Data"
                            : "No booking records found for the selected date range."}
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Summary Totals Footer */}
                  {bookingData.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#EAECEF] font-semibold text-[#1B1B1B] text-[13px] border-t border-[#E2E4E8]">
                        <td colSpan={5} className="py-3.5 px-4 text-left border-r border-[#D8DADF]">
                          Total
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] whitespace-nowrap tabular-nums">
                          {formatNumber(totals.cash)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] whitespace-nowrap tabular-nums">
                          {formatNumber(totals.rbl)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] whitespace-nowrap tabular-nums">
                          {formatNumber(totals.bank)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] whitespace-nowrap tabular-nums">
                          {formatNumber(totals.upi)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold whitespace-nowrap tabular-nums">
                          {formatNumber(totals.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Booking;
