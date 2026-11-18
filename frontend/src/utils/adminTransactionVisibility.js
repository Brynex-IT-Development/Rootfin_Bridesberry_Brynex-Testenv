const ADMIN_ROLES = new Set(["admin", "superadmin", "financial_head"]);

export const canViewAdminOnlyTransactions = (user = {}) => {
  const power = String(user.power || "").toLowerCase();
  const role = String(user.role || "").toLowerCase();
  return power === "admin" || ADMIN_ROLES.has(role);
};

export const filterAdminOnlyTransactions = (transactions = [], user = {}) => {
  if (canViewAdminOnlyTransactions(user)) return transactions;
  return transactions.filter((transaction) => {
    const markedAdminOnly =
      transaction?.isAdminLevel === true || transaction?.isAdminLevel === "true";
    const accountantEntry =
      String(transaction?.entryType || "").toLowerCase() === "accountant_entry";
    return !markedAdminOnly && !accountantEntry;
  });
};
