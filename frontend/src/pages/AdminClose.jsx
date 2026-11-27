import React, { useState, useEffect } from "react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import Select from "react-select";
import { appSelectStyles } from "../components/AppSelect.jsx";
import Header from "../components/Header";
import baseUrl from "../api/api";
import { Helmet } from "react-helmet";
import { Loader2, AlertCircle } from "lucide-react";
import { useSidebar } from "../hooks/useSidebar.js";
import { fetchActiveStores, getActiveStores } from "../utils/storeService.js";

// Function to format location names with proper spacing
// Store names are shown exactly as stored in the backend (no built-in overrides)
const formatLocationName = (name) => {
    if (!name || name === "No Stores" || name === "No stores available") return name || "No Stores";
    return name.trim();
};

// Fallback locations (empty - dynamic active stores only)
const fallbackLocations = [];

const AdminClose = () => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [cashDate, setCashDate] = useState("");
  const [cash, setCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [bank, setBank] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [AllLocations, setAllLocations] = useState(
    fallbackLocations.map((loc) => ({
      ...loc,
      label: formatLocationName(loc.value),
    }))
  );

  const isSidebarOpen = useSidebar();
  const currentUser = JSON.parse(localStorage.getItem("rootfinuser") || "{}");
  const email = currentUser?.email;

  useEffect(() => {
    const loadStores = async () => {
      const active = await fetchActiveStores();
      const list = (active && active.length > 0) ? active : getActiveStores();
      const locs = list.map((loc) => ({
        value: loc.locName || loc.name,
        locCode: loc.locCode,
        label: formatLocationName(loc.locName || loc.name),
      }));
      setAllLocations(locs);
    };
    loadStores();

    const handleStoresUpdated = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        const locs = e.detail.map((loc) => ({
          value: loc.locName || loc.name,
          locCode: loc.locCode,
          label: formatLocationName(loc.locName || loc.name),
        }));
        setAllLocations(locs);
      }
    };
    window.addEventListener("rootfin-stores-updated", handleStoresUpdated);
    return () => window.removeEventListener("rootfin-stores-updated", handleStoresUpdated);
  }, []);

  // Load existing closing data when location and date are selected
  useEffect(() => {
    const loadExistingData = async () => {
      if (!selectedLocation || !cashDate) {
        setCash("");
        setClosingCash("");
        setBank("");
        setIsEditMode(false);
        return;
      }

      setLoadingData(true);
      try {
        const response = await fetch(
          `${baseUrl.baseUrl}user/getsaveCashBank?locCode=${selectedLocation.locCode}&date=${cashDate}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            setCash(data.data.cash?.toString() || "");
            setClosingCash(data.data.Closecash?.toString() || "");
            setBank(data.data.bank?.toString() || "");
            setIsEditMode(true);
          } else {
            setCash("");
            setClosingCash("");
            setBank("");
            setIsEditMode(false);
          }
        } else if (response.status === 404) {
          setCash("");
          setClosingCash("");
          setBank("");
          setIsEditMode(false);
        }
      } catch (error) {
        console.error("Error loading existing data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadExistingData();
  }, [selectedLocation, cashDate]);

  const apiUrl5 = `${baseUrl.baseUrl}user/saveCashBank`;

  const handleSubmit = async () => {
    if (!selectedLocation || !cashDate || !cash || !closingCash || !bank) {
      alert("Please fill in all fields.");
      return;
    }

    const payload = {
      totalAmount: closingCash,
      totalCash: cash,
      totalBankAmount: bank,
      date: cashDate,
      locCode: selectedLocation.locCode,
      email,
    };

    try {
      setLoading(true);
      const res = await fetch(apiUrl5, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      alert(data.message || `Data ${isEditMode ? "updated" : "saved"} successfully!`);

      if (isEditMode) {
        const reloadResponse = await fetch(
          `${baseUrl.baseUrl}user/getsaveCashBank?locCode=${selectedLocation.locCode}&date=${cashDate}`
        );
        if (reloadResponse.ok) {
          const reloadData = await reloadResponse.json();
          console.log("Data after update:", reloadData.data);
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEnterToSave((e) => {
    handleSubmit();
  }, loading);

  return (
    <>
      <Helmet>
        <title>Admin Close | RootFin</title>
      </Helmet>

      <div className="min-h-screen bg-[#FFFFFF]">
        <Header title="Admin Close" />

        <div
          className={`transition-all duration-300 ${
            isSidebarOpen ? "ml-[240px]" : "ml-0"
          }`}
        >
          {/* Clean Page Title Header */}
          <div className="bg-white px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <h1 className="text-[18px] font-semibold text-[#212121]">Admin Close</h1>
          </div>

          {/* Form Section */}
          <div className="bg-white px-8 py-7 max-w-[1400px] space-y-6">
            {/* Edit Mode Alert Banner */}
            {isEditMode && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="text-xs text-amber-900">
                  <span className="font-semibold">Edit Mode Active:</span>{" "}
                  Updating existing closing data for{" "}
                  <span className="font-semibold">{selectedLocation?.label}</span> on{" "}
                  <span className="font-semibold">{cashDate}</span>.
                </div>
              </div>
            )}

            {/* Row 1: Location & Cash Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Location */}
              <div className="rf-form-field !mb-0">
                <label className="rf-field-label">Location</label>
                <Select
                  classNamePrefix="rf-select"
                  options={AllLocations}
                  value={selectedLocation}
                  onChange={setSelectedLocation}
                  placeholder="Select Location"
                  styles={appSelectStyles}
                  isSearchable
                />
              </div>

              {/* Cash Date */}
              <div className="rf-form-field !mb-0">
                <label className="rf-field-label">Cash Date</label>
                <input
                  type="date"
                  value={cashDate}
                  onChange={(e) => setCashDate(e.target.value)}
                  className="rf-input"
                />
              </div>
            </div>

            {/* Row 2: Cash (Calculated Closing), Closing Cash (Physical Count), Bank */}
            {loadingData ? (
              <div className="py-8 flex items-center gap-2.5 text-[#6A6A6A]">
                <Loader2 className="w-5 h-5 animate-spin text-[#F2572B]" />
                <p className="text-[13px]">Loading existing closing data...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cash (Calculated Closing) */}
                <div className="rf-form-field !mb-0">
                  <label className="rf-field-label">Cash (Calculated Closing)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    placeholder="Enter calculated closing cash"
                    className="rf-input"
                  />
                  <p className="text-[11px] text-[#6A6A6A] mt-1.5">
                    Opening + Day's transactions (for next day opening)
                  </p>
                </div>

                {/* Closing Cash (Physical Count) */}
                <div className="rf-form-field !mb-0">
                  <label className="rf-field-label">Closing Cash (Physical Count)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="Enter physical cash counted"
                    className="rf-input"
                  />
                  <p className="text-[11px] text-[#6A6A6A] mt-1.5">
                    Actual cash counted from denominations
                  </p>
                </div>

                {/* Bank */}
                <div className="rf-form-field !mb-0">
                  <label className="rf-field-label">Bank</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="Enter bank amount"
                    className="rf-input"
                  />
                </div>
              </div>
            )}

            {/* Row 3: Save Close Button */}
            <div className="pt-2 flex items-center justify-start">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || loadingData}
                className={
                  loading || loadingData
                    ? "rf-btn-disabled !px-6"
                    : "rf-btn-primary cursor-pointer !px-6"
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEditMode ? "Update Close" : "Save Close"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminClose;
