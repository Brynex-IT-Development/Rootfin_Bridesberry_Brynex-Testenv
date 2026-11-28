import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import Header from "./Header";
import AppSelect from "./AppSelect.jsx";

// Compact dropdown for table rows (32px high, 13px text)
const compactSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    minHeight: "32px",
    height: "32px",
    borderRadius: "8px",
    borderColor: state.isFocused ? "#F2572B" : "#E5E5E5",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(242,87,43,0.12)" : "none",
    "&:hover": { borderColor: state.isFocused ? "#F2572B" : "#D4D4D8" },
    fontSize: "13px",
    fontWeight: 400,
    cursor: "pointer",
  }),
  valueContainer: (provided) => ({ ...provided, padding: "0 10px", height: "30px" }),
  indicatorsContainer: (provided) => ({ ...provided, height: "30px" }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (provided) => ({ ...provided, padding: "0 8px", color: "#A1A1AA" }),
  singleValue: (provided) => ({ ...provided, color: "#212121", fontWeight: 400 }),
  placeholder: (provided) => ({ ...provided, color: "#A1A1AA", fontWeight: 400 }),
  option: (provided, state) => ({
    ...provided,
    fontSize: "13px",
    backgroundColor: state.isSelected ? "#1B1B1B" : state.isFocused ? "#F4F4F5" : "#fff",
    color: state.isSelected ? "#fff" : "#212121",
    opacity: state.isDisabled ? 0.45 : 1,
    cursor: state.isDisabled ? "not-allowed" : "pointer",
  }),
};

/**
 * Shared layout for the item stock management pages (standalone and group items).
 */
const StockManagementLayout = ({
  isSidebarOpen = false,
  itemName,
  sku = "",
  meta = [],
  backPath,
  onNavigate,
  stockRows,
  warehouses,
  copiedField = null,
  loading = false,
  onAddRow,
  onDeleteRow,
  onInputChange,
  onCopyToAll,
  onSave,
}) => {
  const totalStock = stockRows.reduce((sum, r) => sum + (parseFloat(r.openingStock) || 0), 0);
  const selectedStores = stockRows.map((r) => r.warehouse).filter(Boolean);
  const allStoresUsed = warehouses.length > 0 && selectedStores.length >= warehouses.length;
  const details = [sku && { label: "SKU", value: sku }, ...meta].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title="Stock Management" />
      <div className={`transition-all duration-300 ${isSidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        {/* Title bar */}
        <div className="bg-white px-6 md:px-8 py-3 border-b border-[#E5E5E5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate(backPath)}
              className="h-8 w-8 -ml-2 rounded-[8px] inline-flex items-center justify-center text-[#525252] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
              title="Back to item"
            >
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-[16px] font-semibold text-[#212121]">Stock Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate(backPath)}
              disabled={loading}
              className="rf-btn-cancel !h-[34px] !px-4 !text-[13px] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={loading}
              className="rf-btn-primary !h-[34px] !px-5 !text-[13px] disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="max-w-[760px] bg-white rounded-[12px] border border-[#E5E5E5] overflow-hidden">
            {/* Item */}
            <div className="px-5 py-3.5 border-b border-[#F0F0F0]">
              <p className="text-[14px] font-semibold text-[#212121]">{itemName}</p>
              {details.length > 0 && (
                <p className="mt-0.5 text-[12px] text-[#6A6A6A]">
                  {details.map(({ label, value }, i) => (
                    <span key={label}>
                      {i > 0 && <span className="mx-1.5 text-[#D4D4D8]">|</span>}
                      {label} <span className="text-[#212121]">{value}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>

            {/* Stock by store */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#F0F0F0]">
                  <th className="px-5 py-2 text-left text-[12px] font-medium text-[#6A6A6A]">Store</th>
                  <th className="px-3 py-2 text-right text-[12px] font-medium text-[#6A6A6A] w-[150px]">
                    Stock on hand
                  </th>
                  <th className="w-[52px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F5]">
                {stockRows.map((row, index) => (
                  <tr key={index}>
                    <td className="px-5 py-2">
                      <AppSelect
                        value={row.warehouse}
                        onChange={(e) => onInputChange(index, "warehouse", e.target.value)}
                        styles={compactSelectStyles}
                      >
                        <option value="">Select store</option>
                        {warehouses.map((wh) => (
                          <option key={wh} value={wh} disabled={wh !== row.warehouse && selectedStores.includes(wh)}>
                            {wh}
                          </option>
                        ))}
                      </AppSelect>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.openingStock}
                        onChange={(e) => onInputChange(index, "openingStock", e.target.value)}
                        placeholder="0"
                        className="ml-auto block h-8 w-[110px] rounded-[8px] border border-[#E5E5E5] bg-white px-2.5 text-right text-[13px] tabular-nums text-[#212121] focus:border-[#F2572B] focus:outline-none focus:ring-2 focus:ring-[#F2572B]/15"
                      />
                    </td>
                    <td className="pr-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteRow(index)}
                        disabled={stockRows.length <= 1}
                        className="h-8 w-8 rounded-[8px] inline-flex items-center justify-center text-[#A1A1AA] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:invisible cursor-pointer transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-[#F0F0F0] flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onAddRow}
                  disabled={allStoresUsed}
                  className="inline-flex items-center gap-1 !text-[13px] font-medium text-[#F2572B] hover:text-[#D9461D] disabled:text-[#A1A1AA] disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus size={14} />
                  Add store
                </button>
                {stockRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onCopyToAll("openingStock")}
                    className="!text-[12px] !font-normal text-[#6A6A6A] hover:text-[#212121] cursor-pointer"
                  >
                    {copiedField === "openingStock" ? "Copied" : "Copy first value to all"}
                  </button>
                )}
              </div>
              <p className="text-[13px] text-[#6A6A6A]">
                Total <span className="ml-1.5 font-semibold text-[#212121] tabular-nums">{totalStock}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockManagementLayout;
