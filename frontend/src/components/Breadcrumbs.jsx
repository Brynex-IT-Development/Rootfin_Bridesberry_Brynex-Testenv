import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

/**
 * Maps pathname patterns to breadcrumb hierarchies.
 * Each crumb has a `label` and optional `path` (if clickable).
 * The last crumb is active / non-clickable.
 */
const ROUTE_RULES = [
  // Core & Day Book
  { pattern: /^\/$/, crumbs: [{ label: "Home", path: "/" }, { label: "Dashboard" }] },
  { pattern: /^\/daybook$/, crumbs: [{ label: "Home", path: "/" }, { label: "Day Book" }] },
  { pattern: /^\/datewisedaybook$/, crumbs: [{ label: "Home", path: "/" }, { label: "Financial Summary" }] },
  { pattern: /^\/CloseReport$/, crumbs: [{ label: "Home", path: "/" }, { label: "Close Report" }] },
  { pattern: /^\/AdminClose$/, crumbs: [{ label: "Home", path: "/" }, { label: "Admin Close" }] },
  { pattern: /^\/pending-closures$/, crumbs: [{ label: "Home", path: "/" }, { label: "Late Closures" }] },
  { pattern: /^\/CashBankLedger$/, crumbs: [{ label: "Home", path: "/" }, { label: "Cash & Bank Ledger" }] },
  { pattern: /^\/ManageStores$/, crumbs: [{ label: "Home", path: "/" }, { label: "Manage Stores" }] },

  // Income & Expenses
  { pattern: /^\/Income&Expenses$/, crumbs: [{ label: "Home", path: "/" }, { label: "Income & Expenses" }] },
  { pattern: /^\/income$/, crumbs: [{ label: "Home", path: "/" }, { label: "Income" }] },
  { pattern: /^\/expenses$/, crumbs: [{ label: "Home", path: "/" }, { label: "Expenses" }] },
  { pattern: /^\/record-expenses?$/, crumbs: [{ label: "Home", path: "/" }, { label: "Expenses", path: "/expenses" }, { label: "Record Expense" }] },
  { pattern: /^\/record-expense\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Expenses", path: "/expenses" }, { label: "New Expense" }] },
  { pattern: /^\/direct-expenses$/, crumbs: [{ label: "Home", path: "/" }, { label: "Expenses", path: "/expenses" }, { label: "Direct Expenses" }] },
  { pattern: /^\/indirect-expenses$/, crumbs: [{ label: "Home", path: "/" }, { label: "Expenses", path: "/expenses" }, { label: "Indirect Expenses" }] },

  // Manage Users
  { pattern: /^\/manage-users\/existing-users$/, crumbs: [{ label: "Home", path: "/" }, { label: "Manage Users", path: "/manage-users/existing-users" }, { label: "Existing Users" }] },
  { pattern: /^\/manage-users\/add-user$/, crumbs: [{ label: "Home", path: "/" }, { label: "Manage Users", path: "/manage-users/existing-users" }, { label: "Add New User" }] },
  { pattern: /^\/manage-users\/permissions$/, crumbs: [{ label: "Home", path: "/" }, { label: "Manage Users", path: "/manage-users/existing-users" }, { label: "Permissions" }] },
  { pattern: /^\/manage-users\/subscription$/, crumbs: [{ label: "Home", path: "/" }, { label: "Manage Users", path: "/manage-users/existing-users" }, { label: "Subscription" }] },
  { pattern: /^\/manage-users\/edit-user\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Manage Users", path: "/manage-users/existing-users" }, { label: "Edit User" }] },
  { pattern: /^\/manage-users\/reset-password$/, crumbs: [{ label: "Home", path: "/" }, { label: "Manage Users", path: "/manage-users/existing-users" }, { label: "Reset Password" }] },

  // Inventory / Items
  { pattern: /^\/shoe-sales\/items$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Items" }] },
  { pattern: /^\/shoe-sales\/items\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Items", path: "/shoe-sales/items" }, { label: "New Item" }] },
  { pattern: /^\/shoe-sales\/items\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Items", path: "/shoe-sales/items" }, { label: "Edit Item" }] },
  { pattern: /^\/shoe-sales\/items\/[^\/]+\/stocks$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Items", path: "/shoe-sales/items" }, { label: "Stock Management" }] },
  { pattern: /^\/shoe-sales\/items\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Items", path: "/shoe-sales/items" }, { label: "Item Details" }] },
  { pattern: /^\/shoe-sales\/inactive(-items)?$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Inactive Items" }] },

  // Inventory / Item Groups
  { pattern: /^\/shoe-sales\/item-groups$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups" }] },
  { pattern: /^\/shoe-sales\/item-groups\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups", path: "/shoe-sales/item-groups" }, { label: "New Item Group" }] },
  { pattern: /^\/shoe-sales\/item-groups\/[^\/]+\/items\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups", path: "/shoe-sales/item-groups" }, { label: "Add Item to Group" }] },
  { pattern: /^\/shoe-sales\/item-groups\/[^\/]+\/items\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups", path: "/shoe-sales/item-groups" }, { label: "Edit Item" }] },
  { pattern: /^\/shoe-sales\/item-groups\/[^\/]+\/items\/[^\/]+\/stocks$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups", path: "/shoe-sales/item-groups" }, { label: "Stock Management" }] },
  { pattern: /^\/shoe-sales\/item-groups\/[^\/]+\/items\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups", path: "/shoe-sales/item-groups" }, { label: "Item Details" }] },
  { pattern: /^\/shoe-sales\/item-groups\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups", path: "/shoe-sales/item-groups" }, { label: "Edit Group" }] },
  { pattern: /^\/shoe-sales\/item-groups\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Item Groups", path: "/shoe-sales/item-groups" }, { label: "Group Details" }] },

  // Inventory / Price Lists
  { pattern: /^\/shoe-sales\/price-lists$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Price Lists" }] },
  { pattern: /^\/shoe-sales\/price-lists\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Price Lists", path: "/shoe-sales/price-lists" }, { label: "New Price List" }] },

  // Inventory / Adjustments
  { pattern: /^\/inventory\/adjustments$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Inventory Adjustments" }] },
  { pattern: /^\/inventory\/adjustments\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Inventory Adjustments", path: "/inventory/adjustments" }, { label: "New Adjustment" }] },
  { pattern: /^\/inventory\/adjustments\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Inventory Adjustments", path: "/inventory/adjustments" }, { label: "Edit Adjustment" }] },
  { pattern: /^\/inventory\/adjustments\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Inventory Adjustments", path: "/inventory/adjustments" }, { label: "Adjustment Details" }] },

  // Inventory / Packages
  { pattern: /^\/inventory\/packages$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Packages" }] },
  { pattern: /^\/inventory\/packages\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Packages", path: "/inventory/packages" }, { label: "New Package" }] },

  // Inventory / Transfer Orders
  { pattern: /^\/inventory\/transfer-orders$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Transfer Orders" }] },
  { pattern: /^\/inventory\/transfer-orders\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Transfer Orders", path: "/inventory/transfer-orders" }, { label: "New Transfer Order" }] },
  { pattern: /^\/inventory\/transfer-orders\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Transfer Orders", path: "/inventory/transfer-orders" }, { label: "Edit Transfer Order" }] },
  { pattern: /^\/inventory\/transfer-orders\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Transfer Orders", path: "/inventory/transfer-orders" }, { label: "Transfer Order Details" }] },

  // Inventory / Store Orders
  { pattern: /^\/inventory\/store-orders$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Store Orders" }] },
  { pattern: /^\/inventory\/store-orders\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Store Orders", path: "/inventory/store-orders" }, { label: "New Store Order" }] },
  { pattern: /^\/inventory\/store-orders\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Store Orders", path: "/inventory/store-orders" }, { label: "Edit Store Order" }] },
  { pattern: /^\/inventory\/store-orders\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Store Orders", path: "/inventory/store-orders" }, { label: "Store Order Details" }] },

  // Inventory / Reorder Alerts
  { pattern: /^\/inventory\/reorder-alerts$/, crumbs: [{ label: "Home", path: "/" }, { label: "Inventory", path: "/shoe-sales/items" }, { label: "Reorder Alerts" }] },

  // Sales
  { pattern: /^\/sales\/invoices$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Invoices" }] },
  { pattern: /^\/sales\/invoices\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Invoices", path: "/sales/invoices" }, { label: "New Invoice" }] },
  { pattern: /^\/sales\/invoices\/returns$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Invoices", path: "/sales/invoices" }, { label: "Invoice Returns" }] },
  { pattern: /^\/sales\/invoices\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Invoices", path: "/sales/invoices" }, { label: "Edit Invoice" }] },
  { pattern: /^\/sales\/invoices\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Invoices", path: "/sales/invoices" }, { label: "Invoice Details" }] },
  { pattern: /^\/sales\/customers$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Customers" }] },
  { pattern: /^\/sales\/customers\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Customers", path: "/sales/customers" }, { label: "New Customer" }] },
  { pattern: /^\/sales\/orders$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Sales Orders" }] },
  { pattern: /^\/sales\/delivery-challans$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Delivery Challans" }] },
  { pattern: /^\/sales\/payments-received$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Payments Received" }] },
  { pattern: /^\/sales\/returns$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Sales Returns" }] },
  { pattern: /^\/sales\/credit-notes$/, crumbs: [{ label: "Home", path: "/" }, { label: "Sales", path: "/sales/invoices" }, { label: "Credit Notes" }] },

  // Purchase
  { pattern: /^\/purchase\/orders$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Orders" }] },
  { pattern: /^\/purchase\/orders\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Orders", path: "/purchase/orders" }, { label: "New Purchase Order" }] },
  { pattern: /^\/purchase\/orders\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Orders", path: "/purchase/orders" }, { label: "Edit Purchase Order" }] },
  { pattern: /^\/purchase\/orders\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Orders", path: "/purchase/orders" }, { label: "Order Details" }] },

  { pattern: /^\/purchase\/vendors$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendors" }] },
  { pattern: /^\/purchase\/vendors\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendors", path: "/purchase/vendors" }, { label: "New Vendor" }] },
  { pattern: /^\/purchase\/vendors\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendors", path: "/purchase/vendors" }, { label: "Edit Vendor" }] },
  { pattern: /^\/purchase\/vendors\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendors", path: "/purchase/vendors" }, { label: "Vendor Details" }] },

  { pattern: /^\/purchase\/receives$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Receives" }] },
  { pattern: /^\/purchase\/receives\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Receives", path: "/purchase/receives" }, { label: "New Receive" }] },
  { pattern: /^\/purchase\/receives\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Receives", path: "/purchase/receives" }, { label: "Edit Receive" }] },
  { pattern: /^\/purchase\/receives\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Purchase Receives", path: "/purchase/receives" }, { label: "Receive Details" }] },

  { pattern: /^\/purchase\/bills$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Bills" }] },
  { pattern: /^\/purchase\/bills\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Bills", path: "/purchase/bills" }, { label: "New Bill" }] },
  { pattern: /^\/purchase\/bills\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Bills", path: "/purchase/bills" }, { label: "Edit Bill" }] },
  { pattern: /^\/purchase\/bills\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Bills", path: "/purchase/bills" }, { label: "Bill Details" }] },

  { pattern: /^\/purchase\/payments$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Payments Made" }] },
  { pattern: /^\/purchase\/vendor-credits$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendor Credits" }] },
  { pattern: /^\/purchase\/vendor-credits\/new$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendor Credits", path: "/purchase/vendor-credits" }, { label: "New Credit" }] },
  { pattern: /^\/purchase\/vendor-credits\/[^\/]+\/edit$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendor Credits", path: "/purchase/vendor-credits" }, { label: "Edit Credit" }] },
  { pattern: /^\/purchase\/vendor-credits\/[^\/]+$/, crumbs: [{ label: "Home", path: "/" }, { label: "Purchase", path: "/purchase/orders" }, { label: "Vendor Credits", path: "/purchase/vendor-credits" }, { label: "Credit Details" }] },

  // Reports
  { pattern: /^\/reports\/sales$/, crumbs: [{ label: "Home", path: "/" }, { label: "Reports", path: "/reports/sales" }, { label: "Sales Report" }] },
  { pattern: /^\/reports\/sales-by-invoice$/, crumbs: [{ label: "Home", path: "/" }, { label: "Reports", path: "/reports/sales" }, { label: "Sales by Invoice" }] },
  { pattern: /^\/reports\/sales-by-group$/, crumbs: [{ label: "Home", path: "/" }, { label: "Reports", path: "/reports/sales" }, { label: "Sales by Group" }] },
  { pattern: /^\/reports\/inventory$/, crumbs: [{ label: "Home", path: "/" }, { label: "Reports", path: "/reports/sales" }, { label: "Inventory Report" }] },
  { pattern: /^\/reports\/aging$/, crumbs: [{ label: "Home", path: "/" }, { label: "Reports", path: "/reports/sales" }, { label: "Inventory Aging" }] },
  { pattern: /^\/reports\/income-expense$/, crumbs: [{ label: "Home", path: "/" }, { label: "Reports", path: "/reports/sales" }, { label: "Income & Expense" }] },
];

/**
 * Format raw URL slug to title case (e.g., 'price-lists' -> 'Price Lists')
 */
const formatSegment = (str) => {
  if (!str) return "";
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Fallback breadcrumb generator when no explicit rule matches
 */
const generateFallbackCrumbs = (pathname) => {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Home", path: "/" }];

  let accumulated = "";
  parts.forEach((part, index) => {
    accumulated += `/${part}`;
    const isLast = index === parts.length - 1;
    crumbs.push({
      label: formatSegment(part),
      path: isLast ? undefined : accumulated,
    });
  });

  return crumbs;
};

/**
 * Resolves the breadcrumbs trail for a given pathname and optional title override.
 */
export const getBreadcrumbs = (pathname, customTitle) => {
  const cleanPath = (pathname || "/").replace(/\/+$/, "") || "/";

  for (const rule of ROUTE_RULES) {
    if (rule.pattern.test(cleanPath)) {
      // Clone rule crumbs so we don't mutate static definition
      const result = rule.crumbs.map((c) => ({ ...c }));
      if (customTitle && result.length > 0) {
        result[result.length - 1].label = customTitle;
      }
      return result;
    }
  }

  const fallback = generateFallbackCrumbs(cleanPath);
  if (customTitle && fallback.length > 0) {
    fallback[fallback.length - 1].label = customTitle;
  }
  return fallback;
};

/**
 * Breadcrumbs Component
 * Renders interactive breadcrumb trail where clicking any segment moves to that page.
 */
const Breadcrumbs = ({ currentTitle, className = "" }) => {
  const location = useLocation();
  if (location.pathname === "/" || location.pathname === "") return null;

  const crumbs = getBreadcrumbs(location.pathname, currentTitle);

  // If only one crumb (e.g. Home on root), still display clearly
  if (!crumbs || crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center flex-wrap gap-1.5 text-[13px] md:text-[14px] text-[#6A6A6A] ${className}`}
    >
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        const isFirst = idx === 0;

        return (
          <React.Fragment key={`${crumb.label}-${idx}`}>
            {idx > 0 && (
              <ChevronRight
                size={13}
                className="text-[#9CA3AF] shrink-0"
                aria-hidden="true"
              />
            )}

            {isLast ? (
              <span
                className="font-semibold text-[#212121] tracking-tight truncate max-w-[220px] sm:max-w-md"
                aria-current="page"
                title={crumb.label}
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path || "/"}
                className="hover:text-[#F2572B] font-medium transition-colors hover:underline flex items-center gap-1.5 shrink-0"
                title={`Go to ${crumb.label}`}
              >
                {isFirst && <Home size={14} className="shrink-0 text-[#6A6A6A] hover:text-[#F2572B]" />}
                <span>{crumb.label}</span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
