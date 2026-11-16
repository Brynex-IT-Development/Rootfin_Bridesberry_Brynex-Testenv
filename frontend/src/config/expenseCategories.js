export const baseExpenseCats = [
  { value: "dry cleaning", label: "Dry Cleaning" },
  { value: "altration", label: "Alteration" },
  { value: "material", label: "Material" },
  { value: "courier charges", label: "Courier Charges" },
  {
    value: "maintenance expenses",
    label: "Repairs & Maintenance",
    subs: ["Ac service", "Interior Maintenance", "Glass Cleaning", "Electrical work"],
  },
  { value: "travel exp", label: "Travel Exp" },
  { value: "fuel exp", label: "Fuel Exp" },
  { value: "petty expenses", label: "Office Expense" },
  { value: "telephone internet", label: "Internet Expense", subs: ["Telephone/wifi"] },
  { value: "utility bill", label: "Electricity Charges" },
  { value: "waste management", label: "Waste Management" },
  { value: "water charges", label: "Water Charges" },
  { value: "salary", label: "Salary/Salary Advance" },
  {
    value: "printing stationary",
    label: "Printing & Stationary",
    subs: ["Printout", "Books/pen/Register/Bill Book/Voucher", "Stationary Items"],
  },
  {
    value: "staff welfare",
    label: "Staff Welfare",
    subs: ["Cake purchase", "Food allowance on Special Occasion", "Other Refreshment"],
  },
  {
    value: "staff reimbursement",
    label: "Staff Accommodation",
    subs: ["Staff room rent", "Electricity"],
  },
  { value: "rent", label: "Store Rent" },
  {
    value: "asset purchase",
    label: "Asset Purchase",
    subs: ["Steamer", "Chairs", "Electronic Items", "Furniture items"],
  },
  { value: "spot incentive", label: "Incentive", subs: ["Spot incentive", "Weekly incentive"] },
  { value: "compensation", label: "Compensation" },
  {
    value: "other expenses",
    label: "Refund",
    subs: ["Security Refund", "Cancellation Refund", "Compensation"],
  },
  { value: "bulk amount transfer", label: "Cash to Bank" },
];

export const getExpenseCategoryLabel = (value) =>
  baseExpenseCats.find((category) => category.value === String(value || "").toLowerCase().trim())?.label || value;
