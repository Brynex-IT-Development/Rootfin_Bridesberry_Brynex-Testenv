import ShoeItem from "../model/ShoeItem.js";
import ItemGroup from "../model/ItemGroup.js";
import SalesInvoice from "../model/SalesInvoice.js";
import TransferOrder from "../model/TransferOrder.js";
import PurchaseReceive from "../model/PurchaseReceive.js";
import InventoryAdjustment from "../model/InventoryAdjustment.js";
import Bill from "../model/Bill.js";
import { ensureStores, isWarehouseStore, sameStore, storeName, warehouseName as defaultWarehouseName } from "../utils/storeResolver.js";
import { isAdminUserId } from "../utils/adminUsers.js";

// Helper function to get inventory adjustments from MongoDB
const getInventoryAdjustments = async (conditions) => {
  try {
    const mongoConditions = { ...conditions };
    if (conditions.itemId) {
      mongoConditions['items.itemId'] = conditions.itemId;
      delete mongoConditions.itemId;
    }

    const adjustments = await InventoryAdjustment.find(mongoConditions);
    return adjustments.map(doc => {
      const obj = doc.toObject ? doc.toObject() : { ...doc };
      obj.id = obj._id.toString();
      return obj;
    });
  } catch (error) {
    console.error("Error fetching inventory adjustments for report:", error);
    return [];
  }
};

// Helper function to get items from sales invoice (handles both 'items' and 'lineItems' structures)
const getInvoiceItems = (salesInvoice) => {
  if (salesInvoice.items && Array.isArray(salesInvoice.items)) {
    return salesInvoice.items;
  }
  if (salesInvoice.lineItems && Array.isArray(salesInvoice.lineItems)) {
    // Convert lineItems to items format
    return salesInvoice.lineItems.map(lineItem => ({
      itemId: lineItem.itemData?._id || lineItem.itemId,
      quantity: lineItem.quantity,
      rate: lineItem.rate,
      amount: lineItem.amount
    }));
  }
  return [];
};

// Store names/codes are resolved only from the Store collection (utils/storeResolver.js).
export const matchesWarehouse = (itemWarehouse, targetWarehouse) => {
  if (!itemWarehouse) return false;
  if (!targetWarehouse || targetWarehouse === "All Stores" || targetWarehouse === "all") return true;
  return sameStore(itemWarehouse, targetWarehouse);
};

const resolveTargetWarehouse = async (warehouse, locCode) => {
  await ensureStores();
  if (warehouse && warehouse !== "All Stores") return storeName(warehouse);
  if (locCode) return storeName(locCode);
  return warehouse || "";
};

const normalizeWarehouseName = (warehouseName) => storeName(warehouseName);

// Names that refer to the same store as `warehouseName` (canonical backend name + the raw value)
const getWarehouseNameVariations = (warehouseName) => {
  if (!warehouseName) return [];
  return [...new Set([storeName(warehouseName), warehouseName.toString().trim()].filter(Boolean))];
};

