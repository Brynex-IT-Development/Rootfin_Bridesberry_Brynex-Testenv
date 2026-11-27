import { useRef, useState, useMemo, useEffect } from 'react';
import { Download } from 'lucide-react';
import Headers from '../components/Header';
import baseUrl from '../api/api';
import { useSidebar } from '../hooks/useSidebar.js';
import { getActiveStores, fetchActiveStores } from '../utils/storeService.js';

const CloseReport = () => {
  const isSidebarOpen = useSidebar();
  const [allLocations, setAllLocations] = useState(() => getActiveStores());

  useEffect(() => {
    fetchActiveStores().then(s => {
      if (s && s.length > 0) setAllLocations(s);
    });
    const handleUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail)) setAllLocations(e.detail);
    };
    window.addEventListener("rootfin-stores-updated", handleUpdate);
    return () => window.removeEventListener("rootfin-stores-updated", handleUpdate);
  }, []);

  const [fromDate, setFromDate] = useState("");
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef(null);

  const currentuser = JSON.parse(localStorage.getItem("rootfinuser"));

  const formatDate = (inputDate) => {
    const [year, month, day] = inputDate.split("-");
    return `${year}-${month}-${day}`;
  };

  const toISTDateString = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);
  };

  const isLateClosedTxn = (txn) => {
    if (!txn) return false;
    if (txn.status === "pending_approval") return true;
    if (txn.date && txn.createdAt) {
      const closeBizDate = new Date(txn.date).toISOString().slice(0, 10);
      const createdBizDate = toISTDateString(txn.createdAt);
      if (createdBizDate && closeBizDate && createdBizDate > closeBizDate) {
        return true;
      }
    }
    return false;
  };

  const handleFetch = async () => {
    if (!fromDate) return alert("Please select a date first.");

    setIsLoading(true);
    const formattedDate = formatDate(fromDate);
    const updatedApiUrl = `${baseUrl?.baseUrl}user/AdminColseView?date=${formattedDate}&role=${currentuser?.power}`;

    try {
      const response = await fetch(updatedApiUrl);
      if (response.status === 401) {
        setIsLoading(false);
        return alert("Error: Data already saved for today.");
      } else if (!response.ok) {
        setIsLoading(false);
        return alert("Error: Failed to fetch data.");
      }

      const result = await response.json();
      
      const processDataInChunks = (data, chunkSize = 50) => {
        const chunks = [];
        for (let i = 0; i < data.length; i += chunkSize) {
          chunks.push(data.slice(i, i + chunkSize));
        }
        return chunks;
      };

      const rawData = result?.data || [];
      const dataChunks = processDataInChunks(rawData);
      
      let mappedData = [];
      
      for (const chunk of dataChunks) {
        const processedChunk = chunk.map((transaction) => {
          const foundLoc = allLocations.find(item => item.locCode === transaction.locCode);
          const storeName = foundLoc ? foundLoc.locName : (transaction.storeName || "Unknown");

          const calculatedClosingCash = Number(transaction.cash || 0);
          const physicalCash = Number(transaction.Closecash || 0);
          const difference = calculatedClosingCash - physicalCash;
          const match = difference === 0 ? 'Match' : 'Mismatch';

          const bankAmount = parseInt(transaction.bank || 0);
          const upiAmount = parseInt(transaction.upi || 0);
          const bankPlusUpi = bankAmount + upiAmount;
          const isLateClosed = isLateClosedTxn(transaction);

          return { 
            ...transaction,
            cash: calculatedClosingCash,
            Closecash: physicalCash,
            difference,
            match,
            storeName,
            bankPlusUpi,
            isLateClosed
          };
        });
        
        mappedData = [...mappedData, ...processedChunk];
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      setData({ ...result, data: mappedData });
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setIsLoading(false);
      alert("An unexpected error occurred.");
    }
  };

  const counts = useMemo(() => {
    const transactions = data?.data || [];
    const matchCount = transactions.filter(t => t.match === 'Match').length;
    const mismatchCount = transactions.filter(t => t.match === 'Mismatch').length;
    const lateClosedCount = transactions.filter(t => t.isLateClosed).length;
    const notClosedCount = allLocations.filter(loc => !transactions.some(t => t.storeName === loc.locName)).length;
    return { matchCount, mismatchCount, lateClosedCount, notClosedCount };
  }, [data?.data, allLocations]);

  const combinedData = useMemo(() => {
    let combined = (data?.data || []).map(txn => ({
      ...txn,
      displayStatus: txn.match
    }));

    const notClosed = allLocations.filter(loc => 
      !combined.some(txn => txn.storeName === loc.locName)
    ).map(loc => ({
      storeName: loc.locName,
      locCode: loc.locCode,
      bankPlusUpi: '',
      cash: '',
      Closecash: '',
      difference: '',
      isLateClosed: false,
      displayStatus: 'Not Closed'
    }));

    combined = [...combined, ...notClosed];

    if (filter === "Late Closed") {
       combined = combined.filter(item => item.isLateClosed);
    } else if (filter !== "All") {
       combined = combined.filter(item => item.displayStatus === filter);
    }

    return combined;
  }, [data?.data, filter, allLocations]);

  const handleExportCSV = () => {
    if (!combinedData || combinedData.length === 0) return;
    const headers = ['NO.', 'NO.OF BILLS', 'LOC CODE', 'BANK', 'CASH', 'CLOSE CASH', 'DIFFERENCE', 'STATUS'];
    const csvRows = [headers.join(',')];
    combinedData.forEach((row, i) => {
      csvRows.push([
        i + 1,
        row.storeName,
        row.locCode,
        row.bankPlusUpi || 0,
        row.cash || 0,
        row.Closecash || 0,
        row.difference || 0,
        row.isLateClosed ? `${row.displayStatus} (Late Closed)` : row.displayStatus
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Close_Report_${fromDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatNumber = (num) => {
    if (num === '' || num === null || num === undefined) return '';
    return Number(num).toLocaleString('en-IN');
  };

  return (
    <div className="close-report-wrapper min-h-screen bg-[#FFFFFF] pb-10">
      <Headers title={'Close Report'} />

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">Close Report</h1>
        </div>

        <div className="px-6 md:px-8 pt-6 pb-8">
          {/* Top Controls Area */}
          <div className="flex flex-wrap justify-between items-end gap-4 mb-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="rf-form-field !mb-0">
                <label className="rf-field-label">Select Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rf-input !w-[165px]"
                />
              </div>

              <button
                type="button"
                onClick={handleFetch}
                disabled={!fromDate || isLoading}
                className={
                  !fromDate || isLoading
                    ? 'rf-btn-disabled h-[40px] !px-6'
                    : 'rf-btn-primary h-[40px] !px-6 cursor-pointer'
                }
              >
                {isLoading ? 'Loading...' : 'Fetch Data'}
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="rf-btn-cancel h-[40px] !px-5 cursor-pointer"
              >
                <span>Export CSV</span>
                <Download size={15} />
              </button>
            </div>

            {/* Status Segmented Filter Pill */}
            <div className="inline-flex bg-[#F0F1F3] rounded-full p-1 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setFilter("All")}
                className={`inline-flex px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors items-center justify-center cursor-pointer ${
                  filter === 'All'
                    ? 'bg-[#1B1B1B] text-white shadow-xs'
                    : 'text-[#212121] hover:bg-[#E5E7EB]'
                }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => setFilter("Not Closed")}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filter === 'Not Closed'
                    ? 'bg-[#1B1B1B] text-white shadow-xs'
                    : 'text-[#212121] hover:bg-[#E5E7EB]'
                }`}
              >
                <span>Not Closed</span>
                {counts.notClosedCount > 0 && (
                  <span className="bg-[#EF4444] text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center font-bold">
                    {counts.notClosedCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFilter("Late Closed")}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filter === 'Late Closed'
                    ? 'bg-[#1B1B1B] text-white shadow-xs'
                    : 'text-[#212121] hover:bg-[#E5E7EB]'
                }`}
              >
                <span>Late Closed</span>
                {counts.lateClosedCount > 0 && (
                  <span className="bg-[#F59E0B] text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center font-bold">
                    {counts.lateClosedCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFilter("Match")}
                className={`inline-flex px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors items-center justify-center cursor-pointer ${
                  filter === 'Match'
                    ? 'bg-[#1B1B1B] text-white shadow-xs'
                    : 'text-[#212121] hover:bg-[#E5E7EB]'
                }`}
              >
                Match
              </button>
              <button
                type="button"
                onClick={() => setFilter("Mismatch")}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filter === 'Mismatch'
                    ? 'bg-[#1B1B1B] text-white shadow-xs'
                    : 'text-[#212121] hover:bg-[#E5E7EB]'
                }`}
              >
                <span>Mismatch</span>
                {counts.mismatchCount > 0 && (
                  <span className="bg-[#EF4444] text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center font-bold">
                    {counts.mismatchCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Table Area */}
          <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#1B1B1B] text-white text-[11px] font-semibold uppercase tracking-wider">
                    <th className="px-4 py-3 w-16">NO.</th>
                    <th className="px-4 py-3">NO.OF BILLS</th>
                    <th className="px-4 py-3 text-center">LOC CODE</th>
                    <th className="px-4 py-3 text-center">CARD/BANK</th>
                    <th className="px-4 py-3 text-center">CASH</th>
                    <th className="px-4 py-3 text-center">CLOSE CASH</th>
                    <th className="px-4 py-3 text-center">DIFFERENCE</th>
                    <th className="px-4 py-3 text-center w-36">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEF] text-[13px]">
                  {isLoading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-16">
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#F2572B] border-t-transparent"></div>
                          <span className="text-[#6A6A6A] text-[13px]">Loading data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : combinedData.length > 0 ? (
                    combinedData.map((row, index) => (
                      <tr
                        key={index}
                        className={`transition-colors ${
                          row.displayStatus === 'Not Closed'
                            ? 'bg-[#FFE8E8] hover:bg-[#FFE0E0]'
                            : row.isLateClosed
                            ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7]/70'
                            : 'bg-white hover:bg-[#FEF3EE]'
                        }`}
                      >
                        <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-[#6A6A6A] tabular-nums">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#F3F3F3] font-medium text-[#212121]">
                          {row.storeName}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center text-[#4A4A4A] tabular-nums">
                          {row.locCode}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center text-[#4A4A4A] tabular-nums">
                          {formatNumber(row.bankPlusUpi)}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center text-[#4A4A4A] tabular-nums">
                          {formatNumber(row.cash)}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center text-[#4A4A4A] tabular-nums">
                          {formatNumber(row.Closecash)}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#F3F3F3] text-center text-[#4A4A4A] tabular-nums">
                          {formatNumber(row.difference)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            {row.displayStatus === 'Match' && (
                              <span className="bg-[#DCFCE7] text-[#16A34A] px-3.5 py-1 rounded-md text-[11px] font-semibold inline-block min-w-[84px]">
                                Match
                              </span>
                            )}
                            {row.displayStatus === 'Mismatch' && (
                              <span className="bg-[#FEE2E2] text-[#EF4444] px-3.5 py-1 rounded-md text-[11px] font-semibold inline-block min-w-[84px]">
                                Mismatch
                              </span>
                            )}
                            {row.displayStatus === 'Not Closed' && (
                              <span className="bg-[#EF4444] text-white px-3.5 py-1 rounded-md text-[11px] font-semibold inline-block min-w-[84px]">
                                Not Closed
                              </span>
                            )}
                            {row.isLateClosed && (
                              <span className="bg-[#FEF3C7] text-[#D97706] px-2.5 py-0.5 rounded-md text-[10px] font-semibold inline-block min-w-[84px]">
                                Late Closed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-16 text-[#6A6A6A] text-[13px]">
                        {!fromDate ? "Please select a date to view reports" : "No reports found for selected filter"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloseReport;
