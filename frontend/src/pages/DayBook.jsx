import { useRef, useState, useEffect } from 'react';
import Header from '../components/Header.jsx';
import { Helmet } from "react-helmet";
import dataCache from '../utils/cache.js';
import { useSidebar } from '../hooks/useSidebar.js';
import { ArrowLeft, Calendar, Download, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import html2pdf from 'html2pdf.js';

const DayBook = () => {
    const navigate = useNavigate();
    const isSidebarOpen = useSidebar();
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [allTransactions, setAllTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [data1, setData1] = useState(null);
    const currentusers = JSON.parse(localStorage.getItem("rootfinuser"));
    const abortControllerRef = useRef(null);

    const processData = (rentoutData) => {
        const rentoutList = (rentoutData?.dataSet?.data || []).map(item => {
            const advance = Number(item.advanceAmount || 0);
            const discount = Number(item.discountAmount || 0);
            const billVal = Number(item.invoiceAmount || 0) + discount;
            const balPayable = Math.max(0, Number(item.invoiceAmount || 0) - advance);

            return {
                ...item,
                date: (item.rentOutDate || "").split("T")[0],
                invoiceNo: item.invoiceNo,
                customerName: item.customerName,
                quantity: item.quantity || 1,
                Category: "RentOut",
                SubCategory: "Balance Payable",
                discountAmount: discount,
                billValue: billVal,
                balancePayable: balPayable,
                cash: Number(item.rentoutCashAmount || 0),
                rbl: Number(item.rblRazorPay || 0),
                bank: Number(item.rentoutBankAmount || 0),
                upi: Number(item.rentoutUPIAmount || 0),
                amount: Number(item.rentoutCashAmount || 0) + Number(item.rblRazorPay || 0) + Number(item.rentoutBankAmount || 0) + Number(item.rentoutUPIAmount || 0),
                totalTransaction: Number(item.rentoutCashAmount || 0) + Number(item.rblRazorPay || 0) + Number(item.rentoutBankAmount || 0) + Number(item.rentoutUPIAmount || 0),
                source: "rentout"
            };
        });

        const sortedRentoutList = rentoutList.sort((a, b) => new Date(a.date) - new Date(b.date));
        setAllTransactions(sortedRentoutList);
    };

    const handleFetch = async () => {
        const twsBase = "https://rentalapi.rootments.live/api/GetBooking";
        if (!fromDate || !toDate) {
            return alert("select date ");
        }

        const rentoutU = `${twsBase}/GetRentoutList?LocCode=${currentusers?.locCode}&DateFrom=${fromDate}&DateTo=${toDate}`;

        dataCache.delete?.(rentoutU);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setIsLoading(true);

        try {
            const rentoutRes = await fetch(rentoutU, { signal });
            const rentoutData = await rentoutRes.json();

            dataCache.set(rentoutU, rentoutData);
            setData1(rentoutData);
            processData(rentoutData);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Fetch error:', err);
                alert('Error fetching data. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    useEffect(() => {
        if (data1) {
            processData(data1);
        }
    }, [data1]);

    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    };

    const formatNumber = (num) => {
        if (!num && num !== 0) return "0";
        return new Intl.NumberFormat('en-IN').format(num);
    };

    const calculateTotal = (key) => {
        if (!allTransactions) return 0;
        return allTransactions.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
    };

    const handleExportCSV = () => {
        if (!allTransactions || allTransactions.length === 0) return;
        
        const csvRows = [];
        csvRows.push(['Date', 'Invoice No.', 'Customer Name', 'Quantity', 'Bill Value', 'Cash', 'Razorpay', 'Card/Bank', 'UPI', 'Total Amount']);
        
        allTransactions.forEach(item => {
            csvRows.push([
                formatDate(item.date),
                item.invoiceNo || "-",
                item.customerName || "-",
                item.quantity || 1,
                item.billValue || 0,
                item.cash || 0,
                item.rbl || 0,
                item.bank || 0,
                item.upi || 0,
                item.amount || 0
            ]);
        });
        
        csvRows.push([
            'TOTAL',
            '-',
            '-',
            '-',
            '-',
            calculateTotal('cash'),
            calculateTotal('rbl'),
            calculateTotal('bank'),
            calculateTotal('upi'),
            calculateTotal('amount')
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const storeName = (currentusers.locName || currentusers.locCode || "Store").replace(/[^a-zA-Z0-9]/g, "_");
        const dateRange = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
        link.setAttribute("download", `Rentout_Report_${dateRange}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintPDF = () => {
        const element = document.getElementById('report-table-container');
        const storeName = (currentusers.locName || currentusers.locCode || "Store").replace(/[^a-zA-Z0-9]/g, "_");
        const dateRange = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
        const opt = {
            margin: [0.3, 0.3, 0.3, 0.3],
            filename: `daybook_${storeName}_${dateRange}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 1.5, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    };

    return (
        <>
            <Helmet>
                <title>Rentout | RootFin</title>
            </Helmet>
            
            <Header title="Rent Out Report" />
            <div className={`invoice-page-wrapper transition-all duration-300 min-h-screen bg-[#FAFAFA] text-[#1B1B1B] ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
                {/* Clean Page Title Header */}
                <div className="no-print bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
                    <h1 className="text-[18px] font-semibold text-[#1B1B1B]">Rent Out Report</h1>
                </div>

                <div className="px-6 md:px-8 pt-6 pb-8">
                    {/* Filters Section */}
                    <div className="no-print flex flex-wrap items-end justify-between gap-4 mb-5">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="rf-form-field !mb-0">
                                <label className="rf-field-label">From Date</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="rf-input !w-[172px] !h-[40px] !rounded-[10px]"
                                />
                            </div>
                            <div className="rf-form-field !mb-0">
                                <label className="rf-field-label">To Date</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="rf-input !w-[172px] !h-[40px] !rounded-[10px]"
                                />
                            </div>

                            <button
                                type="button"
                                data-no-confirm="true"
                                onClick={handleFetch}
                                disabled={isLoading}
                                className="rf-btn-primary !h-[40px] !px-6 !rounded-[10px] !bg-[#9D43D6] hover:!bg-[#8732BE] !text-[13px] !font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-[0_2px_8px_rgba(157,67,214,0.24)]"
                            >
                                {isLoading ? (
                                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                    </svg>Fetching...</>
                                ) : 'Fetch Data'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                data-no-confirm="true"
                                onClick={handleExportCSV}
                                disabled={allTransactions.length === 0}
                                className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <span>Export CSV</span>
                                <Download size={15} />
                            </button>
                            <button
                                type="button"
                                data-no-confirm="true"
                                onClick={handlePrintPDF}
                                disabled={allTransactions.length === 0}
                                className="rf-btn-cancel !h-[40px] !px-5 !rounded-[10px] !bg-[#EFEFF1] hover:!bg-[#E4E4E7] !text-[#1B1B1B] !text-[13px] !font-medium !border-0 inline-flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <span>Print PDF</span>
                                <Printer size={15} />
                            </button>
                        </div>
                    </div>

                    <div id="report-table-container">
                        <div className="bg-white rounded-[10px] border border-[#EAEAEA] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                        <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-[0.04em]">
                                            <th className="py-3.5 px-4 text-left whitespace-nowrap">DATE</th>
                                            <th className="py-3.5 px-4 text-left whitespace-nowrap">INVOICE NO.</th>
                                            <th className="py-3.5 px-4 text-left whitespace-nowrap">CUSTOMER NAME</th>
                                            <th className="py-3.5 px-4 text-center whitespace-nowrap">QTY</th>
                                            <th className="py-3.5 px-4 text-center whitespace-nowrap">BILL VALUE</th>
                                            <th className="py-3.5 px-4 text-center whitespace-nowrap">CASH</th>
                                            <th className="py-3.5 px-4 text-center whitespace-nowrap">RAZORPAY</th>
                                            <th className="py-3.5 px-4 text-center whitespace-nowrap">CARD/BANK</th>
                                            <th className="py-3.5 px-4 text-center whitespace-nowrap">UPI</th>
                                            <th className="py-3.5 px-4 text-center whitespace-nowrap">TOTAL AMOUNT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F0F0F0] text-[#3F3F46] bg-white">
                                        {allTransactions.length > 0 ? (
                                            allTransactions.map((transaction, index) => (
                                                <tr key={index} className="hover:bg-[#FAF5FF]/60 transition-colors">
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap font-medium text-[#212121]">
                                                        {formatDate(transaction.date)}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap tabular-nums">
                                                        {transaction.invoiceNo || transaction._id || transaction.locCode || "-"}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] whitespace-nowrap text-[#212121]">
                                                        {transaction.customerName || "-"}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                                                        {transaction.quantity || 1}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                                                        {formatNumber(transaction.billValue)}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                                                        {formatNumber(transaction.cash)}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                                                        {formatNumber(transaction.rbl)}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                                                        {formatNumber(transaction.bank)}
                                                    </td>
                                                    <td className="py-3.5 px-4 border-r border-[#F5F5F5] text-center whitespace-nowrap tabular-nums">
                                                        {formatNumber(transaction.upi)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-semibold text-[#1B1B1B] tabular-nums">
                                                        {formatNumber(transaction.amount)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="10" className="px-6 py-14 text-center text-[#8A8A8A] text-[13px] font-medium">
                                                    {!toDate || !fromDate
                                                        ? "Select a date range and click Fetch Data"
                                                        : "No transactions found"}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {allTransactions.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-[#EAECEF] font-semibold text-[#1B1B1B] text-[13px] border-t border-[#E2E4E8]">
                                                <td colSpan="5" className="py-3.5 px-4 text-left border-r border-[#D8DADF]">
                                                    Total
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] tabular-nums">
                                                    {formatNumber(calculateTotal('cash'))}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] tabular-nums">
                                                    {formatNumber(calculateTotal('rbl'))}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] tabular-nums">
                                                    {formatNumber(calculateTotal('bank'))}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold border-r border-[#D8DADF] tabular-nums">
                                                    {formatNumber(calculateTotal('upi'))}
                                                </td>
                                                <td className="py-3.5 px-4 text-center font-bold tabular-nums">
                                                    {formatNumber(calculateTotal('amount'))}
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

export default DayBook;