// Get Inventory Summary Report
export const getInventorySummary = async (req, res) => {
  try {
    const { locCode, warehouse, allowedLocCodes } = req.query;
    const userId = req.query.userId || req.body.userId;

    // Check if user is admin
    const isAdminEmail = await isAdminUserId(userId); // admin by role, not by email
    const isMainAdmin = isAdminEmail ||
      (req.query.userPower && (req.query.userPower.toLowerCase() === 'admin' || req.query.userPower.toLowerCase() === 'super_admin')) ||
      (req.query.userRole && ['admin', 'superadmin', 'super_admin'].includes(req.query.userRole.toLowerCase())) ||
      (locCode && isWarehouseStore(locCode));
    const isAdmin = isMainAdmin;

    // Cluster manager: has allowedLocCodes and is not a main admin
    const clusterStoreLabels = allowedLocCodes ? allowedLocCodes.split(',').map(s => s.trim()) : [];
    const isClusterManager = !isMainAdmin && clusterStoreLabels.length > 0;
    const clusterNormalizedStores = clusterStoreLabels.map(label => normalizeWarehouseName(label)).filter(Boolean);

    // Resolve target warehouse and whether to filter by store
    const targetWarehouse = await resolveTargetWarehouse(warehouse, locCode);
    const shouldFilterStore = !isMainAdmin || (warehouse && warehouse !== "All Stores");

    console.log("🔍 Original warehouse:", warehouse);
    console.log("🔍 Resolved target warehouse:", targetWarehouse);
    console.log("🔍 User locCode:", locCode);
    console.log("🔍 Is Admin:", isAdmin);
    console.log("🔍 Should filter store:", shouldFilterStore);

    // Helper function to check if warehouse matches
    const warehouseMatches = (wsWarehouse) => {
      if (!wsWarehouse) return false;
      if (!shouldFilterStore) return true;
      return matchesWarehouse(wsWarehouse, targetWarehouse);
    };

    // Fetch standalone items
    let standaloneItems = [];
    if (isClusterManager && warehouse === "All Stores") {
      standaloneItems = await ShoeItem.find({});
      standaloneItems = standaloneItems.filter(item =>
        (item.warehouseStocks || []).some(ws => {
          if (!ws || !ws.warehouse) return false;
          const norm = normalizeWarehouseName(ws.warehouse.toString().trim());
          return clusterNormalizedStores.includes(norm);
        })
      );
      console.log(`🔒 Cluster manager: ${standaloneItems.length} items across allowed stores`);
    } else if (shouldFilterStore && targetWarehouse) {
      standaloneItems = await ShoeItem.find({});
      const beforeFilter = standaloneItems.length;
      standaloneItems = standaloneItems.filter(item => {
        return (item.warehouseStocks || []).some(ws => {
          if (!ws || !ws.warehouse) return false;
          return warehouseMatches(ws.warehouse);
        });
      });
      console.log(`🔒 Store filtered: ${standaloneItems.length} items have stock entries for ${targetWarehouse} (was ${beforeFilter})`);
    } else {
      standaloneItems = await ShoeItem.find({});
    }

    console.log(`📦 Found ${standaloneItems.length} standalone items`);

    // Fetch items from item groups
    const itemGroups = await ItemGroup.find({ isActive: { $ne: false } });
    let groupItems = [];
    let groupItemsChecked = 0;
    let groupItemsIncluded = 0;

    itemGroups.forEach(group => {
      if (group.items && Array.isArray(group.items)) {
        group.items.forEach((item, index) => {
          groupItemsChecked++;
          let shouldInclude = true;

          if (isClusterManager && warehouse === "All Stores") {
            const hasStock = item.warehouseStocks && Array.isArray(item.warehouseStocks) &&
              item.warehouseStocks.some(ws => {
                if (!ws || !ws.warehouse) return false;
                const norm = normalizeWarehouseName(ws.warehouse.toString().trim());
                return clusterNormalizedStores.includes(norm);
              });
            shouldInclude = hasStock;
          } else if (shouldFilterStore && targetWarehouse) {
            const hasStock = item.warehouseStocks && Array.isArray(item.warehouseStocks) &&
              item.warehouseStocks.some(ws => {
                if (!ws || !ws.warehouse) return false;
                return warehouseMatches(ws.warehouse);
              });
            shouldInclude = hasStock;
          }

          if (shouldInclude) {
            groupItemsIncluded++;
            const standaloneItem = {
              _id: item._id || `${group._id}_${index}`,
              itemName: item.name || "",
              sku: item.sku || "",
              costPrice: item.costPrice || 0,
              category: group.category || "",
              warehouseStocks: item.warehouseStocks || [],
              itemGroupId: group._id,
              itemGroupName: group.name,
              isFromGroup: true,
              createdAt: group.createdAt,
            };
            groupItems.push(standaloneItem);
          }
        });
      }
    });

    console.log(`📦 Found ${groupItems.length} items from groups (checked ${groupItemsChecked}, included ${groupItemsIncluded})`);

    let items = [...standaloneItems.map(item => ({ ...item.toObject ? item.toObject() : item, isFromGroup: false })), ...groupItems];

    console.log(`📦 Total items after combining standalone and group items: ${items.length}`);

    const inventorySummary = items.map(item => {
      let totalStock = 0;
      let totalValue = 0;

      // Determine which warehouse stocks to count based on user role and selection
      let warehouseStocksToShow = item.warehouseStocks || [];

      if (shouldFilterStore && targetWarehouse) {
        warehouseStocksToShow = (item.warehouseStocks || []).filter(ws => {
          if (!ws || !ws.warehouse) return false;
          return warehouseMatches(ws.warehouse);
        });
      } else if (isClusterManager) {
        warehouseStocksToShow = (item.warehouseStocks || []).filter(ws => {
          if (!ws || !ws.warehouse) return false;
          const norm = normalizeWarehouseName(ws.warehouse.toString().trim());
          return clusterNormalizedStores.includes(norm);
        });
      }

      if (warehouseStocksToShow && Array.isArray(warehouseStocksToShow)) {
        warehouseStocksToShow.forEach(ws => {
          const stock = parseFloat(ws.stockOnHand) || parseFloat(ws.stock) || 0;
          const cost = parseFloat(item.costPrice) || 0;
          totalStock += stock;
          totalValue += stock * cost;
        });
      }

      return {
        itemId: item._id,
        itemName: item.itemName || item.name,
        sku: item.sku,
        category: item.category,
        cost: parseFloat(item.costPrice) || 0,
        totalStock,
        totalValue,
        warehouseStocks: warehouseStocksToShow,
        branch: item.branch || item.warehouse,
        _hasMatchingWarehouseStock: warehouseStocksToShow && warehouseStocksToShow.length > 0,
        itemGroupId: item.itemGroupId || null,
        itemGroupName: item.itemGroupName || null,
        isFromGroup: item.isFromGroup || false
      };
    }).filter(item => {
      if (shouldFilterStore && targetWarehouse) {
        return item._hasMatchingWarehouseStock === true;
      }
      return true;
    });

    const totalItems = inventorySummary.length;
    const totalStockValue = inventorySummary.reduce((sum, item) => sum + item.totalValue, 0);
    const totalQuantity = inventorySummary.reduce((sum, item) => sum + item.totalStock, 0);
    
    console.log(`📊 Final inventory summary: ${totalItems} items, ${totalQuantity} total quantity, ₹${totalStockValue} total value`);
    console.log(`📋 Item names: ${inventorySummary.map(i => i.itemName).join(", ")}`);

    // Helper function to extract size number from item name or SKU
    const extractSizeFromName = (itemName, sku) => {
      // Try to extract size from SKU first (e.g., BLF6-1010 -> 6)
      if (sku) {
        const skuSizeMatch = sku.match(/([A-Z]+)(\d+)-/);
        if (skuSizeMatch) {
          return parseInt(skuSizeMatch[2]);
        }
      }
      
      // Try to extract size from item name using multiple patterns
      if (itemName) {
        // Pattern 1: "Item Name - Size" (e.g., "TAN LOAFER 4018 - 10" -> 10)
        const dashSizeMatch = itemName.match(/\s-\s(\d+)$/);
        if (dashSizeMatch) {
          return parseInt(dashSizeMatch[1]);
        }
        
        // Pattern 2: "Item Name/Size" (e.g., "Shoes Formal-1010 - Black/6" -> 6)
        const slashSizeMatch = itemName.match(/\/(\d+)$/);
        if (slashSizeMatch) {
          return parseInt(slashSizeMatch[1]);
        }
        
        // Pattern 3: "Item Name Size" (e.g., "TAN LOAFER 4018 10" -> 10)
        const spaceSizeMatch = itemName.match(/\s(\d+)$/);
        if (spaceSizeMatch) {
          return parseInt(spaceSizeMatch[1]);
        }
        
        // Pattern 4: Extract from SKU-like patterns in name (e.g., "T-AL6-4018" -> 6)
        const skuInNameMatch = itemName.match(/[A-Z]+-[A-Z]*(\d+)-/);
        if (skuInNameMatch) {
          return parseInt(skuInNameMatch[1]);
        }
      }
      
      return 999; // Default for items without recognizable size
    };

    // Sort items to keep group items together with proper size ordering
    // 1. Items from the same group are grouped together (by itemGroupId)
    // 2. Within each group, sort by item name alphabetically, then by size numerically
    // 3. Standalone items come after grouped items, sorted alphabetically then by size
    const sortedItems = inventorySummary.sort((a, b) => {
      const aGroupId = a.itemGroupId || null;
      const bGroupId = b.itemGroupId || null;
      
      // If both items are from groups
      if (aGroupId && bGroupId) {
        // If same group, sort by item name first, then by size
        if (aGroupId === bGroupId) {
          // First sort by base item name (without size)
          const aBaseName = (a.itemName || '').replace(/\s-\s\d+$/, '').replace(/\/\d+$/, '').replace(/\s\d+$/, '').trim();
          const bBaseName = (b.itemName || '').replace(/\s-\s\d+$/, '').replace(/\/\d+$/, '').replace(/\s\d+$/, '').trim();
          
          if (aBaseName !== bBaseName) {
            return aBaseName.localeCompare(bBaseName);
          }
          
          // Same base name, sort by size numerically
          const aSize = extractSizeFromName(a.itemName, a.sku);
          const bSize = extractSizeFromName(b.itemName, b.sku);
          return aSize - bSize;
        }
        
        // Different groups - sort by group name first
        const aGroupName = a.itemGroupName || '';
        const bGroupName = b.itemGroupName || '';
        if (aGroupName !== bGroupName) {
          return aGroupName.localeCompare(bGroupName);
        }
        
        // Same group name but different IDs, sort by item name then size
        const aBaseName = (a.itemName || '').replace(/\s-\s\d+$/, '').replace(/\/\d+$/, '').replace(/\s\d+$/, '').trim();
        const bBaseName = (b.itemName || '').replace(/\s-\s\d+$/, '').replace(/\/\d+$/, '').replace(/\s\d+$/, '').trim();
        
        if (aBaseName !== bBaseName) {
          return aBaseName.localeCompare(bBaseName);
        }
        
        const aSize = extractSizeFromName(a.itemName, a.sku);
        const bSize = extractSizeFromName(b.itemName, b.sku);
        return aSize - bSize;
      }
      
      // If only one is from a group, group items come first
      if (aGroupId && !bGroupId) return -1;
      if (!aGroupId && bGroupId) return 1;
      
      // Both are standalone items - sort by item name alphabetically, then by size
      const aBaseName = (a.itemName || '').replace(/\s-\s\d+$/, '').replace(/\/\d+$/, '').replace(/\s\d+$/, '').trim();
      const bBaseName = (b.itemName || '').replace(/\s-\s\d+$/, '').replace(/\/\d+$/, '').replace(/\s\d+$/, '').trim();
      
      if (aBaseName !== bBaseName) {
        return aBaseName.localeCompare(bBaseName);
      }
      
      const aSize = extractSizeFromName(a.itemName, a.sku);
      const bSize = extractSizeFromName(b.itemName, b.sku);
      return aSize - bSize;
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalItems,
          totalQuantity,
          totalStockValue
        },
        items: sortedItems
      }
    });
  } catch (error) {
    console.error("Get inventory summary error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get Stock Summary Report
export const getStockSummary = async (req, res) => {
  try {
    const { locCode, warehouse, category, allowedLocCodes } = req.query;
    const userId = req.query.userId || req.body.userId;

    // Check if user is admin
    const isAdminEmail = await isAdminUserId(userId); // admin by role, not by email
    const isMainAdmin = isAdminEmail ||
      (req.query.userPower && (req.query.userPower.toLowerCase() === 'admin' || req.query.userPower.toLowerCase() === 'super_admin')) ||
      (req.query.userRole && ['admin', 'superadmin', 'super_admin'].includes(req.query.userRole.toLowerCase())) ||
      (locCode && isWarehouseStore(locCode));
    const isAdmin = isMainAdmin;
    
    // Parse allowedLocCodes if provided (for cluster managers) — these are store labels
    const clusterAllowedLocCodes = allowedLocCodes ? allowedLocCodes.split(',').map(code => code.trim()) : [];
    // Normalize cluster store labels to canonical warehouse names
    const clusterNormalizedStores = clusterAllowedLocCodes
      .map(label => normalizeWarehouseName(label))
      .filter(Boolean);
    const isClusterManager = !isMainAdmin && clusterNormalizedStores.length > 0;

    // Resolve target warehouse and whether to filter by store
    const targetWarehouse = await resolveTargetWarehouse(warehouse, locCode);
    const shouldFilterStore = !isMainAdmin || (warehouse && warehouse !== "All Stores");

    // Helper function to check if warehouse matches
    const warehouseMatches = (wsWarehouse) => {
      if (!wsWarehouse) return false;
      if (!shouldFilterStore) return true;
      return matchesWarehouse(wsWarehouse, targetWarehouse);
    };
    
    // Fetch standalone items
    let standaloneItems = [];
    if (isClusterManager && warehouse === "All Stores") {
      standaloneItems = await ShoeItem.find({});
      standaloneItems = standaloneItems.filter(item =>
        (item.warehouseStocks || []).some(ws => {
          if (!ws || !ws.warehouse) return false;
          const norm = normalizeWarehouseName(ws.warehouse.toString().trim());
          return clusterNormalizedStores.includes(norm);
        })
      );
      console.log(`🔒 Cluster manager: ${standaloneItems.length} standalone items across allowed stores`);
    } else if (shouldFilterStore && targetWarehouse) {
      standaloneItems = await ShoeItem.find({});
      standaloneItems = standaloneItems.filter(item => {
        return (item.warehouseStocks || []).some(ws => {
          if (!ws || !ws.warehouse) return false;
          return warehouseMatches(ws.warehouse);
        });
      });
    } else {
      standaloneItems = await ShoeItem.find({});
    }
    
    // Fetch items from item groups
    const itemGroups = await ItemGroup.find({ isActive: { $ne: false } });
    let groupItems = [];
    let groupItemsChecked = 0;
    let groupItemsIncluded = 0;
    
    itemGroups.forEach(group => {
      if (group.items && Array.isArray(group.items)) {
        group.items.forEach((item, index) => {
          groupItemsChecked++;
          let shouldInclude = true;
          
          if (isClusterManager && warehouse === "All Stores") {
            const hasStock = item.warehouseStocks && Array.isArray(item.warehouseStocks) &&
              item.warehouseStocks.some(ws => {
                if (!ws || !ws.warehouse) return false;
                const norm = normalizeWarehouseName(ws.warehouse.toString().trim());
                return clusterNormalizedStores.includes(norm);
              });
            shouldInclude = hasStock;
          } else if (shouldFilterStore && targetWarehouse) {
            const hasStock = item.warehouseStocks && Array.isArray(item.warehouseStocks) &&
              item.warehouseStocks.some(ws => {
                if (!ws || !ws.warehouse) return false;
                return warehouseMatches(ws.warehouse);
              });
            shouldInclude = hasStock;
          }
          
          if (shouldInclude) {
            groupItemsIncluded++;
            const standaloneItem = {
              _id: item._id || `${group._id}_${index}`,
              itemName: item.name || "",
              sku: item.sku || "",
              costPrice: item.costPrice || 0,
              category: group.category || "",
              warehouseStocks: item.warehouseStocks || [],
              itemGroupId: group._id,
              itemGroupName: group.name,
              isFromGroup: true,
              createdAt: group.createdAt,
            };
            groupItems.push(standaloneItem);
          }
        });
      }
    });
    
    console.log(`📦 Found ${groupItems.length} items from groups (checked ${groupItemsChecked}, included ${groupItemsIncluded})`);
    
    const items = [...standaloneItems.map(item => ({ ...item.toObject ? item.toObject() : item, isFromGroup: false })), ...groupItems];

    // Apply category filter if specified
    let filteredItems = items;
    console.log(`📦 Total items before filtering: ${items.length}`);
    console.log(`📦 Category filter requested: '${category}'`);
    
    if (category && category !== "all") {
      filteredItems = items.filter(item => {
        // First check if item has a proper category field
        const itemCategory = item.category;
        console.log(`📦 Item: ${item.itemName || item.name}, Category: '${itemCategory}'`);
        
        if (itemCategory && itemCategory === category) {
          console.log(`📦 ✅ Category match for '${item.itemName || item.name}': ${itemCategory} === ${category}`);
          return true;
        }
        
        // Fallback to name-based detection for items without category set
        const itemName = (item.itemName || item.name || "").toLowerCase();
        const itemSku = (item.sku || "").toLowerCase();
        
        if (category === "shirt") {
          // Filter for shirt-related items based on name/sku
          const isShirt = itemName.includes("shirt") || 
                         itemName.includes("t-shirt") ||
                         itemName.includes("polo") ||
                         itemSku.includes("shirt") ||
                         // Add more shirt patterns as needed
                         /\b(cotton|linen|silk)\s+(shirt|top)\b/i.test(itemName);
          console.log(`📦 Fallback shirt check for '${itemName}': ${isShirt}`);
          return isShirt;
        } else if (category === "shoe") {
          // Filter for shoe-related items based on name/sku
          const isShoe = itemName.includes("shoe") || 
                        itemName.includes("footwear") || 
                        itemName.includes("sandal") || 
                        itemName.includes("boot") ||
                        itemName.includes("loafer") ||
                        itemName.includes("sneaker") ||
                        itemSku.includes("shoe") ||
                        itemSku.includes("loafer") ||
                        // Check if item name contains common shoe indicators
                        /\b(black|brown|tan|leather)\s+(shoe|formal|loafer|boot)\b/i.test(itemName) ||
                        /\b(shoe|loafer|boot|sandal)\s+\w+\s+\d+/i.test(itemName) ||
                        // Match patterns like "TAN LOAFER 4018" or "Brown Formal 1003"
                        /\b(tan|brown|black|white)\s+(loafer|formal|shoe)\s+\d+/i.test(itemName);
          console.log(`📦 Fallback shoe check for '${itemName}': ${isShoe}`);
          return isShoe;
        }
        return false;
      });
      console.log(`📦 Filtered items by category '${category}': ${filteredItems.length} out of ${items.length} items`);
      
      // Log some examples of what was found
      if (filteredItems.length > 0) {
        console.log(`📦 Sample filtered items:`, filteredItems.slice(0, 5).map(item => item.itemName || item.name));
      }
    }

    // All stores that should appear in the report come from the backend
    const allStoresList = (await ensureStores()).filter((st) => st.isActive).map((st) => st.name);

    // If a specific warehouse is selected or store user, only show that one.
    // If cluster manager is viewing "All My Stores", filter to their allowed stores only.
    let storesToShow;
    if (shouldFilterStore && targetWarehouse) {
      storesToShow = [targetWarehouse];
    } else if (clusterNormalizedStores.length > 0) {
      // Filter allStoresList to only include the cluster's allowed stores
      storesToShow = allStoresList.filter(storeName => clusterNormalizedStores.includes(storeName));
    } else {
      storesToShow = allStoresList;
    }

    // Initialize warehouseStockMap with selected stores at 0
    const warehouseStockMap = {};
    storesToShow.forEach(storeName => {
      warehouseStockMap[storeName] = {
        warehouse: storeName,
        totalQuantity: 0,
        totalValue: 0,
        itemCount: 0
      };
    });

    const restrictToWarehouse = shouldFilterStore ? targetWarehouse : null;

    filteredItems.forEach(item => {
      if (item.warehouseStocks && Array.isArray(item.warehouseStocks)) {
        item.warehouseStocks.forEach(ws => {
          if (restrictToWarehouse && !matchesWarehouse(ws.warehouse, restrictToWarehouse)) return;
          
          // Normalize the warehouse name from the item
          const normalizedWsName = normalizeWarehouseName(ws.warehouse) || ws.warehouse || "Unknown";
          
          // If a specific warehouse is selected, only count stock for that warehouse
          if (shouldFilterStore && targetWarehouse) {
            if (!warehouseMatches(ws.warehouse)) return;
          }
          
          const stock = parseFloat(ws.stockOnHand) || parseFloat(ws.stock) || 0;
          const cost = parseFloat(item.costPrice) || 0;

          let matchedKey = Object.keys(warehouseStockMap).find(k => matchesWarehouse(normalizedWsName, k));
          if (!matchedKey && !shouldFilterStore) {
            warehouseStockMap[normalizedWsName] = {
              warehouse: normalizedWsName,
              totalQuantity: 0,
              totalValue: 0,
              itemCount: 0
            };
            matchedKey = normalizedWsName;
          }

          if (matchedKey && warehouseStockMap[matchedKey]) {
            warehouseStockMap[matchedKey].totalQuantity += stock;
            warehouseStockMap[matchedKey].totalValue += stock * cost;
            warehouseStockMap[matchedKey].itemCount++;
          }
        });
      }
    });

    const stockSummary = Object.values(warehouseStockMap);
    const grandTotal = stockSummary.reduce((sum, ws) => sum + ws.totalValue, 0);
    const grandQuantity = stockSummary.reduce((sum, ws) => sum + ws.totalQuantity, 0);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalWarehouses: stockSummary.length,
          grandTotalQuantity: grandQuantity,
          grandTotalValue: grandTotal
        },
        warehouses: stockSummary.sort((a, b) => b.totalValue - a.totalValue)
      }
    });
  } catch (error) {
    console.error("Get stock summary error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get Inventory Valuation Report
export const getInventoryValuation = async (req, res) => {
  try {
    const { locCode, warehouse } = req.query;
    const userId = req.query.userId || req.body.userId;

    // Check if user is admin
    const isAdminEmail = await isAdminUserId(userId); // admin by role, not by email
    const isMainAdmin = isAdminEmail ||
      (req.query.userPower && (req.query.userPower.toLowerCase() === 'admin' || req.query.userPower.toLowerCase() === 'super_admin')) ||
      (req.query.userRole && ['admin', 'superadmin', 'super_admin'].includes(req.query.userRole.toLowerCase())) ||
      (locCode && isWarehouseStore(locCode));
    const isAdmin = isMainAdmin;

    // Resolve target warehouse and whether to filter by store
    const targetWarehouse = await resolveTargetWarehouse(warehouse, locCode);
    const shouldFilterStore = !isMainAdmin || (warehouse && warehouse !== "All Stores");

    const warehouseMatches = (wsWarehouse) => {
      if (!wsWarehouse) return false;
      if (!shouldFilterStore) return true;
      return matchesWarehouse(wsWarehouse, targetWarehouse);
    };
    
    // Fetch standalone items
    let standaloneItems = await ShoeItem.find({});
    if (shouldFilterStore && targetWarehouse) {
      standaloneItems = standaloneItems.filter(item => {
        return (item.warehouseStocks || []).some(ws => {
          if (!ws || !ws.warehouse) return false;
          return warehouseMatches(ws.warehouse);
        });
      });
    }
    
    // Fetch items from item groups
    const itemGroups = await ItemGroup.find({ isActive: { $ne: false } });
    let groupItems = [];
    
    itemGroups.forEach(group => {
      if (group.items && Array.isArray(group.items)) {
        group.items.forEach((item, index) => {
          let shouldInclude = true;
          
          if (shouldFilterStore && targetWarehouse) {
            const hasStock = item.warehouseStocks && Array.isArray(item.warehouseStocks) &&
              item.warehouseStocks.some(ws => ws && ws.warehouse && warehouseMatches(ws.warehouse));
            shouldInclude = hasStock;
          }
          
          if (shouldInclude) {
            const standaloneItem = {
              _id: item._id || `${group._id}_${index}`,
              itemName: item.name || "",
              sku: item.sku || "",
              costPrice: item.costPrice || 0,
              category: group.category || "",
              warehouseStocks: item.warehouseStocks || [],
              itemGroupId: group._id,
              itemGroupName: group.name,
              isFromGroup: true,
              createdAt: group.createdAt,
            };
            groupItems.push(standaloneItem);
          }
        });
      }
    });
    
    const items = [...standaloneItems.map(item => ({ ...item.toObject ? item.toObject() : item, isFromGroup: false })), ...groupItems];

    const valuationByCategory = {};
    let totalValuation = 0;

    items.forEach(item => {
      const category = item.category || "Uncategorized";
      let itemValue = 0;

      if (item.warehouseStocks && Array.isArray(item.warehouseStocks)) {
        item.warehouseStocks.forEach(ws => {
          if (shouldFilterStore && targetWarehouse && !warehouseMatches(ws.warehouse)) return;
          const stock = parseFloat(ws.stockOnHand) || parseFloat(ws.stock) || 0;
          const cost = parseFloat(item.costPrice) || 0;
          itemValue += stock * cost;
        });
      }

      if (!valuationByCategory[category]) {
        valuationByCategory[category] = {
          category,
          itemCount: 0,
          totalQuantity: 0,
          totalValue: 0
        };
      }

      valuationByCategory[category].itemCount++;
      valuationByCategory[category].totalValue += itemValue;

      if (item.warehouseStocks && Array.isArray(item.warehouseStocks)) {
        item.warehouseStocks.forEach(ws => {
          if (!isMainAdmin && locCode && !isWarehouseStore(locCode) && ws.warehouse !== normalizedWarehouse) return;
          valuationByCategory[category].totalQuantity += parseFloat(ws.stockOnHand) || parseFloat(ws.stock) || 0;
        });
      }

      totalValuation += itemValue;
    });

    const valuationList = Object.values(valuationByCategory)
      .sort((a, b) => b.totalValue - a.totalValue);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCategories: valuationList.length,
          totalValuation,
          averageValuePerCategory: valuationList.length > 0 ? totalValuation / valuationList.length : 0
        },
        categories: valuationList
      }
    });
  } catch (error) {
    console.error("Get inventory valuation error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Get Opening Stock Report - Shows total opening stock added by month and store
export const getOpeningStockReport = async (req, res) => {
  try {
    const { locCode, warehouse, month } = req.query;
    
    console.log("📊 Opening Stock Report Request:", { locCode, warehouse, month });
    
    // Date range setup based on month
    let dateFilter = {};
    let displayPeriod = "All time";
    
    if (month) {
      // Month format: "2026-01" for January 2026
      const [year, monthNum] = month.split('-');
      if (year && monthNum && !isNaN(year) && !isNaN(monthNum)) {
        const startDate = new Date(year, monthNum - 1, 1); // First day of month
        const endDate = new Date(year, monthNum, 0); // Last day of month
        
        dateFilter = {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        };
        
        displayPeriod = new Date(year, monthNum - 1).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
      } else {
        console.warn("Invalid month format:", month);
        displayPeriod = "Invalid month format";
      }
    } else {
      // Default to last 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      dateFilter = {
        createdAt: { $gte: twelveMonthsAgo }
      };
      displayPeriod = "Last 12 months";
    }
    
    // Get standalone items with opening stock created in the date range
    const standaloneItems = await ShoeItem.find({
      'warehouseStocks.openingStock': { $gt: 0 },
      ...dateFilter
    }).select('itemName sku warehouseStocks createdAt');
    
    // Get item groups with opening stock created in the date range
    const itemGroups = await ItemGroup.find({
      'items.warehouseStocks.openingStock': { $gt: 0 },
      ...dateFilter
    }).select('groupName items.name items.warehouseStocks createdAt');
    
    // Process data by store (no monthly grouping)
    const storeData = {};
    const itemDetails = [];
    let totalOpeningStock = 0;
    let totalOpeningValue = 0;
    
    // Helper function to normalize warehouse names
    const normalizeWarehouseName = (name) => storeName(name) || defaultWarehouseName();
    
    // Process standalone items
    standaloneItems.forEach(item => {
      item.warehouseStocks.forEach(stock => {
        if (stock.openingStock > 0) {
          const storeName = normalizeWarehouseName(stock.warehouse);
          const stockQty = stock.openingStock || 0;
          const stockValue = stock.openingStockValue || 0;
          
          // Store totals
          if (!storeData[storeName]) {
            storeData[storeName] = { totalStock: 0, totalValue: 0, itemCount: 0 };
          }
          storeData[storeName].totalStock += stockQty;
          storeData[storeName].totalValue += stockValue;
          storeData[storeName].itemCount += 1;
          
          // Item details
          itemDetails.push({
            itemName: item.itemName,
            sku: item.sku,
            store: storeName,
            openingStock: stockQty,
            openingValue: stockValue,
            createdAt: item.createdAt,
            type: 'standalone'
          });
          
          // Grand totals
          totalOpeningStock += stockQty;
          totalOpeningValue += stockValue;
        }
      });
    });
    
    // Process item groups
    itemGroups.forEach(group => {
      group.items.forEach(item => {
        if (item.warehouseStocks) {
          item.warehouseStocks.forEach(stock => {
            if (stock.openingStock > 0) {
              const storeName = normalizeWarehouseName(stock.warehouse);
              const stockQty = stock.openingStock || 0;
              const stockValue = stock.openingStockValue || 0;
              
              // Store totals
              if (!storeData[storeName]) {
                storeData[storeName] = { totalStock: 0, totalValue: 0, itemCount: 0 };
              }
              storeData[storeName].totalStock += stockQty;
              storeData[storeName].totalValue += stockValue;
              storeData[storeName].itemCount += 1;
              
              // Item details
              itemDetails.push({
                itemName: item.name,
                sku: item.sku,
                store: storeName,
                openingStock: stockQty,
                openingValue: stockValue,
                createdAt: group.createdAt,
                type: 'grouped',
                groupName: group.groupName
              });
              
              // Grand totals
              totalOpeningStock += stockQty;
              totalOpeningValue += stockValue;
            }
          });
        }
      });
    });
    
    // Convert to arrays and sort
    const storeReport = Object.entries(storeData).map(([store, data]) => ({
      store,
      totalStock: data.totalStock,
      totalValue: data.totalValue,
      itemCount: data.itemCount
    })).sort((a, b) => b.totalStock - a.totalStock);
    
    // Sort item details by creation date (newest first)
    itemDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Filter by warehouse if specified
    let filteredStoreReport = storeReport;
    let filteredItemDetails = itemDetails;
    
    const targetWarehouse = await resolveTargetWarehouse(warehouse, locCode);
    const shouldFilterStore = (locCode && !isWarehouseStore(locCode)) || (warehouse && warehouse !== 'all' && warehouse !== 'All Stores' && !isWarehouseStore(warehouse));

    if (shouldFilterStore && targetWarehouse) {
      filteredStoreReport = storeReport.filter(store => matchesWarehouse(store.store, targetWarehouse));
      filteredItemDetails = itemDetails.filter(item => matchesWarehouse(item.store, targetWarehouse));
      
      // Recalculate totals for filtered data
      totalOpeningStock = filteredItemDetails.reduce((sum, item) => sum + item.openingStock, 0);
      totalOpeningValue = filteredItemDetails.reduce((sum, item) => sum + item.openingValue, 0);
    }
    
    console.log("📊 Opening Stock Report Generated:", {
      totalItems: filteredItemDetails.length,
      totalStores: filteredStoreReport.length,
      grandTotalStock: totalOpeningStock,
      grandTotalValue: totalOpeningValue,
      period: displayPeriod
    });
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOpeningStock,
          totalOpeningValue,
          totalItems: filteredItemDetails.length,
          totalStores: filteredStoreReport.length,
          period: displayPeriod
        },
        storeReport: filteredStoreReport,
        itemDetails: filteredItemDetails
      }
    });
    
  } catch (error) {
    console.error("❌ Get opening stock report error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get Stock On Hand Report - Shows available stock for a specific date range
export const getStockOnHandReport = async (req, res) => {
  try {
    const { locCode, warehouse, startDate, endDate } = req.query;
    const userId = req.query.userId || req.body.userId;

    console.log("📊 Stock On Hand Report Request:", { locCode, warehouse, startDate, endDate });

    // Check if user is admin
    const isAdminEmail = await isAdminUserId(userId); // admin by role, not by email
    const isMainAdmin = isAdminEmail ||
      (req.query.userPower && (req.query.userPower.toLowerCase() === 'admin' || req.query.userPower.toLowerCase() === 'super_admin')) ||
      (req.query.userRole && ['admin', 'superadmin', 'super_admin'].includes(req.query.userRole.toLowerCase())) ||
      (locCode && isWarehouseStore(locCode));
    const isAdmin = isMainAdmin;
    
    // Date range setup
    let endDateObj = new Date();
    let startDateObj = null;
    let displayPeriod = "Current Stock";
    
    if (endDate) {
      endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      displayPeriod = `Stock as of ${endDateObj.toLocaleDateString('en-IN')}`;
    }
    
    if (startDate) {
      startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      displayPeriod = `Stock from ${startDateObj.toLocaleDateString('en-IN')} to ${endDateObj.toLocaleDateString('en-IN')}`;
    } else {
      // If no start date provided, use a date far in the past to capture all movements
      startDateObj = new Date('2020-01-01');
      startDateObj.setHours(0, 0, 0, 0);
    }
    
    // Resolve target warehouse
    const targetWarehouse = await resolveTargetWarehouse(warehouse, locCode);
    const shouldFilterStore = !isMainAdmin || (warehouse && warehouse !== "All Stores");
    
    // Helper function to check if warehouse matches
    const warehouseMatches = (wsWarehouse) => {
      if (!wsWarehouse) return false;
      if (!shouldFilterStore) return true;
      return matchesWarehouse(wsWarehouse, targetWarehouse);
    };
    
    // Fetch standalone items
    let standaloneItems = await ShoeItem.find({});
    if (shouldFilterStore) {
      standaloneItems = standaloneItems.filter(item => {
        return (item.warehouseStocks || []).some(ws => {
          if (!ws || !ws.warehouse) return false;
          return warehouseMatches(ws.warehouse);
        });
      });
    }
    
    // Fetch items from item groups
    const itemGroups = await ItemGroup.find({ isActive: { $ne: false } });
    let groupItems = [];
    
    itemGroups.forEach(group => {
      if (group.items && Array.isArray(group.items)) {
        group.items.forEach((item, index) => {
          let shouldInclude = true;
          
          if (shouldFilterStore) {
            const hasStock = item.warehouseStocks && Array.isArray(item.warehouseStocks) &&
              item.warehouseStocks.some(ws => {
                if (!ws || !ws.warehouse) return false;
                return warehouseMatches(ws.warehouse);
              });
            shouldInclude = hasStock;
          }
          
          if (shouldInclude) {
            const standaloneItem = {
              _id: item._id || `${group._id}_${index}`,
              itemName: item.name || "",
              sku: item.sku || "",
              costPrice: item.costPrice || 0,
              category: group.category || "",
              warehouseStocks: item.warehouseStocks || [],
              itemGroupId: group._id,
              itemGroupName: group.name,
              isFromGroup: true,
              createdAt: group.createdAt,
            };
            groupItems.push(standaloneItem);
          }
        });
      }
    });
    
    const items = [...standaloneItems.map(item => ({ ...item.toObject ? item.toObject() : item, isFromGroup: false })), ...groupItems];
    console.log(`📊 Processing ${items.length} items — fetching all movements in bulk...`);

    // ── BULK FETCH: 3 queries total instead of ~1000 ──────────────────────
    const dayBeforeStart = new Date(startDateObj);
    dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
    dayBeforeStart.setHours(23, 59, 59, 999);

    const [allPurchaseReceives, allTransferOrders, allSalesInvoices] = await Promise.all([
      PurchaseReceive.find({ status: 'received', createdAt: { $lte: endDateObj } }).select('items toWarehouse createdAt').lean(),
      TransferOrder.find({ status: 'completed', createdAt: { $lte: endDateObj } }).select('items sourceWarehouse destinationWarehouse createdAt').lean(),
      SalesInvoice.find({ createdAt: { $gte: startDateObj, $lte: endDateObj } }).select('items lineItems warehouse createdAt').lean(),
    ]);

    // Index movements by itemId for O(1) lookup
    const prByItem = new Map();
    for (const pr of allPurchaseReceives) {
      for (const it of (pr.items || [])) {
        const id = it.itemId?.toString();
        if (!id) continue;
        if (!prByItem.has(id)) prByItem.set(id, []);
        prByItem.get(id).push({ qty: parseFloat(it.receivedQuantity || it.quantity || it.received) || 0, warehouse: pr.toWarehouse, date: new Date(pr.createdAt) });
      }
    }
    const toInByItem = new Map();
    const toOutByItem = new Map();
    for (const to of allTransferOrders) {
      for (const it of (to.items || [])) {
        const id = it.itemId?.toString();
        if (!id) continue;
        const qty = parseFloat(it.quantity) || 0;
        const date = new Date(to.createdAt);
        if (!toInByItem.has(id)) toInByItem.set(id, []);
        toInByItem.get(id).push({ qty, warehouse: to.destinationWarehouse, date });
        if (!toOutByItem.has(id)) toOutByItem.set(id, []);
        toOutByItem.get(id).push({ qty, warehouse: to.sourceWarehouse, date });
      }
    }
    const salesByItem = new Map();
    for (const si of allSalesInvoices) {
      const invoiceItems = getInvoiceItems(si);
      for (const it of invoiceItems) {
        const id = it.itemId?.toString();
        if (!id) continue;
        if (!salesByItem.has(id)) salesByItem.set(id, []);
        salesByItem.get(id).push({ qty: parseFloat(it.quantity) || 0, warehouse: si.warehouse, date: new Date(si.createdAt) });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Calculate stock on hand for each item (pure in-memory, no more DB calls)
    const stockOnHandData = [];
    let totalStockOnHand = 0;
    let totalStockValue = 0;
    let totalStockIn = 0;
    let totalStockOut = 0;
    let totalOpeningStock = 0;

    for (const item of items) {
      const itemId = item._id?.toString();

      // Determine which warehouse stocks to process
      let warehouseStocksToProcess = item.warehouseStocks || [];
      if (shouldFilterStore) {
        warehouseStocksToProcess = warehouseStocksToProcess.filter(ws => ws?.warehouse && warehouseMatches(ws.warehouse));
      }
      
      for (const warehouseStock of warehouseStocksToProcess) {
        const warehouseName = normalizeWarehouseName(warehouseStock.warehouse) || warehouseStock.warehouse;
        const wsMatch = (wh) => matchesWarehouse(wh, warehouseStock.warehouse);

        const originalOpeningStock = parseFloat(warehouseStock.openingStock) || 0;
        const itemCreationDate = new Date(item.createdAt || '2020-01-01');

        // Opening stock = stock before startDate
        let openingStock = itemCreationDate < startDateObj ? originalOpeningStock : 0;

        if (startDate && itemCreationDate < startDateObj) {
          for (const r of (prByItem.get(itemId) || [])) {
            if (wsMatch(r.warehouse) && r.date >= itemCreationDate && r.date <= dayBeforeStart) openingStock += r.qty;
          }
          for (const r of (toInByItem.get(itemId) || [])) {
            if (wsMatch(r.warehouse) && r.date >= itemCreationDate && r.date <= dayBeforeStart) openingStock += r.qty;
          }
          for (const r of (toOutByItem.get(itemId) || [])) {
            if (wsMatch(r.warehouse) && r.date >= itemCreationDate && r.date <= dayBeforeStart) openingStock -= r.qty;
          }
          for (const r of (salesByItem.get(itemId) || [])) {
            if (wsMatch(r.warehouse) && r.date >= itemCreationDate && r.date <= dayBeforeStart) openingStock -= r.qty;
          }
        }
        openingStock = Math.max(0, openingStock);

        // Movements within period
        let stockIn = 0;
        let stockOut = 0;

        if (itemCreationDate >= startDateObj && itemCreationDate <= endDateObj && originalOpeningStock > 0) {
          stockIn += originalOpeningStock;
        }
        for (const r of (prByItem.get(itemId) || [])) {
          if (wsMatch(r.warehouse) && r.date >= startDateObj && r.date <= endDateObj) stockIn += r.qty;
        }
        for (const r of (toInByItem.get(itemId) || [])) {
          if (wsMatch(r.warehouse) && r.date >= startDateObj && r.date <= endDateObj) stockIn += r.qty;
        }
        for (const r of (toOutByItem.get(itemId) || [])) {
          if (wsMatch(r.warehouse) && r.date >= startDateObj && r.date <= endDateObj) stockOut += r.qty;
        }
        for (const r of (salesByItem.get(itemId) || [])) {
          if (wsMatch(r.warehouse) && r.date >= startDateObj && r.date <= endDateObj) stockOut += r.qty;
        }

        const closingStock = Math.max(0, openingStock + stockIn - stockOut);
        const itemCost = parseFloat(item.costPrice) || 0;
        const stockValue = closingStock * itemCost;

        const hasWarehouseEntry = warehouseStocksToProcess.length > 0;
        const shouldInclude = closingStock > 0 || stockIn > 0 || stockOut > 0 || openingStock > 0 || hasWarehouseEntry;

        if (shouldInclude) {
          stockOnHandData.push({
            itemId: item._id,
            itemName: item.itemName || item.name,
            sku: item.sku,
            category: item.category,
            warehouse: warehouseName,
            openingStock,
            stockIn,
            stockOut,
            closingStock,
            costPrice: itemCost,
            stockValue: Math.max(0, stockValue),
            itemGroupId: item.itemGroupId || null,
            itemGroupName: item.itemGroupName || null,
            isFromGroup: item.isFromGroup || false
          });
          totalStockOnHand += closingStock;
          totalStockValue += Math.max(0, stockValue);
          totalStockIn += stockIn;
          totalStockOut += stockOut;
          totalOpeningStock += openingStock;
        }
      }
    }
    
    // Sort by warehouse, then by item name
    stockOnHandData.sort((a, b) => {
      if (a.warehouse !== b.warehouse) {
        return a.warehouse.localeCompare(b.warehouse);
      }
      return (a.itemName || '').localeCompare(b.itemName || '');
    });
    
    // Group by warehouse for summary
    const warehouseSummary = {};
    stockOnHandData.forEach(item => {
      if (!warehouseSummary[item.warehouse]) {
        warehouseSummary[item.warehouse] = {
          warehouse: item.warehouse,
          totalItems: 0,
          totalStock: 0,
          totalValue: 0
        };
      }
      
      warehouseSummary[item.warehouse].totalItems += 1;
      warehouseSummary[item.warehouse].totalStock += item.closingStock;
      warehouseSummary[item.warehouse].totalValue += item.stockValue;
    });
    
    const warehouseReport = Object.values(warehouseSummary).sort((a, b) => b.totalValue - a.totalValue);
    
    console.log("📊 Stock On Hand Report Generated:", {
      totalItems: stockOnHandData.length,
      totalWarehouses: warehouseReport.length,
      grandTotalStock: totalStockOnHand,
      grandTotalValue: totalStockValue,
      period: displayPeriod,
      itemsProcessed: items.length,
      itemsIncluded: stockOnHandData.length
    });
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalItems: stockOnHandData.length,
          totalOpeningStock,
          totalStockIn,
          totalStockOut,
          totalClosingStock: totalStockOnHand,
          totalStockValue,
          totalWarehouses: warehouseReport.length,
          period: displayPeriod
        },
        warehouseReport,
        itemDetails: stockOnHandData
      }
    });
    
  } catch (error) {
    console.error("❌ Get stock on hand report error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get Inventory Aging Report
export const getInventoryAging = async (req, res) => {
  try {
    const {
      locCode,
      warehouse,
      category,
      group,
      salesStatus,
      asOfDate,
      allowedLocCodes,
      search,
      bracket
    } = req.query;
    const userId = req.query.userId || req.body.userId;

    // Check admin / permissions
    const isAdminEmail = await isAdminUserId(userId); // admin by role, not by email
    const isMainAdmin = isAdminEmail ||
      (req.query.userPower && (req.query.userPower.toLowerCase() === 'admin' || req.query.userPower.toLowerCase() === 'super_admin')) ||
      (req.query.userRole && ['admin', 'superadmin', 'super_admin'].includes(req.query.userRole.toLowerCase())) ||
      (locCode && isWarehouseStore(locCode));
    const isAdmin = isMainAdmin;

    const clusterStoreLabels = allowedLocCodes ? allowedLocCodes.split(',').map(s => s.trim()) : [];
    const isClusterManager = !isMainAdmin && clusterStoreLabels.length > 0;

    // Target evaluation date (default today)
    const targetDate = asOfDate ? new Date(asOfDate) : new Date();
    const evaluationTime = targetDate.getTime();

    // Resolve target warehouse
    const targetWarehouse = await resolveTargetWarehouse(warehouse, locCode);
    const shouldFilterStore = !isMainAdmin || (warehouse && warehouse !== "All Stores");

    // Helper to check if warehouse matches query
    const warehouseMatches = (wsWarehouse) => {
      if (!wsWarehouse) return false;
      if (isClusterManager && (!warehouse || warehouse === "All Stores")) {
        return clusterStoreLabels.some(label => matchesWarehouse(wsWarehouse, label));
      }
      if (!shouldFilterStore) return true;
      return matchesWarehouse(wsWarehouse, targetWarehouse);
    };

    // 1. Fetch Inward Transactions to find stock addition dates (Bills, Receives, Transfers, Adjustments)
    const salesCutoff = new Date(targetDate);
    salesCutoff.setUTCHours(23, 59, 59, 999);

    const [bills, receives, transferOrders, adjustments, salesInvoices, standaloneItems, itemGroups] = await Promise.all([
      Bill.find({}).select('billNumber billDate warehouse branch items createdAt').lean(),
      PurchaseReceive.find({ status: { $ne: 'cancelled' } }).select('receiveNumber receivedDate toWarehouse items createdAt').lean(),
      TransferOrder.find({ status: { $in: ['transferred', 'in_transit'] } }).select('transferOrderNumber date destinationWarehouse items createdAt').lean(),
      InventoryAdjustment.find({}).select('adjustmentNumber date warehouse branch items createdAt').lean(),
      SalesInvoice.find({ invoiceDate: { $lte: salesCutoff } })
        .select('invoiceNumber invoiceDate warehouse branch locCode category status lineItems')
        .lean(),
      ShoeItem.find({ isActive: { $ne: false } }).lean(),
      ItemGroup.find({ isActive: { $ne: false } }).lean(),
    ]);

    // Build lookup maps for inward dates
    // Key: `${itemId}_${normalizedWarehouse}` or `${itemId}` or `${sku}`
    const inwardHistoryMap = new Map();

    const recordInward = (key, date, source) => {
      if (!key || !date) return;
      const d = new Date(date);
      if (isNaN(d.getTime())) return;
      
      const existing = inwardHistoryMap.get(key);
      // Keep the most recent inward date for that item/warehouse, or the one closest to asOfDate
      if (!existing || d > existing.date) {
        inwardHistoryMap.set(key, { date: d, source });
      }
    };

    // Index Bills (Purchase Bills)
    bills.forEach(bill => {
      const bDate = bill.billDate || bill.createdAt;
      const bWh = normalizeWarehouseName(bill.warehouse || bill.branch || "Warehouse");
      (bill.items || []).forEach(item => {
        const itemId = (item.itemId || item._id || "").toString();
        const sku = (item.itemSku || item.sku || "").toString().toLowerCase().trim();
        const sourceLabel = `Purchase Bill #${bill.billNumber || "N/A"}`;

        if (itemId && bWh) {
          recordInward(`${itemId}_${bWh}`, bDate, sourceLabel);
        }
        if (sku && bWh) {
          recordInward(`${sku}_${bWh}`, bDate, sourceLabel);
        }
      });
    });

    // Index Purchase Receives
    receives.forEach(rcv => {
      const rDate = rcv.receivedDate || rcv.createdAt;
      const rWh = normalizeWarehouseName(rcv.toWarehouse || "Warehouse");
      (rcv.items || []).forEach(item => {
        const itemId = (item.itemId || item._id || "").toString();
        const sku = (item.itemSku || item.sku || "").toString().toLowerCase().trim();
        const sourceLabel = `Purchase Receive #${rcv.receiveNumber || "N/A"}`;

        if (itemId && rWh) {
          recordInward(`${itemId}_${rWh}`, rDate, sourceLabel);
        }
        if (sku && rWh) {
          recordInward(`${sku}_${rWh}`, rDate, sourceLabel);
        }
      });
    });

    // Index Transfer Orders (destination warehouse receives stock on transfer date)
    transferOrders.forEach(to => {
      const toDate = to.date || to.createdAt;
      const toWh = normalizeWarehouseName(to.destinationWarehouse);
      (to.items || []).forEach(item => {
        const itemId = (item.itemId || item._id || "").toString();
        const sku = (item.itemSku || item.sku || "").toString().toLowerCase().trim();
        const sourceLabel = `Transfer Order #${to.transferOrderNumber || "N/A"}`;

        if (itemId && toWh) {
          recordInward(`${itemId}_${toWh}`, toDate, sourceLabel);
        }
        if (sku && toWh) {
          recordInward(`${sku}_${toWh}`, toDate, sourceLabel);
        }
      });
    });

    // Index Inventory Adjustments (positive adjustments)
    adjustments.forEach(adj => {
      const adjDate = adj.date || adj.createdAt;
      const adjWh = normalizeWarehouseName(adj.warehouse || adj.branch);
      (adj.items || []).forEach(item => {
        const itemId = (item.itemId || item._id || "").toString();
        const sku = (item.itemSku || item.sku || "").toString().toLowerCase().trim();
        const sourceLabel = `Adjustment #${adj.adjustmentNumber || "N/A"}`;
        if (itemId && adjWh) {
          recordInward(`${itemId}_${adjWh}`, adjDate, sourceLabel);
        }
        if (sku && adjWh) {
          recordInward(`${sku}_${adjWh}`, adjDate, sourceLabel);
        }
      });
    });

    // Index sales by item and warehouse so the report can distinguish items
    // with sales history from stock that has never sold. Multiple identifiers
    // point to the same aggregate to support standalone items and group variants.
    const salesHistoryMap = new Map();
    const normalizeIdentity = (value) =>
      (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

    const getSalesAliases = (item, normalizedWarehouse) => {
      if (!item || !normalizedWarehouse) return [];

      const ids = [item._id, item.id, item.itemId]
        .map(normalizeIdentity)
        .filter(Boolean)
        .map(value => `id:${value}@${normalizedWarehouse}`);
      const skus = [item.sku, item.itemSku]
        .map(normalizeIdentity)
        .filter(Boolean)
        .map(value => `sku:${value}@${normalizedWarehouse}`);
      const names = [item.itemName, item.name, item.item]
        .map(normalizeIdentity)
        .filter(Boolean)
        .map(value => `name:${value}@${normalizedWarehouse}`);

      return [...new Set([...ids, ...skus, ...names])];
    };

    salesInvoices.forEach(invoice => {
      const categoryName = (invoice.category || "").toString().trim().toLowerCase();
      const invoiceNumber = (invoice.invoiceNumber || "").toString().trim().toUpperCase();
      const isReturn =
        ["return", "refund", "cancel", "cancelled"].includes(categoryName) ||
        invoiceNumber.startsWith("RTN-") ||
        invoiceNumber.startsWith("RET-");
      if (isReturn) return;

      const invoiceWarehouse = normalizeWarehouseName(
        invoice.warehouse || invoice.branch || invoice.locCode || "Warehouse"
      );
      if (!invoiceWarehouse) return;

      const invoiceDate = new Date(invoice.invoiceDate);
      if (isNaN(invoiceDate.getTime())) return;

      (invoice.lineItems || []).forEach(lineItem => {
        const quantity = parseFloat(lineItem.quantity || 0) || 0;
        if (quantity <= 0) return;

        const itemData = lineItem.itemData || {};
        const aliases = getSalesAliases({
          _id: itemData._id || itemData.id || lineItem.itemId,
          sku: itemData.sku || lineItem.itemSku,
          itemName: itemData.itemName || itemData.name || lineItem.item,
        }, invoiceWarehouse);
        if (aliases.length === 0) return;

        let aggregate = aliases.map(alias => salesHistoryMap.get(alias)).find(Boolean);
        if (!aggregate) {
          aggregate = { soldQuantity: 0, soldValue: 0, lastSaleDate: null };
        }

        aggregate.soldQuantity += quantity;
        aggregate.soldValue += parseFloat(lineItem.amount) ||
          ((parseFloat(lineItem.rate) || 0) * quantity);
        if (!aggregate.lastSaleDate || invoiceDate > aggregate.lastSaleDate) {
          aggregate.lastSaleDate = invoiceDate;
        }

        aliases.forEach(alias => salesHistoryMap.set(alias, aggregate));
      });
    });

    // 2. Process All Items and compute stock aging
    const agingRecords = [];

    const availableGroups = [...new Set(
      itemGroups
        .map(itemGroup => (itemGroup.name || itemGroup.groupName || "").trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    // Target warehouses to consider
    let targetWarehouses = [];
    if (shouldFilterStore) {
      targetWarehouses = [targetWarehouse];
    } else if (isClusterManager) {
      targetWarehouses = clusterStoreLabels;
    } else {
      const whSet = new Set();
      standaloneItems.forEach(i => (i.warehouseStocks || []).forEach(ws => {
        if (ws.warehouse) whSet.add(normalizeWarehouseName(ws.warehouse) || ws.warehouse);
      }));
      itemGroups.forEach(g => {
        (g.items || []).forEach(it => (it.warehouseStocks || []).forEach(ws => {
          if (ws.warehouse) whSet.add(normalizeWarehouseName(ws.warehouse) || ws.warehouse);
        }));
        (g.itemsList || []).forEach(it => (it.warehouseStocks || []).forEach(ws => {
          if (ws.warehouse) whSet.add(normalizeWarehouseName(ws.warehouse) || ws.warehouse);
        }));
      });
      targetWarehouses = Array.from(whSet);
      if (targetWarehouses.length === 0) {
        targetWarehouses = (await ensureStores()).filter((st) => st.isActive).map((st) => st.name);
      }
    }

    // Helper to process a single item/variant
    const processItemStock = (item, isGroupVariant = false, parentGroup = null) => {
      const effectiveCategory = (
        item.category || parentGroup?.category || "other"
      ).toString().trim().toLowerCase();
      const effectiveGroupName = (
        parentGroup?.name || parentGroup?.groupName || item.groupName || ""
      ).toString().trim();

      // Category filter check
      if (category && category !== "all" && effectiveCategory !== category.toLowerCase()) {
        return;
      }

      // Item group filter check
      if (group && group !== "all") {
        if (group === "ungrouped" && effectiveGroupName) {
          return;
        }
        if (
          group !== "ungrouped" &&
          effectiveGroupName.toLowerCase() !== group.toLowerCase()
        ) {
          return;
        }
      }

      // A grouped variant marked inactive should not appear in active aging data.
      if (item.isActive === false) {
        return;
      }

      // Search filter check
      if (search && search.trim() !== "") {
        const s = search.toLowerCase().trim();
        const name = (item.itemName || item.name || "").toLowerCase();
        const sku = (item.sku || "").toLowerCase();
        const gName = (parentGroup?.name || parentGroup?.groupName || item.groupName || "").toLowerCase();
        if (!name.includes(s) && !sku.includes(s) && !gName.includes(s)) {
          return;
        }
      }

      const itemId = (item._id || item.id || "").toString();
      const itemSku = (item.sku || "").toString().toLowerCase().trim();
      const warehouseStocks = item.warehouseStocks || [];

      // For each target warehouse, find stock or record
      targetWarehouses.forEach(targetWh => {
        // Find matching warehouse stock entries and sum quantities
        const matchingStocks = warehouseStocks.filter(ws => {
          if (!ws.warehouse) return false;
          return matchesWarehouse(ws.warehouse, targetWh);
        });

        const currentQty = matchingStocks.reduce((sum, ws) => {
          return sum + (parseFloat(ws.stockOnHand ?? ws.availableForSale ?? 0) || 0);
        }, 0);

        if (matchingStocks.length === 0 || currentQty <= 0) {
          return;
        }

        const normalizedTarget = normalizeWarehouseName(targetWh) || targetWh;
        const targetVariations = getWarehouseNameVariations(targetWh);

        const salesAliases = getSalesAliases(item, normalizedTarget);
        const salesInfo = salesAliases.map(alias => salesHistoryMap.get(alias)).find(Boolean) || {
          soldQuantity: 0,
          soldValue: 0,
          lastSaleDate: null,
        };

        if (salesStatus === "sold" && salesInfo.soldQuantity <= 0) {
          return;
        }
        if (salesStatus === "unsold" && salesInfo.soldQuantity > 0) {
          return;
        }

        // Find inward date for this warehouse
        let inwardInfo = null;
        for (const variation of [normalizedTarget, ...targetVariations]) {
          inwardInfo = inwardHistoryMap.get(`${itemId}_${variation}`) ||
                       inwardHistoryMap.get(`${itemSku}_${variation}`);
          if (inwardInfo) break;
        }

        const fallbackDate = item.createdAt || parentGroup?.createdAt || targetDate;
        let inwardDate = inwardInfo?.date || fallbackDate;
        let inwardSource = inwardInfo?.source || "Initial / Opening Stock";

        // Calculate age in days
        const diffMs = evaluationTime - new Date(inwardDate).getTime();
        const ageInDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        // Determine bracket
        let ageBracket = "0_30";
        let bracketLabel = "0 - 30 Days";
        let bracketColor = "emerald";

        if (ageInDays <= 30) {
          ageBracket = "0_30";
          bracketLabel = "0 - 30 Days";
          bracketColor = "emerald";
        } else if (ageInDays <= 60) {
          ageBracket = "31_60";
          bracketLabel = "31 - 60 Days";
          bracketColor = "blue";
        } else if (ageInDays <= 90) {
          ageBracket = "61_90";
          bracketLabel = "61 - 90 Days";
          bracketColor = "amber";
        } else if (ageInDays <= 120) {
          ageBracket = "91_120";
          bracketLabel = "91 - 120 Days";
          bracketColor = "orange";
        } else {
          ageBracket = "120_plus";
          bracketLabel = "120+ Days";
          bracketColor = "red";
        }

        // Bracket filter if specified
        if (bracket && bracket !== "all" && ageBracket !== bracket) {
          return;
        }

        const costPrice = parseFloat(item.costPrice || parentGroup?.costPrice || 0) || 0;
        const sellingPrice = parseFloat(item.sellingPrice || parentGroup?.sellingPrice || 0) || 0;
        const mrp = parseFloat(item.mrp || parentGroup?.mrp || 0) || 0;
        const totalValue = currentQty * costPrice;

        agingRecords.push({
          itemId,
          itemName: item.itemName || item.name || (parentGroup ? `${parentGroup.name || parentGroup.groupName} - ${item.size || item.sku}` : "Unnamed Item"),
          sku: item.sku || "N/A",
          size: item.size || "-",
          category: effectiveCategory,
          groupName: effectiveGroupName || null,
          isGroupVariant,
          warehouse: targetWh,
          stockOnHand: currentQty,
          costPrice,
          sellingPrice,
          mrp,
          stockValue: totalValue,
          inwardDate: new Date(inwardDate).toISOString().split('T')[0],
          inwardSource,
          ageInDays,
          ageBracket,
          bracketLabel,
          bracketColor,
          soldQuantity: salesInfo.soldQuantity,
          soldValue: salesInfo.soldValue,
          lastSaleDate: salesInfo.lastSaleDate
            ? salesInfo.lastSaleDate.toISOString().split('T')[0]
            : null
        });
      });
    };

    // Process Standalone Items
    standaloneItems.forEach(item => processItemStock(item, false, null));

    // Process Item Groups & Variants
    itemGroups.forEach(group => {
      const variants = Array.isArray(group.itemsList) && group.itemsList.length > 0 
        ? group.itemsList 
        : (Array.isArray(group.items) ? group.items : []);
      if (variants.length > 0) {
        variants.forEach(variant => processItemStock(variant, true, group));
      } else if (group.warehouseStocks && group.warehouseStocks.length > 0) {
        const gName = group.name || group.groupName;
        if (gName) {
          processItemStock({
            _id: group._id,
            itemName: gName,
            sku: group.sku || "GROUP",
            costPrice: group.costPrice,
            sellingPrice: group.sellingPrice,
            mrp: group.mrp,
            category: group.category,
            warehouseStocks: group.warehouseStocks || [],
            createdAt: group.createdAt
          }, true, group);
        }
      }
    });

    // Sort by age descending (oldest stock first)
    agingRecords.sort((a, b) => b.ageInDays - a.ageInDays);

    // 3. Compute Summary Metrics & Bracket Aggregations
    let grandTotalStock = 0;
    let grandTotalValue = 0;
    let totalAgeDaysWeighted = 0;
    let totalSoldQuantity = 0;
    let totalSoldValue = 0;
    let totalSoldItems = 0;
    let totalUnsoldItems = 0;

    const bracketsSummary = {
      "0_30": { bracket: "0_30", label: "0 - 30 Days", count: 0, stock: 0, value: 0, soldQty: 0, color: "emerald", badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      "31_60": { bracket: "31_60", label: "31 - 60 Days", count: 0, stock: 0, value: 0, soldQty: 0, color: "blue", badgeBg: "bg-blue-50 text-blue-700 border-blue-200" },
      "61_90": { bracket: "61_90", label: "61 - 90 Days", count: 0, stock: 0, value: 0, soldQty: 0, color: "amber", badgeBg: "bg-amber-50 text-amber-700 border-amber-200" },
      "91_120": { bracket: "91_120", label: "91 - 120 Days", count: 0, stock: 0, value: 0, soldQty: 0, color: "orange", badgeBg: "bg-orange-50 text-orange-700 border-orange-200" },
      "120_plus": { bracket: "120_plus", label: "120+ Days", count: 0, stock: 0, value: 0, soldQty: 0, color: "red", badgeBg: "bg-red-50 text-red-700 border-red-200" }
    };

    agingRecords.forEach(rec => {
      grandTotalStock += rec.stockOnHand;
      grandTotalValue += rec.stockValue;
      totalAgeDaysWeighted += (rec.ageInDays * rec.stockOnHand);
      totalSoldQuantity += rec.soldQuantity || 0;
      totalSoldValue += rec.soldValue || 0;
      if ((rec.soldQuantity || 0) > 0) {
        totalSoldItems += 1;
      } else {
        totalUnsoldItems += 1;
      }

      if (bracketsSummary[rec.ageBracket]) {
        bracketsSummary[rec.ageBracket].count += 1;
        bracketsSummary[rec.ageBracket].stock += rec.stockOnHand;
        bracketsSummary[rec.ageBracket].value += rec.stockValue;
        bracketsSummary[rec.ageBracket].soldQty += rec.soldQuantity || 0;
      }
    });

    const averageAgeDays = grandTotalStock > 0 ? Math.round(totalAgeDaysWeighted / grandTotalStock) : 0;
    const criticalAgedValue = bracketsSummary["91_120"].value + bracketsSummary["120_plus"].value;
    const criticalAgedStock = bracketsSummary["91_120"].stock + bracketsSummary["120_plus"].stock;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalItems: agingRecords.length,
          totalStock: grandTotalStock,
          totalValue: grandTotalValue,
          totalSoldQuantity,
          totalSoldValue,
          totalSoldItems,
          totalUnsoldItems,
          averageAgeDays,
          criticalAgedValue,
          criticalAgedStock,
          asOfDate: targetDate.toISOString().split('T')[0],
          warehouse: warehouse || "All Stores"
        },
        brackets: bracketsSummary,
        groups: availableGroups,
        items: agingRecords
      }
    });

  } catch (error) {
    console.error("❌ Get inventory aging report error:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating aging report",
      error: error.message
    });
  }
};
