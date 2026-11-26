import { useState, useEffect, useRef } from "react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, List, Grid, Camera, MoreHorizontal, ArrowUp, Search, Filter, X, Plus, Pencil, Image as ImageIcon, Check, Info, Upload, FileText } from "lucide-react";
import baseUrl from "../api/api";
import { mapLocNameToWarehouse as mapWarehouse } from "../utils/warehouseMapping";
import useSidebar from "../hooks/useSidebar";
import Header from "../components/Header";

import AppSelect from "../components/AppSelect.jsx";
// Vendor Credit Number Preferences Modal Component
const CreditNumberPreferencesModal = ({ isOpen, onClose, onSave, currentPrefix, currentNextNumber, autoGenerate, restartYearly }) => {
  const [localAutoGenerate, setLocalAutoGenerate] = useState(autoGenerate);
  const [localPrefix, setLocalPrefix] = useState(currentPrefix);
  const [localNextNumber, setLocalNextNumber] = useState(currentNextNumber);
  const [localRestartYearly, setLocalRestartYearly] = useState(restartYearly);

  useEffect(() => {
    if (isOpen) {
      setLocalAutoGenerate(autoGenerate);
      setLocalPrefix(currentPrefix);
      setLocalNextNumber(currentNextNumber);
      setLocalRestartYearly(restartYearly);
    }
  }, [isOpen, autoGenerate, currentPrefix, currentNextNumber, restartYearly]);

  const handleSave = () => {
    onSave({
      autoGenerate: localAutoGenerate,
      prefix: localPrefix,
      nextNumber: localNextNumber,
      restartYearly: localRestartYearly,
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e6eafb]">
          <h2 className="text-lg font-semibold text-[#1f2937]">
            Configure Vendor Credit Number Preferences
          </h2>
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-[#1f2937] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Branch Information */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-[#64748b]">Branch:</span>
              <span className="text-sm font-medium text-[#1f2937]">Head Office</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[#64748b]">Associated Series:</span>
              <span className="text-sm font-medium text-[#1f2937]">Default Transaction Series</span>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-[#64748b]">
            {localAutoGenerate 
              ? "Your Vendor Credits numbers are set on auto-generate mode to save your time. Are you sure about changing this setting?"
              : "You have selected manual Vendor Credits numbering. Do you want us to auto-generate it for you?"}
          </p>

          {/* Auto-generate Option */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="numberingMode"
                checked={localAutoGenerate}
                onChange={() => setLocalAutoGenerate(true)}
                className="mt-1 text-[#2563eb] focus:ring-[#2563eb]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#1f2937]">
                    Continue auto-generating Vendor Credits numbers
                  </span>
                  <Info size={14} className="text-[#64748b]" />
                </div>
                {localAutoGenerate && (
                  <div className="mt-3 space-y-3 pl-6">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#64748b] w-20">Prefix:</label>
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={localPrefix}
                          onChange={(e) => setLocalPrefix(e.target.value)}
                          className="flex-1 rounded-md border border-[#d7dcf5] bg-white px-3 py-2 text-sm text-[#1f2937] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                          placeholder="CN-"
                        />
                        <button
                          type="button"
                          className="p-1.5 rounded-md border border-[#d7dcf5] bg-white text-[#2563eb] hover:bg-[#f0f4ff] transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-[#64748b] w-20">Next Number:</label>
                      <input
                        type="text"
                        value={localNextNumber}
                        readOnly
                        className="flex-1 rounded-md border border-[#d7dcf5] bg-[#f8fafc] px-3 py-2 text-sm text-[#1f2937] cursor-not-allowed"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localRestartYearly}
                        onChange={(e) => setLocalRestartYearly(e.target.checked)}
                        className="rounded border-[#d1d9f2] text-[#2563eb] focus:ring-[#2563eb]"
                      />
                      <span className="text-sm text-[#64748b]">
                        Restart numbering for vendor credits at the start of each fiscal year.
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </label>

            {/* Manual Option */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="numberingMode"
                checked={!localAutoGenerate}
                onChange={() => setLocalAutoGenerate(false)}
                className="mt-1 text-[#2563eb] focus:ring-[#2563eb]"
              />
              <span className="text-sm font-medium text-[#1f2937]">
                Enter Vendor Credits numbers manually
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e6eafb]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#475569] border border-[#d7dcf5] rounded-md hover:bg-[#f8fafc] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#2563eb] rounded-md hover:bg-[#1d4ed8] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Reuse components from Bills.jsx
const Label = ({ children, required = false }) => (
  <span className={`text-[11px] font-bold uppercase tracking-wider ${required ? "text-[#ef4444]" : "text-[#64748b]"}`}>
    {children}
    {required && <span className="ml-0.5 text-[#ef4444]">*</span>}
  </span>
);

const Input = ({ placeholder = "", className = "", ...props }) => {
  const baseClasses = "w-full rounded-none border border-gray-200 bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] transition-colors";
  const tableInputClasses = "h-[38px] px-3 py-1.5";
  const defaultClasses = "px-3.5 py-2.5 h-[42px]";
  
  const isTableInput = className.includes("table-input");
  const finalClasses = `${baseClasses} ${isTableInput ? tableInputClasses : defaultClasses} ${className}`;
  
  return (
    <input
      {...props}
      className={finalClasses}
      placeholder={placeholder}
    />
  );
};

const Select = ({ className = "", ...props }) => {
  const baseClasses = "w-full rounded-none border border-gray-200 bg-white text-sm text-[#111827] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] transition-colors cursor-pointer";
  const tableInputClasses = "h-[38px] px-3 py-1.5";
  const defaultClasses = "px-3.5 py-2.5 h-[42px]";
  
  const isTableInput = className.includes("table-input");
  const finalClasses = `${baseClasses} ${isTableInput ? tableInputClasses : defaultClasses} ${className}`;
  
  return (
    <AppSelect
      {...props}
      className={finalClasses}
    />
  );
};

// VendorDropdown Component (reused from Bills.jsx)
const VendorDropdown = ({ value, onChange, onNewVendor }) => {
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const loadVendors = async () => {
      setLoading(true);
      try {
        const userStr = localStorage.getItem("rootfinuser");
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = user?._id || user?.id || user?.email || user?.locCode || null;
        
        let vendorsFromAPI = [];
        
        if (userId) {
          try {
            const response = await fetch(`${API_URL}/api/purchase/vendors?userId=${userId}`);
            if (response.ok) {
              const data = await response.json();
              vendorsFromAPI = Array.isArray(data) ? data : [];
            }
          } catch (apiError) {
            console.warn("API fetch failed, trying localStorage:", apiError);
          }
        }
        
        let vendorsFromLocalStorage = [];
        try {
          const savedVendors = JSON.parse(localStorage.getItem("vendors") || "[]");
          vendorsFromLocalStorage = Array.isArray(savedVendors) ? savedVendors : [];
        } catch (localError) {
          console.warn("Error reading localStorage:", localError);
        }
        
        const vendorMap = new Map();
        
        vendorsFromAPI.forEach(vendor => {
          const key = vendor.displayName || vendor.companyName || vendor._id || vendor.id;
          if (key) vendorMap.set(key, vendor);
        });
        
        vendorsFromLocalStorage.forEach(vendor => {
          const key = vendor.displayName || vendor.companyName || vendor.id;
          if (key && !vendorMap.has(key)) {
            vendorMap.set(key, vendor);
          }
        });
        
        setVendors(Array.from(vendorMap.values()));
      } catch (error) {
        console.error("Error loading vendors:", error);
        try {
          const savedVendors = JSON.parse(localStorage.getItem("vendors") || "[]");
          setVendors(Array.isArray(savedVendors) ? savedVendors : []);
        } catch {
          setVendors([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadVendors();
    
    const handleVendorSaved = () => {
      loadVendors();
    };
    
    const handleStorageChange = (e) => {
      if (e.key === "vendors") {
        loadVendors();
      }
    };
    
    window.addEventListener("vendorSaved", handleVendorSaved);
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("vendorSaved", handleVendorSaved);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [API_URL]);

  useEffect(() => {
    if (value) {
      if (typeof value === 'object' && value !== null) {
        setSelectedVendor(value);
      } else if (vendors.length > 0) {
        const vendor = vendors.find((v) => 
          v._id === value || 
          v.id === value || 
          v.displayName === value || 
          v.companyName === value
        );
        setSelectedVendor(vendor || null);
      }
    } else {
      setSelectedVendor(null);
    }
  }, [value, vendors]);

  const updatePos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 400),
    });
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!isOpen) updatePos();
    setIsOpen((p) => !p);
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePos();
      setTimeout(updatePos, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const follow = () => updatePos();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isOpen]);

  const filteredVendors = vendors.filter((vendor) => {
    const searchLower = searchTerm.toLowerCase();
    const displayName = (vendor.displayName || "").toLowerCase();
    const companyName = (vendor.companyName || "").toLowerCase();
    const email = (vendor.email || "").toLowerCase();
    return displayName.includes(searchLower) || companyName.includes(searchLower) || email.includes(searchLower);
  });

  const handleSelectVendor = (vendor) => {
    onChange(vendor);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClearVendor = (e) => {
    e.stopPropagation();
    onChange("");
    setSelectedVendor(null);
  };

  const dropdownPortal = isOpen ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 999999,
      }}
    >
      <div className="rounded-xl shadow-xl bg-white border border-[#d7dcf5] w-full overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-3 py-2.5 bg-[#fafbff]">
          <Search size={14} className="text-[#94a3b8]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vendors"
            className="h-8 w-full border-none bg-transparent text-sm text-[#1f2937] outline-none placeholder:text-[#94a3b8]"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="py-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748b]">Loading vendors...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748b]">
              {searchTerm ? "No vendors found" : "No vendors available"}
            </div>
          ) : (
            <>
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor._id || vendor.id || vendor.displayName}
                  onClick={() => handleSelectVendor(vendor)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8fafc] cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1f2937] truncate">
                      {vendor.displayName || vendor.companyName || "Unnamed Vendor"}
                    </p>
                    {vendor.email && (
                      <p className="text-xs text-[#64748b] truncate mt-0.5">{vendor.email}</p>
                    )}
                  </div>
                  {selectedVendor && (selectedVendor._id === vendor._id || selectedVendor.id === vendor.id) && (
                    <Check size={16} className="text-[#2563eb] shrink-0" />
                  )}
                </div>
              ))}
              <div
                onClick={() => {
                  onNewVendor();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#2563eb] hover:bg-[#f8fafc] cursor-pointer transition-colors border-t border-[#e2e8f0] mt-2"
              >
                <Plus size={16} />
                <span>New Vendor</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative w-full">
        <div className="flex items-center gap-2">
          <input
            ref={buttonRef}
            onClick={toggleDropdown}
            type="text"
            readOnly
            value={selectedVendor ? (selectedVendor.displayName || selectedVendor.companyName) : ""}
            placeholder="Select a Vendor"
            className="flex-1 h-[42px] rounded-none border border-gray-200 bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] transition-colors cursor-pointer px-3.5 py-2.5"
          />
          <button
            type="button"
            className="h-[42px] w-[42px] rounded-none bg-[#8B5CF6] text-white hover:bg-[#7C3AED] transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
            title="Search Vendor"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
      {typeof document !== "undefined" && document.body && createPortal(dropdownPortal, document.body)}
    </>
  );
};

// TaxDropdown Component (from Bills.jsx)
const TaxDropdown = ({ rowId, value, onChange, taxOptions, nonTaxableOptions, onNewTax, ...props }) => {
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTax, setSelectedTax] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (value) {
      const tax = [...taxOptions, ...nonTaxableOptions].find((t) => t.id === value);
      setSelectedTax(tax);
    } else {
      setSelectedTax(null);
    }
  }, [value, taxOptions, nonTaxableOptions]);

  const updatePos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!isOpen) updatePos();
    setIsOpen((p) => !p);
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePos();
      setTimeout(updatePos, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const follow = () => updatePos();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isOpen]);

  const filteredTaxOptions = taxOptions.filter((tax) =>
    tax.display.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectTax = (taxId) => {
    onChange(taxId);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClearTax = (e) => {
    e.stopPropagation();
    onChange("");
    setSelectedTax(null);
  };

  const dropdownPortal = isOpen ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 999999,
      }}
    >
      <div className="rounded-xl shadow-xl bg-white border border-[#d7dcf5] w-[280px] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-3 py-2.5 bg-[#fafbff]">
          <Search size={14} className="text-[#94a3b8]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search"
            className="h-8 w-full border-none bg-transparent text-sm text-[#1f2937] outline-none placeholder:text-[#94a3b8]"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="py-2 max-h-[400px] overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d3d3d3 #f5f5f5' }}>
          <div className="px-4 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            NON-TAXABLE
          </div>
          {nonTaxableOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => handleSelectTax(option.id)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                value === option.id
                  ? "bg-[#eff6ff] text-[#2563eb] font-medium border-l-2 border-l-[#2563eb]"
                  : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#1f2937]"
              }`}
            >
              <div className="font-medium">{option.name}</div>
              <div className="text-xs text-[#94a3b8] mt-0.5">{option.description}</div>
            </div>
          ))}
          <div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            TAX GROUP
          </div>
          {filteredTaxOptions.map((tax) => (
            <div
              key={tax.id}
              onClick={() => handleSelectTax(tax.id)}
              className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                value === tax.id
                  ? "bg-[#f1f5f9] text-[#1f2937] font-medium border-l-2 border-l-[#64748b]"
                  : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#1f2937]"
              }`}
            >
              <span>{tax.display}</span>
              {value === tax.id && <Check size={16} className="text-[#64748b]" />}
            </div>
          ))}
          <div
            onClick={() => {
              onNewTax();
              setIsOpen(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#2563eb] hover:bg-[#f8fafc] cursor-pointer transition-colors border-t border-[#e2e8f0] mt-2"
          >
            <Plus size={16} />
            <span>New Tax</span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative w-full overflow-visible m-0 p-0">
        <button
          ref={buttonRef}
          onClick={toggleDropdown}
          type="button"
          className="tax-dropdown-button w-full h-[38px] rounded-none border border-gray-200 bg-white text-sm text-[#111827] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] transition-colors cursor-pointer flex items-center justify-between px-3 py-1.5 m-0"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="truncate text-left">
              {selectedTax ? selectedTax.display || selectedTax.name : "Select a Tax"}
            </span>
            {selectedTax && (
              <span
                onClick={handleClearTax}
                className="no-blue-button text-[#1f2937] hover:text-[#dc2626] transition-colors inline-flex items-center bg-transparent border-none p-0.5 rounded hover:bg-[#fee2e2] shrink-0 m-0 cursor-pointer"
                title="Clear selection"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X size={14} strokeWidth={2} />
              </span>
            )}
          </div>
          <ChevronDown 
            size={14} 
            className={`text-[#1f2937] transition-transform shrink-0 ml-1.5 ${isOpen ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>
      </div>
      {typeof document !== "undefined" && document.body && createPortal(dropdownPortal, document.body)}
    </>
  );
};

// ItemDropdown Component (simplified)
const ItemDropdown = ({ rowId, value, onChange, onNewItem, selectedWarehouse = "" }) => {
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        // Fetch items with a higher limit for dropdown (100 items should be enough for most cases)
        const response = await fetch(`${API_URL}/api/shoe-sales/items?page=1&limit=100`);
        if (!response.ok) throw new Error("Failed to fetch items");
        const data = await response.json();
        
        // Handle both old format (array) and new format (object with items and pagination)
        let itemsList = [];
        if (Array.isArray(data)) {
          // Old format - direct array
          itemsList = data;
        } else if (data.items && Array.isArray(data.items)) {
          // New format - paginated response
          itemsList = data.items;
        }
        
        // Filter active items
        const activeItems = itemsList.filter((i) => i?.isActive !== false && String(i?.isActive).toLowerCase() !== "false");
        setItems(activeItems);
      } catch (error) {
        console.error("Error fetching items:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    if (value) {
      if (typeof value === 'object' && value !== null) {
        setSelectedItem(value);
      } else if (items.length > 0) {
        const item = items.find((i) => i._id === value || i.itemName === value);
        setSelectedItem(item || null);
      }
    } else {
      setSelectedItem(null);
    }
  }, [value, items]);

  const updatePos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 500),
    });
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (!isOpen) updatePos();
    setIsOpen((p) => !p);
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePos();
      setTimeout(updatePos, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const follow = () => updatePos();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isOpen]);

  const filteredItems = items.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const itemName = (item.itemName || "").toLowerCase();
    const sku = (item.sku || "").toLowerCase();
    return itemName.includes(searchLower) || sku.includes(searchLower);
  });

  const handleSelectItem = (item) => {
    onChange(item);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClearItem = (e) => {
    e.stopPropagation();
    onChange("");
    setSelectedItem(null);
  };

  const dropdownPortal = isOpen ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 999999,
      }}
    >
      <div className="rounded-xl shadow-xl bg-white border border-[#d7dcf5] w-full overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-3 py-2.5 bg-[#fafbff]">
          <Search size={14} className="text-[#94a3b8]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items"
            className="h-8 w-full border-none bg-transparent text-sm text-[#1f2937] outline-none placeholder:text-[#94a3b8]"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
        <div className="py-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748b]">Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748b]">
              {searchTerm ? "No items found" : "No items available"}
            </div>
          ) : (
            <>
              {filteredItems.map((item) => {
                // Calculate stock for the selected warehouse
                let stockDisplay = null;
                if (item.warehouseStocks && Array.isArray(item.warehouseStocks)) {
                  if (selectedWarehouse) {
                    const ws = item.warehouseStocks.find(w =>
                      w.warehouse && w.warehouse.toLowerCase().trim() === selectedWarehouse.toLowerCase().trim()
                    );
                    const qty = ws ? (parseFloat(ws.stockOnHand) || 0) : 0;
                    stockDisplay = { qty, label: selectedWarehouse };
                  } else {
                    const total = item.warehouseStocks.reduce((sum, w) => sum + (parseFloat(w.stockOnHand) || 0), 0);
                    stockDisplay = { qty: total, label: "All" };
                  }
                }

                return (
                  <div
                    key={item._id}
                    onClick={() => handleSelectItem(item)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8fafc] cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1f2937] truncate">
                        {item.itemName || "Unnamed Item"}
                      </p>
                      {item.sku && (
                        <p className="text-xs text-[#64748b] truncate mt-0.5">SKU: {item.sku}</p>
                      )}
                    </div>
                    {stockDisplay !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        stockDisplay.qty > 0
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-500"
                      }`}>
                        {stockDisplay.qty} in stock
                      </span>
                    )}
                    {selectedItem && selectedItem._id === item._id && (
                      <Check size={16} className="text-[#2563eb] shrink-0" />
                    )}
                  </div>
                );
              })}
              <div
                onClick={() => {
                  onNewItem();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#2563eb] hover:bg-[#f8fafc] cursor-pointer transition-colors border-t border-[#e2e8f0] mt-2"
              >
                <Plus size={16} />
                <span>New Item</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative w-full overflow-visible m-0 p-0">
        <input
          ref={buttonRef}
          onClick={toggleDropdown}
          type="text"
          readOnly
          placeholder="Type or click to select an item."
          value={selectedItem ? selectedItem.itemName : ""}
          className="w-full h-[38px] rounded-none border border-gray-200 bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] transition-colors cursor-pointer px-3 py-1.5"
        />
      </div>
      {typeof document !== "undefined" && document.body && createPortal(dropdownPortal, document.body)}
    </>
  );
};

// New Vendor Credit Form Component
const NewVendorCreditForm = ({ creditId, isEditMode = false }) => {
  const isSidebarOpen = useSidebar();
  const navigate = useNavigate();
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [branch, setBranch] = useState("Brides Berry");
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [creditNoteNumberLoading, setCreditNoteNumberLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [showNumberPreferencesModal, setShowNumberPreferencesModal] = useState(false);
  const [numberPreferences, setNumberPreferences] = useState(() => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem("vendorCreditNumberPreferences");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved preferences:", e);
      }
    }
    return {
      autoGenerate: true,
      prefix: "CN-",
      nextNumber: "00001",
      restartYearly: false,
    };
  });
  const [creditDate, setCreditDate] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  });
  const [subject, setSubject] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [warehouse, setWarehouse] = useState("");
  const [atTransactionLevel, setAtTransactionLevel] = useState("At Transaction Level");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState({ value: "0", type: "%" });
  const [applyDiscountAfterTax, setApplyDiscountAfterTax] = useState(false);
  const [tdsTcsType, setTdsTcsType] = useState("TDS");
  const [tdsTcsTax, setTdsTcsTax] = useState("");
  const [adjustment, setAdjustment] = useState("0.00");
  const [saving, setSaving] = useState(false);

  const [taxOptions] = useState([
    { id: "gst0", name: "GST0", rate: 0, display: "GST0 [0%]" },
    { id: "gst5", name: "GST5", rate: 5, display: "GST5 [5%]" },
    { id: "gst12", name: "GST12", rate: 12, display: "GST12 [12%]" },
    { id: "gst18", name: "GST18", rate: 18, display: "GST18 [18%]" },
    { id: "gst28", name: "GST28", rate: 28, display: "GST28 [28%]" },
  ]);
  const [nonTaxableOptions] = useState([
    {
      id: "out-of-scope",
      name: "Out of Scope",
      description: "Supplies on which you don't charge any GST or include them in the returns.",
    },
    {
      id: "non-gst-supply",
      name: "Non-GST Supply",
      description: "Supplies which do not come under GST such as petroleum products and liquor.",
    },
  ]);

  const [tdsOptions] = useState([
    { id: "tds-commission", name: "Commission or Brokerage", rate: 5, display: "Commission or Brokerage [5%]" },
    { id: "tds-commission-reduced", name: "Commission or Brokerage (Reduced)", rate: 3.75, display: "Commission or Brokerage (Reduced) [3.75%]" },
    { id: "tds-dividend", name: "Dividend", rate: 10, display: "Dividend [10%]" },
    { id: "tds-dividend-reduced", name: "Dividend (Reduced)", rate: 7.5, display: "Dividend (Reduced) [7.5%]" },
    { id: "tds-other-interest", name: "Other Interest than securities", rate: 10, display: "Other Interest than securities [10%]" },
    { id: "tds-other-interest-reduced", name: "Other Interest than securities (Reduced)", rate: 7.5, display: "Other Interest than securities (Reduced) [7.5%]" },
    { id: "tds-contractors-others", name: "Payment of contractors for Others", rate: 2, display: "Payment of contractors for Others [2%]" },
    { id: "tds-contractors-others-reduced", name: "Payment of contractors for Others (Reduced)", rate: 1.5, display: "Payment of contractors for Others (Reduced) [1.5%]" },
    { id: "tds-contractors-huf", name: "Payment of contractors HUF/Indiv", rate: 1, display: "Payment of contractors HUF/Indiv [1%]" },
    { id: "tds-contractors-huf-reduced", name: "Payment of contractors HUF/Indiv (Reduced)", rate: 0.75, display: "Payment of contractors HUF/Indiv (Reduced) [0.75%]" },
    { id: "tds-professional-fees", name: "Professional Fees", rate: 10, display: "Professional Fees [10%]" },
    { id: "tds-professional-fees-reduced", name: "Professional Fees (Reduced)", rate: 7.5, display: "Professional Fees (Reduced) [7.5%]" },
    { id: "tds-rent", name: "Rent on land or furniture etc", rate: 10, display: "Rent on land or furniture etc [10%]" },
    { id: "tds-rent-reduced", name: "Rent on land or furniture etc (Reduced)", rate: 7.5, display: "Rent on land or furniture etc (Reduced) [7.5%]" },
    { id: "tds-technical-fees", name: "Technical Fees (2%)", rate: 2, display: "Technical Fees (2%) [2%]" },
  ]);

  const [tableRows, setTableRows] = useState([
    {
      id: 1,
      item: "",
      itemData: null,
      itemDescription: "",
      account: "",
      size: "",
      quantity: "1.00",
      rate: "0.00",
      tax: "",
      amount: "0.00",
      baseAmount: "0.00",
      discountedAmount: "0.00",
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "0.00",
      lineTaxTotal: "0.00",
      lineTotal: "0.00",
      taxCode: "",
      taxPercent: 0,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
      isInterState: false,
    },
  ]);

  // Calculate GST for a single line item (from Bills.jsx)
  const calculateGSTLineItem = (row, discountConfig, allTaxOptions) => {
    const quantity = parseFloat(row.quantity) || 0;
    const rate = parseFloat(row.rate) || 0;
    // Zoho Books: Calculate base amount and round to 2 decimals immediately
    const rawBaseAmount = quantity * rate;
    const baseAmount = Math.round(rawBaseAmount * 100) / 100;
    // Ensure exactly 2 decimal places
    const roundedBaseAmount = parseFloat(baseAmount.toFixed(2));

    const extractTaxRate = (taxRateValue) => {
      if (!taxRateValue) return null;
      const taxRateStr = String(taxRateValue);
      const bracketMatch = taxRateStr.match(/\[(\d+(?:\.\d+)?)%?\]/);
      if (bracketMatch) {
        return parseFloat(bracketMatch[1]);
      }
      const numberMatch = taxRateStr.replace(/[^\d.]/g, '');
      const taxRate = parseFloat(numberMatch);
      return isNaN(taxRate) ? null : taxRate;
    };

    const selectedTax = allTaxOptions.find(t => t.id === row.tax);
    
    let taxPercent = 0;
    let cgstPercent = 0;
    let sgstPercent = 0;
    let igstPercent = 0;
    let isInterState = false;
    let taxCode = "";

    const itemData = row.itemData;
    let itemTaxRate = null;
    let itemIsInterState = false;

    if (itemData) {
      if (itemData.taxRateIntra) {
        itemTaxRate = extractTaxRate(itemData.taxRateIntra);
        itemIsInterState = false;
      } else if (itemData.taxRateInter) {
        itemTaxRate = extractTaxRate(itemData.taxRateInter);
        itemIsInterState = true;
      }
    }

    if (itemTaxRate !== null) {
      taxPercent = itemTaxRate;
      isInterState = itemIsInterState;
      taxCode = itemData.taxRateIntra || itemData.taxRateInter || row.tax || "";
    } else if (selectedTax && selectedTax.rate !== undefined && selectedTax.rate > 0) {
      taxPercent = selectedTax.rate;
      taxCode = selectedTax.id;
      isInterState = false;
    }

    if (taxPercent > 0) {
      if (isInterState) {
        igstPercent = taxPercent;
      } else {
        cgstPercent = taxPercent / 2;
        sgstPercent = taxPercent / 2;
      }
    }

    let discountedAmount = roundedBaseAmount;
    let amountForTaxCalculation = roundedBaseAmount;
    
    if (!discountConfig.applyAfterTax && discountConfig.value && parseFloat(discountConfig.value) > 0) {
      if (discountConfig.type === "%") {
        const discountPercent = parseFloat(discountConfig.value);
        discountedAmount = baseAmount - (baseAmount * discountPercent / 100);
      }
      discountedAmount = Math.max(0, discountedAmount);
      // Round to 2 decimal places
      discountedAmount = parseFloat(discountedAmount.toFixed(2));
      amountForTaxCalculation = discountedAmount;
    } else {
      // Ensure baseAmount is rounded to 2 decimals before tax calculation (Zoho Books behavior)
      amountForTaxCalculation = parseFloat(baseAmount.toFixed(2));
    }

    // Zoho Books: Round amountForTaxCalculation to 2 decimals before calculating tax
    amountForTaxCalculation = parseFloat(amountForTaxCalculation.toFixed(2));

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (isInterState && igstPercent > 0) {
      // Zoho Books: Calculate tax on rounded amount, round to 2 decimals using standard rounding
      // Formula: round(amount * rate / 100) to 2 decimals
      const taxValue = (amountForTaxCalculation * igstPercent) / 100;
      // Round to 2 decimal places (Zoho Books uses standard rounding)
      igstAmount = Math.round(taxValue * 100) / 100;
    } else if (!isInterState && (cgstPercent > 0 || sgstPercent > 0)) {
      // Zoho Books: Calculate tax on rounded amount, round to 2 decimals using standard rounding
      const cgstValue = (amountForTaxCalculation * cgstPercent) / 100;
      const sgstValue = (amountForTaxCalculation * sgstPercent) / 100;
      // Round to 2 decimal places (Zoho Books uses standard rounding)
      cgstAmount = Math.round(cgstValue * 100) / 100;
      sgstAmount = Math.round(sgstValue * 100) / 100;
    }

    // Round lineTaxTotal to avoid floating point precision issues
    const lineTaxTotal = parseFloat((cgstAmount + sgstAmount + igstAmount).toFixed(2));
    const lineTotal = discountedAmount + lineTaxTotal;

    return {
      baseAmount: roundedBaseAmount.toFixed(2),
      discountedAmount: discountedAmount.toFixed(2),
      cgstAmount: cgstAmount.toFixed(2),
      sgstAmount: sgstAmount.toFixed(2),
      igstAmount: igstAmount.toFixed(2),
      lineTaxTotal: lineTaxTotal.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      taxCode,
      taxPercent,
      cgstPercent,
      sgstPercent,
      igstPercent,
      isInterState,
    };
  };

  const handleUpdateRow = (rowId, field, value) => {
    setTableRows(
      tableRows.map((row) => {
        if (row.id === rowId) {
          const updated = { ...row, [field]: value };
          
          if (field === "item" && typeof value === 'object' && value !== null) {
            updated.itemData = value;
            updated.item = value.itemName || value._id || "";
            
            if (value.sellingPrice !== undefined && value.sellingPrice !== null && (!updated.rate || updated.rate === "0.00" || updated.rate === "0")) {
              updated.rate = value.sellingPrice.toString();
            }
            
            if (value.salesAccount && !updated.account) {
              updated.account = value.salesAccount;
            }
            
            if (value.size && !updated.size) {
              updated.size = value.size;
            }
            
            let matchedTaxId = null;
            const extractTaxRate = (taxRateValue) => {
              if (!taxRateValue) return null;
              const taxRateStr = String(taxRateValue);
              const bracketMatch = taxRateStr.match(/\[(\d+(?:\.\d+)?)%?\]/);
              if (bracketMatch) {
                return parseFloat(bracketMatch[1]);
              }
              const numberMatch = taxRateStr.replace(/[^\d.]/g, '');
              const taxRate = parseFloat(numberMatch);
              return isNaN(taxRate) ? null : taxRate;
            };
            
            const matchTaxByRate = (taxRateValue) => {
              const taxRate = extractTaxRate(taxRateValue);
              if (taxRate === null) return null;
              const exactMatch = taxOptions.find(tax => tax.rate === taxRate);
              if (exactMatch) return exactMatch.id;
              const roundedRate = Math.round(taxRate);
              const roundedMatch = taxOptions.find(tax => tax.rate === roundedRate);
              if (roundedMatch) return roundedMatch.id;
              return null;
            };
            
            if (value.taxRateIntra) {
              matchedTaxId = matchTaxByRate(value.taxRateIntra);
            }
            
            if (!matchedTaxId && value.taxRateInter) {
              matchedTaxId = matchTaxByRate(value.taxRateInter);
            }
            
            if (!matchedTaxId && value.taxPreference === "non-taxable") {
              matchedTaxId = nonTaxableOptions[0]?.id || "";
            }
            
            if (matchedTaxId) {
              updated.tax = matchedTaxId;
            } else if (value.taxRateIntra || value.taxRateInter) {
              const itemTaxRate = extractTaxRate(value.taxRateIntra || value.taxRateInter);
              if (itemTaxRate !== null) {
                const closestTax = taxOptions.reduce((closest, tax) => {
                  if (!closest) return tax;
                  const currentDiff = Math.abs(tax.rate - itemTaxRate);
                  const closestDiff = Math.abs(closest.rate - itemTaxRate);
                  return currentDiff < closestDiff ? tax : closest;
                }, null);
                
                if (closestTax) {
                  updated.tax = closestTax.id;
                }
              }
            }
          }
          
          // If tax is manually changed (not when item is selected), prioritize the manually selected tax
          // Clear itemData tax preference so that manually selected tax is used instead
          if (field === "tax" && updated.itemData) {
            // When user manually changes tax, ignore item's default tax and use the manually selected one
            // Create a copy of itemData without tax info to force using selected tax
            updated.itemData = {
              ...updated.itemData,
              taxRateIntra: null,
              taxRateInter: null,
              taxPreference: null
            };
          }
          
          const allTaxOptions = [...taxOptions, ...nonTaxableOptions];
          const discountConfig = {
            value: discount.value,
            type: discount.type,
            applyAfterTax: applyDiscountAfterTax,
          };
          
          const gstCalculation = calculateGSTLineItem(updated, discountConfig, allTaxOptions);
          
          updated.baseAmount = gstCalculation.baseAmount;
          updated.discountedAmount = gstCalculation.discountedAmount;
          updated.cgstAmount = gstCalculation.cgstAmount;
          updated.sgstAmount = gstCalculation.sgstAmount;
          updated.igstAmount = gstCalculation.igstAmount;
          updated.lineTaxTotal = gstCalculation.lineTaxTotal;
          updated.lineTotal = gstCalculation.lineTotal;
          updated.taxCode = gstCalculation.taxCode;
          updated.taxPercent = gstCalculation.taxPercent;
          updated.cgstPercent = gstCalculation.cgstPercent;
          updated.sgstPercent = gstCalculation.sgstPercent;
          updated.igstPercent = gstCalculation.igstPercent;
          updated.isInterState = gstCalculation.isInterState;
          updated.amount = gstCalculation.baseAmount;
          
          return updated;
        }
        return row;
      })
    );
  };

  useEffect(() => {
    if (tableRows.length === 0) return;
    
    const allTaxOptions = [...taxOptions, ...nonTaxableOptions];
    const discountConfig = {
      value: discount.value,
      type: discount.type,
      applyAfterTax: applyDiscountAfterTax,
    };

    setTableRows(prevRows => 
      prevRows.map(row => {
        const gstCalculation = calculateGSTLineItem(row, discountConfig, allTaxOptions);
        return {
          ...row,
          ...gstCalculation,
          amount: gstCalculation.baseAmount,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount.value, discount.type, applyDiscountAfterTax]);

  const handleAddRow = () => {
    const newRow = {
      id: Date.now(),
      item: "",
      itemData: null,
      itemDescription: "",
      account: "",
      size: "",
      quantity: "1.00",
      rate: "0.00",
      tax: "",
      amount: "0.00",
      baseAmount: "0.00",
      discountedAmount: "0.00",
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "0.00",
      lineTaxTotal: "0.00",
      lineTotal: "0.00",
      taxCode: "",
      taxPercent: 0,
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 0,
      isInterState: false,
    };
    setTableRows([...tableRows, newRow]);
  };

  const handleDeleteRow = (rowId) => {
    setTableRows(rows => rows.filter(row => row.id !== rowId));
  };

  // Calculate totals (from Bills.jsx)
  const calculateTotals = () => {
    const allTaxOptions = [...taxOptions, ...nonTaxableOptions];
    const discountConfig = {
      value: discount.value,
      type: discount.type,
      applyAfterTax: applyDiscountAfterTax,
    };

    const recalculatedRows = tableRows.map(row => {
      const gstCalculation = calculateGSTLineItem(row, discountConfig, allTaxOptions);
      return {
        ...row,
        ...gstCalculation,
        amount: gstCalculation.baseAmount,
      };
    });

    // Calculate subtotal - Zoho Books rounds subtotal to 2 decimals
    let subTotal = 0;
    if (applyDiscountAfterTax) {
      subTotal = recalculatedRows.reduce((sum, row) => {
        return sum + (parseFloat(row.baseAmount) || 0);
      }, 0);
    } else {
      subTotal = recalculatedRows.reduce((sum, row) => {
        return sum + (parseFloat(row.discountedAmount) || 0);
      }, 0);
    }
    // Round subtotal to 2 decimals (Zoho Books behavior)
    subTotal = parseFloat(subTotal.toFixed(2));

    // Total Tax = sum of all lineTaxTotal values (each already rounded to 2 decimals)
    // Zoho Books: Sum the rounded line tax totals, then round the sum to 2 decimals
    const calculatedTotalTax = recalculatedRows.reduce((sum, row) => {
      return sum + (parseFloat(row.lineTaxTotal) || 0);
    }, 0);
    
    // Round to 2 decimal places (Zoho Books behavior)
    const roundedCalculatedTotalTax = parseFloat(calculatedTotalTax.toFixed(2));
    const totalTax = roundedCalculatedTotalTax;

    let discountAmount = 0;
    if (discount.value && parseFloat(discount.value) > 0) {
      if (applyDiscountAfterTax) {
        if (discount.type === "%") {
          discountAmount = ((subTotal + totalTax) * parseFloat(discount.value)) / 100;
        } else {
          discountAmount = parseFloat(discount.value) || 0;
        }
      } else {
        const totalBaseAmount = recalculatedRows.reduce((sum, row) => {
          return sum + (parseFloat(row.baseAmount) || 0);
        }, 0);
        if (discount.type === "%") {
          discountAmount = (totalBaseAmount * parseFloat(discount.value)) / 100;
        } else {
          discountAmount = parseFloat(discount.value) || 0;
        }
      }
    }

    // Aggregate tax breakdown - Show CGST and SGST separately
    const taxBreakdown = [];
    const cgstMap = new Map(); // rate -> amount
    const sgstMap = new Map(); // rate -> amount
    const igstMap = new Map(); // rate -> amount
    
    recalculatedRows.forEach((row) => {
      if (row.taxPercent > 0) {
        if (row.isInterState && row.igstPercent > 0 && parseFloat(row.igstAmount) > 0) {
          // Inter-state: IGST
          const igstRate = row.igstPercent;
          if (igstMap.has(igstRate)) {
            igstMap.set(igstRate, igstMap.get(igstRate) + parseFloat(row.igstAmount) || 0);
          } else {
            igstMap.set(igstRate, parseFloat(row.igstAmount) || 0);
          }
        } else if (!row.isInterState && (row.cgstPercent > 0 || row.sgstPercent > 0)) {
          // Intra-state: Separate CGST and SGST
          if (row.cgstPercent > 0 && parseFloat(row.cgstAmount) > 0) {
            const cgstRate = row.cgstPercent;
            if (cgstMap.has(cgstRate)) {
              cgstMap.set(cgstRate, cgstMap.get(cgstRate) + parseFloat(row.cgstAmount) || 0);
            } else {
              cgstMap.set(cgstRate, parseFloat(row.cgstAmount) || 0);
            }
          }
          if (row.sgstPercent > 0 && parseFloat(row.sgstAmount) > 0) {
            const sgstRate = row.sgstPercent;
            if (sgstMap.has(sgstRate)) {
              sgstMap.set(sgstRate, sgstMap.get(sgstRate) + parseFloat(row.sgstAmount) || 0);
            } else {
              sgstMap.set(sgstRate, parseFloat(row.sgstAmount) || 0);
            }
          }
        }
      }
    });

    // Add CGST entries
    Array.from(cgstMap.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([rate, amount]) => {
        taxBreakdown.push({ type: 'CGST', rate, amount });
      });

    // Add SGST entries
    Array.from(sgstMap.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([rate, amount]) => {
        taxBreakdown.push({ type: 'SGST', rate, amount });
      });

    // Add IGST entries
    Array.from(igstMap.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([rate, amount]) => {
        taxBreakdown.push({ type: 'IGST', rate, amount });
      });

    // Calculate TDS/TCS
    // Zoho Books TDS calculation: TDS is calculated on Subtotal (before tax)
    let tdsTcsAmount = 0;
    if (tdsTcsTax) {
      // Check both regular tax options and TDS options
      const allTdsTcsOptions = [...taxOptions, ...tdsOptions];
      const selectedTdsTcsTax = allTdsTcsOptions.find(t => t.id === tdsTcsTax);
      if (selectedTdsTcsTax && selectedTdsTcsTax.rate !== undefined) {
        // Calculate base amount for TDS calculation (Zoho calculates TDS on subtotal only)
        let baseAmountForTds = 0;
        
        if (applyDiscountAfterTax) {
          // Discount applied after tax: TDS base = subtotal (discount not applied to subtotal yet)
          baseAmountForTds = subTotal;
        } else {
          // Discount applied before tax: subtotal already includes discount
          // TDS base = discounted subtotal
          baseAmountForTds = subTotal;
        }
        
        // Calculate TDS amount: base amount × TDS rate / 100
        tdsTcsAmount = (baseAmountForTds * selectedTdsTcsTax.rate) / 100;
      }
    }

    const adjustmentAmount = parseFloat(adjustment) || 0;

    // Calculate final total (Zoho Books formula)
    let finalTotal = 0;
    
    if (applyDiscountAfterTax) {
      // Discount applied after tax: subtotal + tax - discount - tds/tcs + adjustment
      finalTotal = subTotal + totalTax - discountAmount - tdsTcsAmount + adjustmentAmount;
    } else {
      // Discount applied before tax: subtotal already includes discount, so just add tax
      // subtotal = sum of discountedAmount, so: subtotal + tax - tds/tcs + adjustment
      finalTotal = subTotal + totalTax - tdsTcsAmount + adjustmentAmount;
    }

    return {
      subTotal: subTotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxBreakdown,
      totalTax: totalTax.toFixed(2),
      tdsTcsAmount: tdsTcsAmount.toFixed(2),
      adjustment: adjustmentAmount.toFixed(2),
      total: finalTotal.toFixed(2),
    };
  };

  const totals = calculateTotals();

  // Fetch next credit note number when creating a new credit
  useEffect(() => {
    if (!isEditMode && numberPreferences.autoGenerate) {
      const fetchNextCreditNoteNumber = async () => {
        setCreditNoteNumberLoading(true);
        try {
          const response = await fetch(`${API_URL}/api/purchase/vendor-credits/next-number?prefix=${encodeURIComponent(numberPreferences.prefix || "CN-")}`);
          if (response.ok) {
            const data = await response.json();
            setCreditNoteNumber(data.creditNoteNumber || "");
            // Update next number in preferences
            if (data.nextNumber) {
              const updatedPrefs = { ...numberPreferences, nextNumber: data.nextNumber };
              setNumberPreferences(updatedPrefs);
              localStorage.setItem("vendorCreditNumberPreferences", JSON.stringify(updatedPrefs));
            }
          }
        } catch (error) {
          console.error("Error fetching next credit note number:", error);
        } finally {
          setCreditNoteNumberLoading(false);
        }
      };
      fetchNextCreditNoteNumber();
    } else if (!isEditMode && !numberPreferences.autoGenerate) {
      // Manual mode - clear the field
      setCreditNoteNumber("");
    }
  }, [isEditMode, API_URL, numberPreferences.autoGenerate, numberPreferences.prefix]);

  // Handle saving number preferences
  const handleSaveNumberPreferences = async (prefs) => {
    setNumberPreferences(prefs);
    localStorage.setItem("vendorCreditNumberPreferences", JSON.stringify(prefs));
    
    // Update next number in preferences
    if (prefs.autoGenerate) {
      try {
        const response = await fetch(`${API_URL}/api/purchase/vendor-credits/next-number?prefix=${encodeURIComponent(prefs.prefix || "CN-")}`);
        if (response.ok) {
          const data = await response.json();
          const updatedPrefs = { ...prefs, nextNumber: data.nextNumber || prefs.nextNumber };
          setNumberPreferences(updatedPrefs);
          localStorage.setItem("vendorCreditNumberPreferences", JSON.stringify(updatedPrefs));
        }
      } catch (error) {
        console.error("Error fetching next number:", error);
      }
    }
    
    // Refresh the credit note number if auto-generate is enabled
    if (prefs.autoGenerate && !isEditMode) {
      setCreditNoteNumber("");
      // Trigger refetch
      const fetchNextCreditNoteNumber = async () => {
        setCreditNoteNumberLoading(true);
        try {
          const response = await fetch(`${API_URL}/api/purchase/vendor-credits/next-number?prefix=${encodeURIComponent(prefs.prefix || "CN-")}`);
          if (response.ok) {
            const data = await response.json();
            setCreditNoteNumber(data.creditNoteNumber || "");
          }
        } catch (error) {
          console.error("Error fetching next credit note number:", error);
        } finally {
          setCreditNoteNumberLoading(false);
        }
      };
      fetchNextCreditNoteNumber();
    }
  };

  const [loadingCredit, setLoadingCredit] = useState(false);

  // Load credit data when in edit mode
  useEffect(() => {
    if (isEditMode && creditId) {
      const loadCredit = async () => {
        setLoadingCredit(true);
        try {
          const response = await fetch(`${API_URL}/api/purchase/vendor-credits/${creditId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch vendor credit");
          }
          const creditData = await response.json();
          
          // Helper function to format date for input field (dd/MM/yyyy)
          const formatDateForInput = (date) => {
            if (!date) return "";
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
          };
          
          // Populate form fields
          setCreditNoteNumber(creditData.creditNoteNumber || "");
          setOrderNumber(creditData.orderNumber || "");
          setCreditDate(formatDateForInput(creditData.creditDate));
          setBranch(creditData.branch || "Brides Berry");
          setSubject(creditData.subject || "");
          setReverseCharge(creditData.reverseCharge || false);
          setWarehouse(creditData.warehouse || "");
          setAtTransactionLevel(creditData.atTransactionLevel || "At Transaction Level");
          setNotes(creditData.notes || "");
          setDiscount(creditData.discount || { value: "0", type: "%" });
          setApplyDiscountAfterTax(creditData.applyDiscountAfterTax || false);
          setTdsTcsType(creditData.tdsTcsType || "TDS");
          setTdsTcsTax(creditData.tdsTcsTax || "");
          setAdjustment(creditData.adjustment?.toString() || "0.00");
          
          // Set vendor
          if (creditData.vendorName) {
            // Try to fetch vendor details if vendorId exists
            if (creditData.vendorId) {
              try {
                const vendorResponse = await fetch(`${API_URL}/api/purchase/vendors/${creditData.vendorId}`);
                if (vendorResponse.ok) {
                  const vendorData = await vendorResponse.json();
                  setSelectedVendor(vendorData);
                }
              } catch (error) {
                console.error("Error fetching vendor:", error);
              }
            }
          }
          
          // Set items
          if (creditData.items && Array.isArray(creditData.items)) {
            const rows = creditData.items.map((item, index) => ({
              id: index + 1,
              item: item.itemName || "",
              itemData: item.itemId ? { _id: item.itemId, itemName: item.itemName } : null,
              itemDescription: item.itemDescription || "",
              account: item.account || "",
              size: item.size || "",
              quantity: (item.quantity || 0).toString(),
              rate: (item.rate || 0).toString(),
              tax: item.taxCode || "",
              amount: (item.amount || 0).toString(),
              baseAmount: (item.baseAmount || 0).toString(),
              discountedAmount: (item.discountedAmount || 0).toString(),
              cgstAmount: (item.cgstAmount || 0).toString(),
              sgstAmount: (item.sgstAmount || 0).toString(),
              igstAmount: (item.igstAmount || 0).toString(),
              lineTaxTotal: (item.lineTaxTotal || 0).toString(),
              lineTotal: (item.lineTotal || 0).toString(),
              taxCode: item.taxCode || "",
              taxPercent: item.taxPercent || 0,
              cgstPercent: item.cgstPercent || 0,
              sgstPercent: item.sgstPercent || 0,
              igstPercent: item.igstPercent || 0,
              isInterState: item.isInterState || false,
            }));
            setTableRows(rows.length > 0 ? rows : [{ id: 1, item: "", itemData: null, itemDescription: "", account: "", size: "", quantity: "1.00", rate: "0.00", tax: "", amount: "0.00", baseAmount: "0.00", discountedAmount: "0.00", cgstAmount: "0.00", sgstAmount: "0.00", igstAmount: "0.00", lineTaxTotal: "0.00", lineTotal: "0.00", taxCode: "", taxPercent: 0, cgstPercent: 0, sgstPercent: 0, igstPercent: 0, isInterState: false }]);
          }
        } catch (error) {
          console.error("Error loading vendor credit:", error);
          alert("Failed to load vendor credit for editing.");
          navigate("/purchase/vendor-credits");
        } finally {
          setLoadingCredit(false);
        }
      };
      loadCredit();
    }
  }, [isEditMode, creditId, API_URL, navigate]);

  const handleSaveCredit = async (status) => {
    if (!selectedVendor || !creditDate) {
      alert("Please fill in Vendor Name and Credit Date.");
      return;
    }
    
    // Credit note number will be auto-generated if not provided
    if (!creditNoteNumber && !isEditMode) {
      alert("Please wait for credit note number to be generated.");
      return;
    }

    setSaving(true);
    try {
      // Get user info
      const userStr = localStorage.getItem("rootfinuser");
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?.email || user?._id || user?.id || user?.locCode || null;
      const locCode = user?.locCode || "";

      if (!userId) {
        alert("User not logged in. Please log in to save vendor credits.");
        setSaving(false);
        return;
      }

      // Parse date
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
        return new Date(dateStr);
      };

      const creditDateObj = parseDate(creditDate);

      // Prepare items array
      const items = tableRows.map(row => ({
        itemId: row.itemData?._id || null,
        itemName: row.item || row.itemData?.itemName || "",
        itemDescription: row.itemDescription || "",
        account: row.account || "",
        size: row.size || "",
        quantity: parseFloat(row.quantity) || 0,
        rate: parseFloat(row.rate) || 0,
        tax: row.tax || "",
        amount: parseFloat(row.amount) || 0,
        baseAmount: parseFloat(row.baseAmount) || 0,
        discountedAmount: parseFloat(row.discountedAmount) || 0,
        cgstAmount: parseFloat(row.cgstAmount) || 0,
        sgstAmount: parseFloat(row.sgstAmount) || 0,
        igstAmount: parseFloat(row.igstAmount) || 0,
        lineTaxTotal: parseFloat(row.lineTaxTotal) || 0,
        lineTotal: parseFloat(row.lineTotal) || 0,
        taxCode: row.taxCode || "",
        taxPercent: row.taxPercent || 0,
        cgstPercent: row.cgstPercent || 0,
        sgstPercent: row.sgstPercent || 0,
        igstPercent: row.igstPercent || 0,
        isInterState: row.isInterState || false,
        itemGroupId: row.itemData?.itemGroupId || row.itemData?.groupId || null,
        itemSku: row.itemData?.sku || row.sku || "",
      }));

      // Prepare vendor credit data
      const creditData = {
        vendorId: selectedVendor._id || selectedVendor.id || null,
        vendorName: selectedVendor.displayName || selectedVendor.companyName || "",
        branch: branch,
        creditNoteNumber: creditNoteNumber,
        orderNumber: orderNumber || "",
        creditDate: creditDateObj,
        subject: subject || "",
        reverseCharge: reverseCharge,
        warehouse: warehouse || "",
        atTransactionLevel: atTransactionLevel,
        items: items,
        discount: {
          value: discount.value,
          type: discount.type,
        },
        applyDiscountAfterTax: applyDiscountAfterTax,
        totalTaxAmount: parseFloat(totals.totalTax) || 0,
        tdsTcsType: tdsTcsType,
        tdsTcsTax: tdsTcsTax || "",
        tdsTcsAmount: parseFloat(totals.tdsTcsAmount) || 0,
        adjustment: parseFloat(adjustment) || 0,
        subTotal: parseFloat(totals.subTotal) || 0,
        discountAmount: parseFloat(totals.discountAmount) || 0,
        totalTax: parseFloat(totals.totalTax) || 0,
        finalTotal: parseFloat(totals.total) || 0,
        notes: notes || "",
        userId: userId,
        locCode: locCode,
        status: status, // "draft" or "open"
      };

      // Save to PostgreSQL
      const method = isEditMode ? "PUT" : "POST";
      const url = isEditMode ? `${API_URL}/api/purchase/vendor-credits/${creditId}` : `${API_URL}/api/purchase/vendor-credits`;
      
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(creditData),
      });

      if (!response.ok) {
        let errorMessage = isEditMode ? "Failed to update vendor credit" : "Failed to save vendor credit";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const savedCredit = await response.json();
      // Dispatch event to refresh the list
      window.dispatchEvent(new Event("vendorCreditSaved"));
      alert(`Vendor Credit ${isEditMode ? "updated" : "saved"} successfully as ${status === "draft" ? "Draft" : "Open"}`);
      navigate("/purchase/vendor-credits");
    } catch (error) {
      console.error("Error saving vendor credit:", error);
      alert(error.message || "Failed to save vendor credit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="invoice-page-wrapper min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title={isEditMode ? "Edit Purchase Return" : "Add Purchase Return"} />
      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#1B1B1B]">
            {isEditMode ? "Edit Purchase Return" : "New Purchase Return"}
          </h1>
          <Link
            to="/purchase/vendor-credits"
            className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[10px] border border-[#E5E5E5] bg-white hover:bg-[#FAFAFA] text-[13px] font-medium text-[#9D43D6] transition-colors"
          >
            <X size={14} className="text-[#9D43D6]" />
            <span>Close</span>
          </Link>
        </div>

        <div className="p-5 md:p-6 space-y-5">
        {/* Main Form Card */}
        <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 space-y-6">
          {/* Vendor and Credit Details */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label required>Vendor Name</Label>
                <VendorDropdown
                  value={selectedVendor}
                  onChange={(vendor) => setSelectedVendor(vendor)}
                  onNewVendor={() => navigate("/purchase/vendors/new")}
                />
              </div>

              <div>
                <Label>Branch</Label>
                <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="Brides Berry">Brides Berry</option>
                  <option value="Warehouse">Warehouse</option>
                </Select>
              </div>

              <div>
                <Label required>Credit Note#</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={creditNoteNumberLoading ? "Generating..." : creditNoteNumber}
                    onChange={(e) => setCreditNoteNumber(e.target.value)}
                    placeholder={numberPreferences.autoGenerate ? "" : "Enter credit note number"}
                    readOnly={!isEditMode && numberPreferences.autoGenerate}
                    className={!isEditMode && numberPreferences.autoGenerate ? "bg-[#FAFAFA] cursor-not-allowed" : ""}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNumberPreferencesModal(true)}
                    className="h-[42px] w-[42px] rounded-[10px] bg-[#9D43D6] hover:bg-[#8732BE] text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
                    title="Configure Credit Note Number Preferences"
                  >
                    <Info size={16} />
                  </button>
                </div>
              </div>

              <div>
                <Label>Order Number</Label>
                <Input
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Enter order number"
                />
              </div>

              <div>
                <Label>Vendor Credit Date</Label>
                <Input
                  type="text"
                  value={creditDate}
                  onChange={(e) => setCreditDate(e.target.value)}
                  placeholder="dd/mm/yyyy"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <div className="relative">
                  <textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter a subject within 250 characters"
                    maxLength={250}
                    className="w-full rounded-[10px] border border-[#E5E5E5] bg-white text-[13px] text-[#212121] placeholder:text-[#A1A1AA] focus:border-[#9D43D6] focus:outline-none focus:ring-2 focus:ring-[#9D43D6]/15 transition-colors px-3.5 py-2.5 min-h-[96px] resize-none"
                  />
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      className="p-1 text-[#7A7A7A] hover:text-[#1B1B1B] transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="h-5 w-5 rounded-[6px] bg-[#9D43D6] text-white hover:bg-[#8732BE] transition-colors flex items-center justify-center cursor-pointer"
                      title="Information"
                    >
                      <Info size={11} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reverseCharge"
                  checked={reverseCharge}
                  onChange={(e) => setReverseCharge(e.target.checked)}
                  className="h-4 w-4 rounded-[4px] border-gray-300 accent-[#9D43D6] cursor-pointer"
                />
                <label htmlFor="reverseCharge" className="text-[13px] font-medium text-[#212121] cursor-pointer">
                  This transaction is applicable for reverse charge
                </label>
              </div>

              <div>
                <Label>Warehouse</Label>
                <Select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                  <option value="">Select a warehouse</option>
                  <option value="Brides Berry">Brides Berry</option>
                  <option value="Warehouse">Warehouse</option>
                </Select>
              </div>

              <div>
                <Label>At Transaction Level</Label>
                <Select value={atTransactionLevel} onChange={(e) => setAtTransactionLevel(e.target.value)}>
                  <option>At Transaction Level</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-t border-[#F0F0F0] pt-6">
            <div className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-visible mb-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-full text-left">
                  <thead className="bg-[#1B1B1B]">
                    <tr className="text-white text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4 text-left">ITEM DETAILS</th>
                      <th className="py-3.5 px-4 text-left">ACCOUNT</th>
                      <th className="py-3.5 px-4 text-center">SIZE</th>
                      <th className="py-3.5 px-4 text-center">QUANTITY</th>
                      <th className="py-3.5 px-4 text-center">RATE</th>
                      <th className="py-3.5 px-4 text-left">TAX</th>
                      <th className="py-3.5 px-4 text-right">AMOUNT</th>
                      <th className="w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0] bg-white">
                    {tableRows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#F4F4F5] border border-[#E5E5E5]">
                              <ImageIcon size={16} className="text-[#9CA3AF]" />
                            </div>
                            <ItemDropdown
                              rowId={row.id}
                              value={row.itemData || row.item}
                              onChange={(value) => handleUpdateRow(row.id, "item", value)}
                              onNewItem={() => navigate("/shoe-sales/items/new")}
                              selectedWarehouse={warehouse}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Select
                            value={row.account}
                            onChange={(e) => handleUpdateRow(row.id, "account", e.target.value)}
                            className="table-input"
                          >
                            <option value="">Select an account</option>
                          </Select>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Input
                            value={row.size}
                            onChange={(e) => handleUpdateRow(row.id, "size", e.target.value)}
                            className="table-input text-center"
                            placeholder="Size"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => handleUpdateRow(row.id, "quantity", e.target.value)}
                            className="table-input text-center"
                            step="0.01"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              value={row.rate}
                              onChange={(e) => handleUpdateRow(row.id, "rate", e.target.value)}
                              className="table-input text-center"
                              step="0.01"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <TaxDropdown
                            rowId={row.id}
                            value={row.tax}
                            onChange={(value) => handleUpdateRow(row.id, "tax", value)}
                            taxOptions={taxOptions}
                            nonTaxableOptions={nonTaxableOptions}
                            onNewTax={() => {}}
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Input
                            value={row.amount}
                            readOnly
                            className="table-input text-right font-semibold text-[#1B1B1B] bg-[#FAFAFA]"
                          />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="w-8 h-8 rounded-[8px] bg-[#FEE2E2]/70 hover:bg-[#FEE2E2] text-[#EF4444] inline-flex items-center justify-center transition-colors cursor-pointer"
                            title="Delete row"
                          >
                            <X size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex h-[38px] items-center gap-1.5 px-4 text-[13px] font-medium text-[#212121] bg-[#F4F4F5] hover:bg-[#E5E5E5] rounded-[10px] transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Row</span>
              </button>
            </div>
          </div>

          {/* Notes, Attachments, and Summary Section */}
          <div className="grid gap-6 md:grid-cols-2 border-t border-[#F0F0F0] pt-6">
            {/* Left: Notes and Attachments */}
            <div className="space-y-5">
              {/* Notes */}
              <div>
                <Label>Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes or terms..."
                  className="w-full rounded-[10px] border border-[#E5E5E5] bg-white text-[13px] text-[#212121] placeholder:text-[#A1A1AA] focus:border-[#9D43D6] focus:outline-none focus:ring-2 focus:ring-[#9D43D6]/15 transition-colors px-3.5 py-2.5 min-h-[130px] resize-none"
                />
              </div>

              {/* Attachments */}
              <div>
                <Label>Attach File(s) to Purchase Return</Label>
                <div className="border-2 border-dashed border-[#E5E5E5] rounded-[14px] p-6 text-center bg-[#FAFAFA]">
                  <button
                    type="button"
                    className="rf-btn-primary inline-flex items-center gap-2 !h-[38px] !px-5 !text-[13px]"
                  >
                    <Upload size={14} />
                    <span>Upload File</span>
                  </button>
                  <p className="mt-2.5 text-[12px] text-[#8A8A8A]">
                    You can upload a maximum of 5 files, 10MB each
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Summary */}
            <div className="space-y-4 bg-[#FAFAFA] rounded-[16px] border border-[#E5E5E5] p-6">
              <div className="text-[#9D43D6] font-bold text-[11px] tracking-wider uppercase">
                RETURN SUMMARY
              </div>

              {/* Sub Total */}
              <div className="flex items-center justify-between text-[14px] font-semibold text-[#1B1B1B] pb-3 border-b border-[#E5E5E5]">
                <span>Sub Total</span>
                <span className="tabular-nums">{totals.subTotal}</span>
              </div>

              {/* Discount Section */}
              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[#212121]">Discount</span>
                  <div className="flex items-center gap-2">
                    <Input 
                      className="w-20 text-[13px] text-right table-input" 
                      value={discount.value}
                      onChange={(e) => setDiscount({ ...discount, value: e.target.value })}
                      type="number"
                      step="0.01"
                    />
                    <Select 
                      className="w-16 text-[13px] table-input"
                      value={discount.type}
                      onChange={(e) => setDiscount({ ...discount, type: e.target.value })}
                    >
                      <option value="%">%</option>
                      <option value="₹">₹</option>
                    </Select>
                  </div>
                  <span className="text-[13px] font-medium text-[#7A7A7A] w-20 text-right tabular-nums">{totals.discountAmount}</span>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setApplyDiscountAfterTax(!applyDiscountAfterTax)}
                    className={`text-[12px] font-medium cursor-pointer ${applyDiscountAfterTax ? 'text-[#9D43D6]' : 'text-[#7A7A7A]'} hover:text-[#9D43D6] transition-colors`}
                  >
                    Apply after tax
                  </button>
                </div>
              </div>

              {/* Tax Details */}
              {totals.taxBreakdown && totals.taxBreakdown.length > 0 && (
                <div className="space-y-1.5 py-2 border-t border-[#E5E5E5]">
                  {totals.taxBreakdown.map((tax, idx) => {
                    const taxType = tax.type;
                    const taxRate = tax.rate;
                    const taxAmount = tax.amount;
                    const rateDisplay = taxRate % 1 === 0 ? taxRate.toFixed(0) : taxRate.toFixed(1);
                    return (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-[13px] text-[#7A7A7A]">
                          {taxType}{rateDisplay} [{rateDisplay}%]
                        </span>
                        <span className="text-[13px] font-medium text-[#1B1B1B] tabular-nums">{taxAmount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Tax Amount */}
              {totals.taxBreakdown && totals.taxBreakdown.length > 0 && (
                <div className="flex items-center justify-between py-1 border-t border-[#E5E5E5]">
                  <span className="text-[13px] font-medium text-[#1B1B1B]">Total Tax Amount</span>
                  <span className="text-[13px] font-semibold text-[#1B1B1B] tabular-nums">{totals.totalTax}</span>
                </div>
              )}

              {/* TDS/TCS Section */}
              <div className="space-y-2 py-2 border-t border-[#E5E5E5]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[13px] font-medium text-[#212121]">
                      <input
                        type="radio"
                        name="tdsTcsType"
                        value="TDS"
                        checked={tdsTcsType === "TDS"}
                        onChange={(e) => {
                          setTdsTcsType(e.target.value);
                          setTdsTcsTax("");
                        }}
                        className="accent-[#9D43D6] h-4 w-4"
                      />
                      <span>TDS</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[13px] font-medium text-[#212121]">
                      <input
                        type="radio"
                        name="tdsTcsType"
                        value="TCS"
                        checked={tdsTcsType === "TCS"}
                        onChange={(e) => {
                          setTdsTcsType(e.target.value);
                          setTdsTcsTax("");
                        }}
                        className="accent-[#9D43D6] h-4 w-4"
                      />
                      <span>TCS</span>
                    </label>
                  </div>
                  <div className="flex-1 max-w-[180px]">
                    <Select
                      value={tdsTcsTax}
                      onChange={(e) => setTdsTcsTax(e.target.value)}
                      className="table-input"
                    >
                      <option value="">Select a Tax</option>
                      {tdsOptions.map(option => (
                        <option key={option.id} value={option.id}>{option.display}</option>
                      ))}
                    </Select>
                  </div>
                  <span className="text-[13px] font-medium text-[#7A7A7A] w-20 text-right tabular-nums">- {totals.tdsTcsAmount}</span>
                </div>
              </div>

              {/* Adjustment */}
              <div className="flex items-center justify-between gap-2 py-2 border-t border-[#E5E5E5]">
                <span className="text-[13px] font-medium text-[#212121]">Adjustment</span>
                <div className="flex items-center gap-2">
                  <Input 
                    className="w-24 text-[13px] text-right table-input" 
                    value={adjustment}
                    onChange={(e) => setAdjustment(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                  />
                  <span className="text-[13px] font-medium text-[#7A7A7A] w-20 text-right tabular-nums">{totals.adjustment}</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between text-[15px] font-semibold text-[#1B1B1B] pt-3 border-t border-[#E5E5E5]">
                <span>Total (₹)</span>
                <span className="text-[18px] font-bold text-[#1B1B1B] tabular-nums">{totals.total}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#F0F0F0] pt-5">
            <button
              type="button"
              onClick={() => navigate("/purchase/vendor-credits")}
              className="rf-btn-cancel !h-[40px] !px-5 !text-[13px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveCredit("draft")}
              disabled={saving}
              className="h-[40px] px-5 bg-white hover:bg-[#FAFAFA] text-[#212121] border border-[#E5E5E5] text-[13px] font-medium rounded-[10px] transition-colors cursor-pointer disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSaveCredit("open")}
              disabled={saving}
              className="rf-btn-primary !h-[40px] !px-6 !text-[13px] disabled:opacity-50"
            >
              Save as Open
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Credit Number Preferences Modal */}
      <CreditNumberPreferencesModal
        isOpen={showNumberPreferencesModal}
        onClose={() => setShowNumberPreferencesModal(false)}
        onSave={handleSaveNumberPreferences}
        currentPrefix={numberPreferences.prefix}
        currentNextNumber={numberPreferences.nextNumber}
        autoGenerate={numberPreferences.autoGenerate}
        restartYearly={numberPreferences.restartYearly}
      />
    </div>
  );
};

// Main VendorCredits Component
const VendorCredits = () => {
  const isSidebarOpen = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNewCredit = location.pathname === "/purchase/vendor-credits/new";
  const isEditCredit = id && location.pathname.includes("/edit");
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
  
  const [vendorCredits, setVendorCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isNewCredit || isEditCredit) return;

    const fetchCredits = async () => {
      setLoading(true);
      try {
        const userStr = localStorage.getItem("rootfinuser");
        const user = userStr ? JSON.parse(userStr) : null;
        const userId = user?.email || null;
        const userPower = user?.power || "";

        if (!userId && userPower.toLowerCase() !== 'admin' && userPower.toLowerCase() !== 'super_admin') {
          setVendorCredits([]);
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({
          userId: userId || '',
        });
        if (userPower) params.append("userPower", userPower);
        if (user?.locCode) params.append("locCode", user.locCode);
        
        // Add warehouse parameter for filtering
        const fallbackLocations = [];
        
        let userLocName = "";
        if (user?.locCode) {
          const location = fallbackLocations.find(loc => loc.locCode === user.locCode || loc.locCode === String(user.locCode));
          if (location) {
            userLocName = location.locName;
          }
        }
        if (!userLocName) {
          userLocName = user?.username || user?.locName || "";
        }
        
        const userWarehouse = mapWarehouse(userLocName);
        if (userWarehouse) {
          params.append("warehouse", userWarehouse);
        }
        
        const url = `${API_URL}/api/purchase/vendor-credits?${params.toString()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error("Failed to fetch vendor credits");
        }
        
        const data = await response.json();
        setVendorCredits(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error loading vendor credits:", error);
        setVendorCredits([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
    
    // Listen for new credit saved event
    const handleCreditSaved = () => {
      fetchCredits();
    };
    
    window.addEventListener("vendorCreditSaved", handleCreditSaved);
    
    return () => {
      window.removeEventListener("vendorCreditSaved", handleCreditSaved);
    };
  }, [isNewCredit, isEditCredit, API_URL]);

  if (isNewCredit || isEditCredit) {
    return <NewVendorCreditForm creditId={id} isEditMode={isEditCredit} />;
  }

  const filteredCredits = vendorCredits.filter(credit => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      credit.creditNoteNumber?.toLowerCase().includes(search) ||
      credit.vendorName?.toLowerCase().includes(search) ||
      credit.orderNumber?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Purchase Return" />
      <div className={`transition-all duration-300 flex flex-col ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[18px] font-semibold text-[#1B1B1B]">All Purchase Returns</h1>
          <Link
            to="/purchase/vendor-credits/new"
            className="rf-btn-primary inline-flex items-center gap-1.5 !h-[38px] !px-5 !text-[13px]"
          >
            <Plus size={15} />
            <span>New Purchase Return</span>
          </Link>
        </div>

        <div className="p-5 md:p-6 flex-1 space-y-4">
          {/* Toolbar Row: Search (left) & Count Pill (right) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full sm:w-[360px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
                <Search size={15} className="text-[#212121]" />
                <span className="h-4 w-[1px] bg-[#E5E5E5] ml-2.5" />
              </div>
              <input
                type="text"
                placeholder="Search by credit note number, vendor or order..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rf-input !pl-12 !pr-9 !h-[42px] bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#525252] cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {!loading && (
              <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#F3E8FF] text-[#9D43D6] text-[12px] font-medium">
                {filteredCredits.length} {filteredCredits.length === 1 ? 'Return' : 'Returns'}
              </span>
            )}
          </div>

          {/* Loading / Empty / Table */}
          {loading ? (
            <div className="bg-white rounded-[16px] border border-[#E5E5E5] py-24 flex flex-col items-center justify-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#9D43D6] border-t-transparent" />
              <p className="text-[13px] font-medium text-[#7A7A7A]">Loading purchase returns...</p>
            </div>
          ) : filteredCredits.length === 0 ? (
            <div className="bg-white rounded-[16px] border border-[#E5E5E5] shadow-[0_1px_2px_rgba(0,0,0,0.02)] py-20 px-6 flex flex-col items-center justify-center text-center min-h-[340px]">
              {/* Purple Clipboard & Magnifier Illustration */}
              <svg
                width="170"
                height="120"
                viewBox="0 0 170 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-5"
                aria-hidden="true"
              >
                <ellipse cx="85" cy="108" rx="62" ry="6" fill="#F3E8FF" />
                <path d="M132 104C132 90 140 80 148 76C146 88 140 97 132 104Z" fill="#C4B5FD" />
                <path d="M130 104C128 92 132 82 137 74C138 85 135 95 130 104Z" fill="#A78BFA" />
                <path d="M124 104C121 96 121 89 124 83C127 89 127 97 124 104Z" fill="#DDD6FE" />
                <rect x="68" y="20" width="54" height="84" rx="8" fill="#EDE9FE" stroke="#C4B5FD" strokeWidth="2" />
                <rect x="74" y="27" width="42" height="70" rx="5" fill="#FFFFFF" />
                <rect x="85" y="14" width="20" height="10" rx="4" fill="#9D43D6" />
                <circle cx="95" cy="19" r="2" fill="#FFFFFF" />
                <rect x="83" y="42" width="24" height="32" rx="3" fill="#F5F3FF" stroke="#A78BFA" strokeWidth="1.5" />
                <circle cx="91" cy="54" r="1.5" fill="#9D43D6" />
                <circle cx="99" cy="54" r="1.5" fill="#9D43D6" />
                <path d="M90 62C92.5 59.5 97.5 59.5 100 62" stroke="#9D43D6" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="107" cy="70" r="7" fill="#9D43D6" />
                <path d="M104.5 67.5L109.5 72.5M109.5 67.5L104.5 72.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="66" cy="48" r="13" fill="#F3E8FF" fillOpacity="0.65" stroke="#7C3AED" strokeWidth="2.5" />
                <line x1="56.5" y1="57.5" x2="47" y2="67" stroke="#7C3AED" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="44" cy="42" r="8" fill="#2E1065" />
                <path d="M30 78C30 62 36 54 46 54C54 54 58 60 60 72L52 80H30V78Z" fill="#A78BFA" />
                <path d="M32 78L52 78L62 96H34L32 78Z" fill="#4C1D95" />
                <rect x="34" y="96" width="28" height="8" rx="4" fill="#DDD6FE" />
              </svg>

              <h2 className="text-[16px] font-semibold text-[#1B1B1B] tracking-tight">
                {searchTerm ? "No purchase returns found" : "No purchase returns yet"}
              </h2>
              <p className="text-[13px] text-[#8A8A8A] mt-1.5">
                {searchTerm ? "Try adjusting your search query" : "Create your first purchase return to get started"}
              </p>
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-full text-left">
                  <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <tr className="bg-[#1B1B1B] text-white text-[11px] uppercase tracking-wider font-semibold">
                      <th scope="col" className="px-4 py-3.5 text-center w-12">#</th>
                      <th scope="col" className="px-4 py-3.5 text-left">CREDIT NOTE #</th>
                      <th scope="col" className="px-4 py-3.5 text-left">DATE</th>
                      <th scope="col" className="px-4 py-3.5 text-left">VENDOR</th>
                      <th scope="col" className="px-4 py-3.5 text-left">ORDER #</th>
                      <th scope="col" className="px-4 py-3.5 text-right">AMOUNT</th>
                      <th scope="col" className="px-4 py-3.5 text-left">STATUS</th>
                      <th scope="col" className="px-4 py-3.5 text-center w-20">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#F0F0F0] text-[13px]">
                    {filteredCredits.map((credit, index) => (
                      <tr 
                        key={credit._id || credit.id} 
                        className="hover:bg-[#FAFAFA] transition-colors cursor-pointer group"
                        onClick={() => {
                          if (credit._id || credit.id) {
                            navigate(`/purchase/vendor-credits/${credit._id || credit.id}`);
                          } else {
                            console.error("Credit ID is missing:", credit);
                          }
                        }}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-center text-[#8A8A8A] font-medium">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-semibold text-[#9D43D6] group-hover:text-[#7E22CE] group-hover:underline">
                            {credit.creditNoteNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[#525252]">
                          {formatDate(credit.creditDate)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[#212121] font-medium">
                          {credit.vendorName || "-"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-[#525252]">
                          {credit.orderNumber || "-"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-[#1B1B1B] text-right tabular-nums">
                          {formatCurrency(credit.finalTotal || 0)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[12px] font-medium capitalize ${
                              credit.status === "open"
                                ? "bg-[#DCFCE7] text-[#15803D]"
                                : credit.status === "draft"
                                ? "bg-[#F4F4F5] text-[#525252]"
                                : "bg-[#FEE2E2] text-[#DC2626]"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                credit.status === "open"
                                  ? "bg-[#16A34A]"
                                  : credit.status === "draft"
                                  ? "bg-[#9CA3AF]"
                                  : "bg-[#EF4444]"
                              }`}
                            />
                            {credit.status || "draft"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/purchase/vendor-credits/${credit._id || credit.id}/edit`);
                            }}
                            className="w-8 h-8 rounded-[8px] bg-[#F3E8FF] text-[#9D43D6] hover:bg-[#E9D5FF] transition-colors inline-flex items-center justify-center cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorCredits;

