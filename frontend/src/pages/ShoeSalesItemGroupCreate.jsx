import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useEnterToSave } from "../hooks/useEnterToSave";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trash2, ArrowLeft, X, ChevronDown, Search, Settings, Check, ShoppingBag, ShoppingCart, Edit, MoreHorizontal, Package, Layers, Plus, Info, AlertCircle, Warehouse, DollarSign } from "lucide-react";
import Header from "../components/Header";
import ImageUpload from "../components/ImageUpload";
import baseUrl from "../api/api";
import useSidebar from "../hooks/useSidebar";

const STORAGE_KEYS = {
  manufacturers: "shoeSalesManufacturers",
  brands: "shoeSalesBrands",
};

const loadStoredList = (key) => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error(`Failed to parse ${key} from localStorage`, error);
  }
  return [];
};

const unitOptions = [
  "box",
  "cm",
  "dz",
  "ft",
  "g",
  "in",
  "kg",
  "km",
  "lb",
  "mg",
  "ml",
  "m",
  "pcs",
  "PCS",
];

const ShoeSalesItemGroupCreate = () => {
  const isSidebarOpen = useSidebar();
  const { id } = useParams();
  const navigate = useNavigate();

  const userStr = localStorage.getItem("rootfinuser");
  const user = userStr ? JSON.parse(userStr) : null;
  const userRole = (user?.role || "").toLowerCase().trim();
  const userPower = (user?.power || "").toLowerCase().trim();
  const userEmail = (user?.email || user?.username || "").toLowerCase().trim();
  const adminEmails = [
    "officerootments@gmail.com",
    "operationsrootments@gmail.com",
    "headoffice01@gmail.com"
  ];
  const isAdminEmail = adminEmails.includes(userEmail);
  const isAdmin = isAdminEmail ||
                  userPower === "admin" || 
                  userPower === "super_admin" || 
                  userRole === "admin" || 
                  userRole === "superadmin" ||
                  (user?.locCode && (String(user.locCode) === '858' || String(user.locCode) === '103'));

  useEffect(() => {
    if (!isAdmin) {
      navigate("/shoe-sales/item-groups");
    }
  }, [isAdmin, navigate]);

  const isEditMode = !!id;
  const [loading, setLoading] = useState(isEditMode);
  const [showAccounts, setShowAccounts] = useState(false);
  const [itemType, setItemType] = useState("goods");
  const [createAttributes, setCreateAttributes] = useState(true);
  const [attributeRows, setAttributeRows] = useState([
    { id: 1, attribute: "", options: [], optionInput: "" }
  ]);
  const [showSingleItemModal, setShowSingleItemModal] = useState(false);
  const [itemGroupName, setItemGroupName] = useState("");
  const [itemGroupSku, setItemGroupSku] = useState("");
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);
  const [sellable, setSellable] = useState(true);
  const [purchasable, setPurchasable] = useState(true);
  const [returnable, setReturnable] = useState(true);
  const [manufacturers, setManufacturers] = useState([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [showManufacturerModal, setShowManufacturerModal] = useState(false);
  const [newManufacturer, setNewManufacturer] = useState("");
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [category, setCategory] = useState("other");
  const [unit, setUnit] = useState("pcs");
  const [inventoryValuation, setInventoryValuation] = useState("FIFO (First In First Out)");
  const [taxPreference, setTaxPreference] = useState("taxable");
  const [exemptionReason, setExemptionReason] = useState("");
  const [intraStateTaxRate, setIntraStateTaxRate] = useState("");
  const [interStateTaxRate, setInterStateTaxRate] = useState("");
  const [itemRows, setItemRows] = useState([]);
  const [generatedItems, setGeneratedItems] = useState([]);
  const [manualItemsSnapshot, setManualItemsSnapshot] = useState([]);
  const [itemSkuManuallyEdited, setItemSkuManuallyEdited] = useState({}); // Track which items have manually edited SKU
  const previousGeneratedItemsRef = useRef([]); // Store previous items to preserve manual edits
  const [priceIncludesGST, setPriceIncludesGST] = useState(true);
  const [groupImages, setGroupImages] = useState([]);
  // Snapshot of attribute rows when the group was loaded (edit mode) to detect newly added attributes/options
  const initialAttributeRowsRef = useRef([]);

  const API_ROOT = (baseUrl?.baseUrl || "").replace(/\/$/, "");
  const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";

  // Fetch manufacturers from backend
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        const response = await fetch(`${API_ROOT}/api/shoe-sales/manufacturers?isActive=true`);
        if (response.ok) {
          const data = await response.json();
          const manufacturerNames = data.map((m) => m.name);
          setManufacturers(manufacturerNames);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.manufacturers, JSON.stringify(manufacturerNames));
          }
        } else {
          const stored = loadStoredList(STORAGE_KEYS.manufacturers);
          setManufacturers(stored);
        }
      } catch (error) {
        console.error("Error fetching manufacturers:", error);
        const stored = loadStoredList(STORAGE_KEYS.manufacturers);
        setManufacturers(stored);
      }
    };
    fetchManufacturers();
  }, []);

  // Fetch brands from backend
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await fetch(`${API_ROOT}/api/shoe-sales/brands?isActive=true`);
        if (response.ok) {
          const data = await response.json();
          const brandNames = data.map((b) => b.name);
          setBrands(brandNames);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.brands, JSON.stringify(brandNames));
          }
        } else {
          const stored = loadStoredList(STORAGE_KEYS.brands);
          setBrands(stored);
        }
      } catch (error) {
        console.error("Error fetching brands:", error);
        const stored = loadStoredList(STORAGE_KEYS.brands);
        setBrands(stored);
      }
    };
    fetchBrands();
  }, []);

  const extractGSTPercentage = useCallback((taxRate) => {
    if (!taxRate) return null;
    const match = taxRate.match(/\[(\d+(?:\.\d+)?)%\]/);
    if (match) {
      const parsed = parseFloat(match[1]);
      return Number.isNaN(parsed) ? null : parsed;
    }
    const fallback = parseFloat(taxRate);
    return Number.isNaN(fallback) ? null : fallback;
  }, []);

  const calculateGSTDetails = useCallback((amount, taxRate, isInclusive = false) => {
    if (!amount || !taxRate) return null;
    const price = parseFloat(amount);
    if (!Number.isFinite(price) || price === 0) return null;

    const percentage = extractGSTPercentage(taxRate);
    if (percentage === null) return null;

    let basePrice = 0;
    let gstAmount = 0;
    let finalPrice = 0;

    if (isInclusive) {
      basePrice = price / (1 + percentage / 100);
      gstAmount = price - basePrice;
      finalPrice = price;
    } else {
      basePrice = price;
      gstAmount = price * (percentage / 100);
      finalPrice = price + gstAmount;
    }

    return {
      basePrice: basePrice.toFixed(2),
      gstAmount: gstAmount.toFixed(2),
      finalPrice: finalPrice.toFixed(2),
      percentage,
    };
  }, [extractGSTPercentage]);

  // Generate SKU from item group name (similar to ShoeSalesItemCreate.jsx)
  const generateSkuPreview = useCallback((name = "", size = "", attributeCombo = []) => {
    const words = name
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .split(/[\s-_,]+/)
      .filter(Boolean);

    if (words.length === 0) {
      return "";
    }

    const alphaWords = words.filter((word) => /[A-Za-z]/.test(word));
    const numericWords = words.filter((word) => /^\d+$/.test(word));

    // Build SKU with shorter format but still unique
    let letters = "";
    
    if (alphaWords.length > 0) {
      // Take minimal characters but ensure uniqueness, especially for last word
      if (alphaWords.length === 1) {
        // Single word: take first 3 chars
        letters = alphaWords[0].slice(0, 3).toUpperCase();
      } else if (alphaWords.length === 2) {
        // Two words: first 2 chars from first, first 2 chars from second
        letters = (alphaWords[0].slice(0, 2) + alphaWords[1].slice(0, 2)).toUpperCase();
      } else if (alphaWords.length === 3) {
        // Three words: first letter of first two + first 3 chars of last (ensures uniqueness)
        letters = (alphaWords[0][0] + alphaWords[1][0] + alphaWords[2].slice(0, 3)).toUpperCase();
      } else {
        // Four or more words: first letter of first two + first 2 chars from rest
        letters = (alphaWords[0][0] + alphaWords[1][0]).toUpperCase();
        for (let i = 2; i < alphaWords.length && letters.length < 6; i++) {
          letters += alphaWords[i].slice(0, 2).toUpperCase();
        }
      }
    }

    if (!letters && words.length > 0) {
      letters = words[0].slice(0, 4).toUpperCase();
    }

    let base = letters || "IGRP";
    const digits = numericWords.join("");
    if (digits) {
      base += `-${digits}`;
    }

    // Add attribute combination to SKU for uniqueness (if provided)
    // This ensures each color/size combination gets a unique SKU
    if (attributeCombo && attributeCombo.length > 0) {
      // Create a short code from the attribute values
      const attrCode = attributeCombo
        .map(attr => {
          if (!attr) return "";
          // Take first 2 chars of each attribute value
          return attr.slice(0, 2).toUpperCase();
        })
        .filter(Boolean)
        .join("");
      
      if (attrCode) {
        base += `-${attrCode}`;
      }
    } else if (size && size.trim()) {
      // Fallback to size if no attribute combo provided
      base += `-${size.trim()}`;
    }

    return base;
  }, []);

  // Auto-generate SKU when item group name changes (only in create mode)
  useEffect(() => {
    if (!isEditMode && !skuManuallyEdited && itemGroupName) {
      setItemGroupSku(generateSkuPreview(itemGroupName));
    }
  }, [itemGroupName, skuManuallyEdited, generateSkuPreview, isEditMode]);

  // Fetch item group data when in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      const fetchItemGroup = async () => {
        try {
          setLoading(true);
          const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
          const response = await fetch(`${API_URL}/api/shoe-sales/item-groups/${id}`);
          
          if (!response.ok) {
            throw new Error("Failed to fetch item group");
          }
          
          const data = await response.json();
          
          // Populate all form fields with existing data
          const rawAttributeRows = Array.isArray(data.attributeRows)
            ? data.attributeRows.map((row, idx) => ({
                id: idx + 1,
                attribute: row?.attribute || "",
                options: Array.isArray(row?.options) ? row.options : [],
                optionInput: ""
              }))
            : [];
          const validAttributeRows = rawAttributeRows.filter(
            (row) =>
              row.attribute.trim() !== "" &&
              row.options.some((opt) => typeof opt === "string" && opt.trim() !== "")
          );
          const hasAttributeRows = validAttributeRows.length > 0;
          const shouldUseAttributes =
            (data.createAttributes !== undefined ? data.createAttributes : hasAttributeRows) && hasAttributeRows;

          setItemGroupName(data.name || "");
          setItemGroupSku(data.sku || "");
          setSkuManuallyEdited(!!data.sku);
          setItemType(data.itemType || "goods");
          setUnit(data.unit || "");
          setSelectedManufacturer(data.manufacturer || "");
          setSelectedBrand(data.brand || "");
          if (data.manufacturer) {
            setManufacturers((prev) =>
              prev.includes(data.manufacturer) ? prev : [...prev, data.manufacturer]
            );
          }
          if (data.brand) {
            setBrands((prev) =>
              prev.includes(data.brand) ? prev : [...prev, data.brand]
            );
          }
          setInventoryValuation(data.inventoryValuationMethod || "FIFO (First In First Out)");
          setTaxPreference(data.taxPreference || "taxable");
          setExemptionReason(data.exemptionReason || "");
          setIntraStateTaxRate(data.intraStateTaxRate || data.taxRateIntra || "");
          setInterStateTaxRate(data.interStateTaxRate || data.taxRateInter || "");
          setCreateAttributes(shouldUseAttributes);
          setSellable(data.sellable !== undefined ? data.sellable : true);
          setPurchasable(data.purchasable !== undefined ? data.purchasable : true);
          setReturnable(data.returnable !== undefined ? data.returnable : true);
          setGroupImages(data.groupImages || data.images || []);
          
          // Set attribute rows if they exist
          setAttributeRows(rawAttributeRows.length > 0 ? rawAttributeRows : [{ id: 1, attribute: "", options: [], optionInput: "" }]);
          // Keep a snapshot to compare later (edit mode)
          initialAttributeRowsRef.current = (rawAttributeRows || []).map(r => ({
            attribute: (r.attribute || "").toLowerCase().trim(),
            options: Array.isArray(r.options) ? [...r.options] : []
          }));
          
          // Set items - either from generated items or manual items
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            if (shouldUseAttributes) {
              // Items were generated from attributes
              const loadedItems = data.items.map(item => {
                // Preserve the saved item name from the database. Only fall back to auto-generating
                // if the name is blank/empty.
                let itemName = item.name || "";
                if (!itemName && item.attributeCombination && Array.isArray(item.attributeCombination) && item.attributeCombination.length > 0) {
                  const optionsStr = item.attributeCombination.filter(Boolean).join("/");
                  itemName = `${data.name || "Item"} - ${optionsStr}`;
                  console.log(`Loading item: name was empty, generated name="${itemName}"`);
                }
                
                // Extract size from attributeCombination if size attribute exists
                const sizeAttributeIndex = rawAttributeRows.findIndex(row => row.attribute?.toLowerCase() === "size");
                const sizeValue = sizeAttributeIndex !== -1 && item.attributeCombination && item.attributeCombination[sizeAttributeIndex]
                  ? item.attributeCombination[sizeAttributeIndex]
                  : (item.size || "");
                
                return {
                  id: item._id || item.id || `item-${Date.now()}-${Math.random()}`,
                  _id: item._id && item._id.match(/^[0-9a-fA-F]{24}$/) ? item._id : undefined, // Only set _id if it's a valid MongoDB ObjectId
                  name: itemName, // Use regenerated name based on current attributeCombination
                  sku: item.sku || "",
                  size: sizeValue, // Include size
                  costPrice: item.costPrice !== undefined && item.costPrice !== null ? item.costPrice.toString() : "",
                  sellingPrice: item.sellingPrice !== undefined && item.sellingPrice !== null ? item.sellingPrice.toString() : "",
                  mrp: item.mrp !== undefined && item.mrp !== null ? item.mrp.toString() : (item.sellingPrice !== undefined && item.sellingPrice !== null ? item.sellingPrice.toString() : ""),
                  upc: item.upc || "",
                  hsnCode: item.hsnCode || "",
                  isbn: item.isbn || "",
                  reorderPoint: item.reorderPoint || "",
                  sac: item.sac || "",
                  stock: item.stock || 0,
                  attributeCombination: item.attributeCombination || [],
                  warehouseStocks: item.warehouseStocks || [] // PRESERVE warehouse stocks
                };
              });
              console.log(`Loaded ${loadedItems.length} items from database:`, loadedItems);
              setGeneratedItems(loadedItems);
              // Update the ref so regeneration preserves these values
              previousGeneratedItemsRef.current = loadedItems;
            } else {
              // Manual items
              const manualItems = data.items.map(item => ({
                id: item._id || item.id || `item-${Date.now()}-${Math.random()}`,
                _id: item._id && item._id.match(/^[0-9a-fA-F]{24}$/) ? item._id : undefined, // Only set _id if it's a valid MongoDB ObjectId
                name: item.name || "",
                sku: item.sku || "",
                costPrice: item.costPrice !== undefined && item.costPrice !== null ? item.costPrice.toString() : "",
                sellingPrice: item.sellingPrice !== undefined && item.sellingPrice !== null ? item.sellingPrice.toString() : "",
                mrp: item.mrp !== undefined && item.mrp !== null ? item.mrp.toString() : (item.sellingPrice !== undefined && item.sellingPrice !== null ? item.sellingPrice.toString() : ""),
                upc: item.upc || "",
                hsnCode: item.hsnCode || "",
                isbn: item.isbn || "",
                reorderPoint: item.reorderPoint || "",
                sac: item.sac || "",
                stock: item.stock || 0,
                warehouseStocks: item.warehouseStocks || [] // PRESERVE warehouse stocks
              }));
              setItemRows(manualItems);
              setManualItemsSnapshot(manualItems);
            }
          }
          
        } catch (error) {
          console.error("Error fetching item group:", error);
          alert("Failed to load item group data. Please try again.");
          navigate("/shoe-sales/item-groups");
        } finally {
          setLoading(false);
        }
      };
      
      fetchItemGroup();
    }
  }, [isEditMode, id, navigate]);

  // Generate items from attribute rows - combining all attribute options
  useEffect(() => {
    // In edit mode, only regenerate if user actually ADDED a new attribute or option
    if (isEditMode) {
      const normalizedCurrent = (attributeRows || []).map(r => ({
        attribute: (r.attribute || "").toLowerCase().trim(),
        options: Array.isArray(r.options) ? r.options : []
      }));
      const normalizedInitial = initialAttributeRowsRef.current || [];
      // Detect new attribute row
      const currentAttrSet = new Set(normalizedCurrent.map(r => r.attribute).filter(Boolean));
      const initialAttrSet = new Set(normalizedInitial.map(r => r.attribute).filter(Boolean));
      let added = false;
      for (const attr of currentAttrSet) {
        if (!initialAttrSet.has(attr)) {
          added = true;
          break;
        }
      }
      // Detect new option appended to any existing attribute
      if (!added) {
        for (const curr of normalizedCurrent) {
          const ini = normalizedInitial.find(r => r.attribute === curr.attribute);
          if (!ini) continue;
          const iniSet = new Set(ini.options);
          const newOpt = (curr.options || []).some(opt => !iniSet.has(opt));
          if (newOpt) {
            added = true;
            break;
          }
        }
      }
      if (!added) {
        // No new attributes/options introduced → do not regenerate
        return;
      }
      // else fall through to regeneration logic below
    }
    if (!createAttributes || !attributeRows || attributeRows.length === 0) {
      // Only clear generatedItems if we're switching away from attribute mode
      // Don't clear if we have existing items that should be preserved
      if (previousGeneratedItemsRef.current.length === 0) {
        setGeneratedItems([]);
      } else {
        // Preserve existing items even if attributes are empty/invalid
        // This happens when toggling checkbox in edit mode
        setGeneratedItems(previousGeneratedItemsRef.current);
      }
      return;
    }

    // Get all rows with attributes and options
    const validRows = attributeRows.filter(row => row.attribute && row.options.length > 0);
    
    if (validRows.length === 0) {
      // Preserve existing items if we have them
      // Only clear if we're starting fresh
      if (previousGeneratedItemsRef.current.length === 0) {
        setGeneratedItems([]);
      } else {
        // Preserve existing items even if attributes are temporarily invalid
        setGeneratedItems(previousGeneratedItemsRef.current);
      }
      return;
    }

    // Generate cartesian product of all options
    const generateCombinations = (arrays) => {
      if (arrays.length === 0) return [[]];
      if (arrays.length === 1) return arrays[0].map(opt => [opt]);
      
      const [first, ...rest] = arrays;
      const restCombinations = generateCombinations(rest);
      const result = [];
      
      first.forEach(option => {
        restCombinations.forEach(combo => {
          result.push([option, ...combo]);
        });
      });
      
      return result;
    };

    const optionArrays = validRows.map(row => row.options);
    const combinations = generateCombinations(optionArrays);
    
    console.log(`Generating ${combinations.length} item combinations from attributes:`, {
      validRows: validRows.map(r => ({ attribute: r.attribute, options: r.options })),
      combinations: combinations,
      previousItemsCount: previousGeneratedItemsRef.current.length
    });
    
    // Find size attribute index
    const sizeAttributeIndex = validRows.findIndex(row => row.attribute?.toLowerCase() === "size");
    
    const items = combinations.map((combo, idx) => {
      // Extract size from attribute combination if size attribute exists
      const sizeValue = sizeAttributeIndex !== -1 && combo[sizeAttributeIndex] ? combo[sizeAttributeIndex] : "";
      
      // Create item name: "ItemGroupName - option1/option2/option3"
      const optionsStr = combo.join("/");
      const itemName = `${itemGroupName || "Item"} - ${optionsStr}`;
      
      // For SKU generation, use base name without size in the name part
      const baseName = itemGroupName || "Item";
      
      // Check if this item already exists in previous items (by matching attribute combination or by ID)
      // First try to match by attribute combination
      let existingItem = previousGeneratedItemsRef.current.find(existing => 
        JSON.stringify(existing.attributeCombination) === JSON.stringify(combo)
      );
      
      // If not found by combination, try to match by name (for backward compatibility)
      if (!existingItem) {
        existingItem = previousGeneratedItemsRef.current.find(existing => 
          existing.name === itemName
        );
      }
      
      if (existingItem) {
        console.log(`Found existing item for combination [${combo.join(", ")}], preserving data`);
      } else {
        console.log(`Creating new item for combination [${combo.join(", ")}]`);
      }
      
      // If item exists and SKU was manually edited, preserve it
      // Otherwise, auto-generate SKU from item name + size + attribute combination
      const itemSku = existingItem && itemSkuManuallyEdited[existingItem.id]
        ? existingItem.sku
        : generateSkuPreview(baseName, sizeValue, combo);
      
      // Preserve other fields from existing item if it exists
      return {
        id: existingItem?.id || `item-${Date.now()}-${idx}`,
        name: itemName,
        sku: itemSku,
        size: existingItem?.size || sizeValue, // Store size
        costPrice: existingItem?.costPrice !== undefined && existingItem?.costPrice !== null ? existingItem.costPrice.toString() : "",
        sellingPrice: existingItem?.sellingPrice !== undefined && existingItem?.sellingPrice !== null ? existingItem.sellingPrice.toString() : "0",
        mrp: existingItem?.mrp !== undefined && existingItem?.mrp !== null ? existingItem.mrp.toString() : (existingItem?.sellingPrice !== undefined && existingItem?.sellingPrice !== null ? existingItem.sellingPrice.toString() : "0"),
        upc: existingItem?.upc || "",
        hsnCode: existingItem?.hsnCode || "",
        isbn: existingItem?.isbn || "",
        reorderPoint: existingItem?.reorderPoint || "",
        sac: existingItem?.sac || "",
        stock: existingItem?.stock || 0,
        attributeCombination: combo // Store which options were combined
      };
    });
    
    // Preserve items from previous items that don't match any generated combinations
    // These are likely transferred/manually added items without attribute combinations
    const matchedIds = new Set(items.map(item => item.id));
    const unmatchedItems = previousGeneratedItemsRef.current.filter(existing => {
      // Check if this item doesn't have a matching attribute combination
      const existingCombo = existing.attributeCombination || [];
      const hasMatchingCombo = combinations.some(combo => 
        JSON.stringify(existingCombo) === JSON.stringify(combo)
      );
      // Also check if it's not already matched by ID
      const alreadyMatched = matchedIds.has(existing.id);
      // Include items that don't have matching combinations
      // This includes transferred items (with empty attributeCombination) or items without attribute combinations
      return !hasMatchingCombo && !alreadyMatched && (existingCombo.length === 0 || !existing.attributeCombination);
    });
    
    // Combine generated items with unmatched items (transferred items)
    const allItems = [...items, ...unmatchedItems];
    
    setGeneratedItems(allItems);
    // Update ref with new items for next regeneration
    previousGeneratedItemsRef.current = allItems;
  }, [createAttributes, attributeRows, itemGroupName, generateSkuPreview, itemSkuManuallyEdited]);

  // Copy to All handlers
  useEffect(() => {
    if (!createAttributes) {
      setManualItemsSnapshot(itemRows);
    }
  }, [createAttributes, itemRows]);

  const handleCopyToAll = (field) => {
    if (createAttributes) {
      // For generated items
      if (generatedItems.length === 0) return;
      const firstValue = generatedItems[0][field] || "";
      const updated = generatedItems.map((item) => ({
        ...item,
        [field]: firstValue,
      }));
      setGeneratedItems(updated);
      previousGeneratedItemsRef.current = updated;
    } else {
      // For manual items
      if (itemRows.length === 0) return;
      const firstValue = itemRows[0][field] || "";
      const updated = itemRows.map((item) => ({
        ...item,
        [field]: firstValue,
      }));
      setItemRows(updated);
    }
  };

  const switchToAttributeMode = () => {
    setManualItemsSnapshot(itemRows);
    // If we have itemRows and no generatedItems, convert itemRows to generatedItems
    // This preserves items when switching from manual to attribute mode
    if (itemRows.length > 0 && generatedItems.length === 0) {
      const convertedItems = itemRows.map(item => ({
        ...item,
        id: item.id || `item-${Date.now()}-${Math.random()}`,
        attributeCombination: item.attributeCombination || []
      }));
      setGeneratedItems(convertedItems);
      previousGeneratedItemsRef.current = convertedItems;
    } else if (generatedItems.length > 0) {
      // Preserve existing generatedItems
      previousGeneratedItemsRef.current = generatedItems;
    }
    setItemRows([]);
    setCreateAttributes(true);
  };

  const switchToManualMode = () => {
    setCreateAttributes(false);
    if (manualItemsSnapshot.length > 0) {
      setItemRows(
        manualItemsSnapshot.map((item) => ({
          ...item,
          id: item.id || `item-${Date.now()}-${Math.random()}`
        }))
      );
    } else if (itemRows.length === 0) {
      setItemRows([
        {
          id: Date.now(),
          name: "",
          sku: "",
          costPrice: "",
          sellingPrice: "0",
          mrp: "0",
          upc: "",
          hsnCode: "",
          isbn: "",
          reorderPoint: "",
          sac: ""
        }
      ]);
    }
  };

  const handleCreateAttributesToggle = (checked) => {
    if (checked) {
      switchToAttributeMode();
    } else {
      setShowSingleItemModal(true);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!itemGroupName || itemGroupName.trim() === "") {
      alert("Item Group Name is required");
      return;
    }
    
    if (!unit || unit.trim() === "") {
      alert("Unit is required");
      return;
    }

    if (taxPreference === "non-taxable" && (!exemptionReason || exemptionReason.trim() === "")) {
      alert("Exemption reason is required for non-taxable items");
      return;
    }
    
    try {
      const normalizedIntra = taxPreference === "taxable" ? (intraStateTaxRate || "") : "";
      const normalizedInter = taxPreference === "taxable" ? (interStateTaxRate || "") : "";
      const normalizedExemption = taxPreference === "non-taxable" ? exemptionReason.trim() : "";

      // Get items (either generated or manual)
      const items = createAttributes ? generatedItems : itemRows;
      
      // Filter out items without names (required field)
      const validItems = items.filter(item => item && item.name && item.name.trim() !== "");
      
      // Check for duplicate SKUs within the items being saved
      const skuMap = new Map();
      const duplicateSkus = [];
      validItems.forEach((item, idx) => {
        if (item.sku && item.sku.trim()) {
          const sku = item.sku.trim().toUpperCase();
          if (skuMap.has(sku)) {
            duplicateSkus.push({ sku, indices: [skuMap.get(sku), idx] });
          } else {
            skuMap.set(sku, idx);
          }
        }
      });
      
      if (duplicateSkus.length > 0) {
        const duplicateSkuList = [...new Set(duplicateSkus.map(d => d.sku))].join(", ");
        alert(`Duplicate SKUs found within the group: ${duplicateSkuList}. Each item must have a unique SKU.`);
        return;
      }
      
      // Check for duplicate SKUs with existing items in database (for standalone items)
      // Note: For item groups, SKUs are unique within the group, but we should still check against standalone items
      // SKIP THIS CHECK IN EDIT MODE - SKUs are already unique
      if (!isEditMode) {
        const skusToCheck = validItems.filter(item => item.sku && item.sku.trim()).map(item => item.sku.trim().toUpperCase());
        if (skusToCheck.length > 0) {
          try {
            const checkPromises = skusToCheck.map(async (sku) => {
              const response = await fetch(`${API_ROOT}/api/shoe-sales/items?sku=${encodeURIComponent(sku)}`);
              if (response.ok) {
                const data = await response.json();
                const items = Array.isArray(data) ? data : (data.items || []);
                return items.some(item => item.sku?.toUpperCase() === sku);
              }
              return false;
            });
            
            const results = await Promise.all(checkPromises);
            const existingSkus = skusToCheck.filter((_, idx) => results[idx]);
            
            if (existingSkus.length > 0) {
              alert(`The following SKUs already exist in the system: ${existingSkus.join(", ")}. Please use different SKUs.`);
              return;
            }
          } catch (error) {
            console.error("Error checking SKU uniqueness:", error);
            // Continue with save even if check fails (network issue)
          }
        }
      }
      
      console.log("Items to save:", validItems.length, validItems);
      
      // Create item group data
      const itemGroupData = {
        name: itemGroupName.trim(),
        sku: itemGroupSku.trim(),
        itemType,
        unit,
        manufacturer: selectedManufacturer || "",
        brand: selectedBrand || "",
        category: category || "other",
        inventoryValuationMethod: inventoryValuation || "",
        taxPreference,
        exemptionReason: normalizedExemption,
        intraStateTaxRate: normalizedIntra,
        interStateTaxRate: normalizedInter,
        taxRateIntra: normalizedIntra,
        taxRateInter: normalizedInter,
        createAttributes,
        attributeRows: attributeRows || [],
        sellable,
        purchasable,
        returnable,
        trackInventory: itemType === "goods",
        items: validItems.map(item => {
          let itemName = (item.name || "").trim();

          // Only auto-generate name from attributes if:
          // 1. The item name is empty, OR
          // 2. It looks like it was previously auto-generated (matches "GroupName - attribute" pattern)
          //    AND the user did NOT manually change it.
          if (createAttributes && item.attributeCombination && Array.isArray(item.attributeCombination) && item.attributeCombination.length > 0) {
            const optionsStr = item.attributeCombination.filter(Boolean).join("/");
            const autoName = optionsStr ? `${itemGroupName.trim()} - ${optionsStr}` : "";

            if (!itemName || itemName === autoName) {
              // Name is empty or exactly matches the auto-generated pattern → auto-generate
              itemName = autoName || itemGroupName.trim();
            }
            // Otherwise, the user gave a custom name — preserve it.
          }

          return {
            _id: item._id && item._id.match(/^[0-9a-fA-F]{24}$/) ? item._id : undefined,
            name: itemName,
            sku: item.sku || "",
            size: item.size || "",
            costPrice: parseFloat(item.costPrice) || 0,
            sellingPrice: parseFloat(item.sellingPrice) || 0,
            mrp: parseFloat(item.mrp) > 0 ? parseFloat(item.mrp) : (parseFloat(item.sellingPrice) || 0),
            upc: item.upc || "",
            hsnCode: item.hsnCode || "",
            isbn: item.isbn || "",
            reorderPoint: item.reorderPoint || "",
            sac: item.sac || "",
            stock: parseFloat(item.stock) || 0,
            attributeCombination: item.attributeCombination || [],
            returnable: null,
            warehouseStocks: item.warehouseStocks || [],
          };
        }),
        stock: 0,
        reorder: "",
      };
      
      console.log("Item group data being sent:", {
        name: itemGroupData.name,
        itemsCount: itemGroupData.items.length,
        items: itemGroupData.items
      });

      // Get user's warehouse information
      const currentUser = JSON.parse(localStorage.getItem("rootfinuser")) || {};
      const userLocName = currentUser.username || currentUser.locName || "";
      
      // Helper function to map locName to warehouse name
      const mapLocNameToWarehouse = (locName) => {
        if (!locName) return "Warehouse";
        // Remove prefixes like "G.", "Z.", "SG."
        let warehouse = locName.replace(/^[A-Z]\.?\s*/i, "").trim();
        // Add "Branch" if not already present and not "Warehouse"
        if (warehouse && warehouse.toLowerCase() !== "warehouse" && !warehouse.toLowerCase().includes("branch")) {
          warehouse = `${warehouse} Branch`;
        }
        return warehouse || "Warehouse";
      };
      
      const userWarehouse = mapLocNameToWarehouse(userLocName);
      
      // Process images: extract base64 data and format properly
      const processedGroupImages = groupImages.map(img => {
        let base64Data = img.base64 || img.data || img;
        if (typeof base64Data === "string" && base64Data.startsWith("data:")) {
          base64Data = base64Data.split(",")[1] || base64Data;
        }
        return {
          filename: img.name || img.filename || "image",
          contentType: img.type || img.contentType || "image/jpeg",
          data: base64Data,
        };
      });

      // Add warehouse information to itemGroupData
      const itemGroupDataWithWarehouse = {
        ...itemGroupData,
        userWarehouse: userWarehouse,
        userLocName: userLocName,
        groupImages: processedGroupImages,
      };
      
      // Save to backend
      const API_URL = baseUrl?.baseUrl?.replace(/\/$/, "") || "http://localhost:7000";
      const url = isEditMode 
        ? `${API_URL}/api/shoe-sales/item-groups/${id}`
        : `${API_URL}/api/shoe-sales/item-groups`;
      
      const response = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemGroupDataWithWarehouse),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: isEditMode ? "Failed to update item group" : "Failed to save item group" }));
        const errorMessage = errorData.errors 
          ? errorData.errors.join(", ") 
          : (errorData.message || (isEditMode ? "Failed to update item group" : "Failed to save item group"));
        
        // If it's a SKU duplicate error (409), show a clear alert
        if (response.status === 409) {
          alert(errorMessage);
          return; // Stop execution, don't navigate
        }
        
        throw new Error(errorMessage);
      }

      // Navigate to groups page or detail page
      if (isEditMode) {
        navigate(`/shoe-sales/item-groups/${id}`);
      } else {
        navigate("/shoe-sales/item-groups");
      }
    } catch (error) {
      console.error("Error saving item group:", error);
      alert(error.message || "Failed to save item group. Please try again.");
    }
  };

  // Enter key to save item group
  useEnterToSave((e) => {
    const syntheticEvent = e || { preventDefault: () => {} };
    handleSave(syntheticEvent);
  }, loading);  if (loading) {
    return (
      <div className={`transition-all duration-300 min-h-screen bg-[#FAFAFA] p-6 flex items-center justify-center ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-md p-8 text-center max-w-sm w-full">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-semibold text-gray-700">Loading item group...</p>
        </div>
      </div>
    );
  }

  const selectedTaxRateValue = intraStateTaxRate || interStateTaxRate;

  return (
    <div className="invoice-page-wrapper min-h-screen bg-[#FAFAFA] text-[#212121]">
      <Header title={isEditMode ? "Edit Item Group" : "Add Item Group"} />

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'ml-[240px]' : 'ml-0'}`}>
        {/* Clean Page Title Header */}
        <div className="bg-white px-6 md:px-8 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[18px] font-semibold text-[#212121]">
            {isEditMode ? "Edit Item Group" : "Add Item Group"}
          </h1>
        </div>
        <div className="p-5 md:p-6 max-w-[1440px] mx-auto space-y-5">
          {/* Card 1: Main Item Group Details */}
          <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 space-y-5">
            {/* Row 1: Item Group Name, SKU, Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="rf-field-label">
                  Item Group Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  value={itemGroupName}
                  onChange={(e) => {
                    setItemGroupName(e.target.value);
                    if (!skuManuallyEdited) {
                      setItemGroupSku(generateSkuPreview(e.target.value));
                    }
                  }}
                  className="rf-input !h-[40px]"
                  placeholder="Enter item group name"
                />
              </div>

              <div>
                <label className="rf-field-label">SKU</label>
                <input
                  type="text"
                  value={itemGroupSku}
                  onChange={(e) => {
                    setSkuManuallyEdited(true);
                    setItemGroupSku(e.target.value.toUpperCase());
                  }}
                  className="rf-input !h-[40px]"
                  placeholder="e.g. IGRP-001"
                />
              </div>

              <UnitSelect
                label="Unit"
                required
                placeholder="Select or enter the unit"
                value={unit}
                onChange={setUnit}
                options={unitOptions}
              />
            </div>

            {/* Row 2: Description */}
            <div>
              <label className="rf-field-label">Description</label>
              <textarea
                rows={3}
                placeholder="Enter description"
                className="w-full rounded-[10px] border border-[#E5E5E5] bg-white p-3.5 text-[13px] text-[#212121] placeholder:text-[#A1A1AA] focus:border-[#9D43D6] focus:ring-2 focus:ring-[#9D43D6]/15 focus:outline-none transition resize-none"
              />
            </div>

            {/* Row 3: Returnable Item Checkbox */}
            <div>
              {itemType === "goods" ? (
                <FloatingCheckbox
                  label="Returnable Item"
                  checked={returnable}
                  onChange={(e) => setReturnable(e.target.checked)}
                />
              ) : (
                <FloatingCheckbox label="Receivable Item" />
              )}
            </div>

            {/* Row 4: Manufacturer, Brand, Inventory Valuation Method */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ManufacturerSelect
                label="Manufacturer"
                placeholder="Enter or select manufacturer"
                value={selectedManufacturer}
                onChange={setSelectedManufacturer}
                manufacturers={manufacturers}
                onManageClick={() => setShowManufacturerModal(true)}
              />
              <BrandSelect
                label="Brand"
                placeholder="Enter or select brand"
                value={selectedBrand}
                onChange={setSelectedBrand}
                brands={brands}
                onManageClick={() => setShowBrandModal(true)}
              />
              {itemType === "goods" && (
                <InventoryValuationSelect
                  label="Inventory Valuation Method"
                  value={inventoryValuation}
                  onChange={setInventoryValuation}
                />
              )}
            </div>

            {/* Row 5: Tax Preference */}
            <div className="pt-1 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9D43D6]">
                TAX PREFERENCE
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#212121] cursor-pointer select-none">
                  <input
                    type="radio"
                    name="taxPreference"
                    value="taxable"
                    checked={taxPreference === "taxable"}
                    onChange={(e) => {
                      setTaxPreference(e.target.value);
                      setExemptionReason("");
                    }}
                    className="w-4 h-4 accent-[#9D43D6] cursor-pointer"
                  />
                  <span>Taxable</span>
                </label>
                <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#212121] cursor-pointer select-none">
                  <input
                    type="radio"
                    name="taxPreference"
                    value="non-taxable"
                    checked={taxPreference === "non-taxable"}
                    onChange={(e) => setTaxPreference(e.target.value)}
                    className="w-4 h-4 accent-[#9D43D6] cursor-pointer"
                  />
                  <span>Non taxable</span>
                </label>
              </div>
              {taxPreference === "non-taxable" && (
                <div className="pt-2 max-w-md">
                  <label className="rf-field-label">
                    Exemption Reason <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    value={exemptionReason}
                    onChange={(e) => setExemptionReason(e.target.value)}
                    placeholder="Select or type to add"
                    className="rf-input !h-[40px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Row 2: 2-Column Bento — Default Tax Rates (Left) + Image Upload (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* Left Card: Default Tax Rates */}
            <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9D43D6]">
                DEFAULT TAX RATES
              </div>
              {taxPreference === "taxable" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TaxRateSelect
                      label="Intra State Tax Rate"
                      value={intraStateTaxRate}
                      onChange={setIntraStateTaxRate}
                      type="intra"
                    />
                    <TaxRateSelect
                      label="Inter State Tax Rate"
                      value={interStateTaxRate}
                      onChange={setInterStateTaxRate}
                      type="inter"
                    />
                  </div>
                  <div className="pt-1">
                    <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#212121] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer"
                        checked={priceIncludesGST}
                        onChange={(e) => setPriceIncludesGST(e.target.checked)}
                      />
                      <span>Price includes GST</span>
                    </label>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-[#7A7A7A]">
                  Tax rates are disabled because this item group is marked as Non-Taxable.
                </p>
              )}
            </div>

            {/* Right Card: Group Images */}
            <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-5 flex flex-col justify-center">
              <ImageUpload
                onImagesSelect={(images) => setGroupImages(images)}
                existingImages={groupImages}
                onRemoveImage={(index) => {
                  setGroupImages(groupImages.filter((_, i) => i !== index));
                }}
                multiple={true}
              />
            </div>
          </div>

          {/* Card 3: Create Attribute & Options */}
          <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9D43D6]">
                CREATE ATTRIBUTE &amp; OPTIONS
              </div>
              <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#212121] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createAttributes}
                  onChange={(e) => handleCreateAttributesToggle(e.target.checked)}
                  className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer"
                />
                <span>Enable Attributes</span>
              </label>
            </div>

            {createAttributes && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attributeRows.map((row, rowIndex) => (
                  <div
                    key={row.id}
                    className="rounded-[12px] border border-dashed border-[#D4D4D8] bg-[#FAFAFA]/40 p-4 space-y-3.5"
                  >
                    <div>
                      <label className="rf-field-label">
                        Attribute <span className="text-[#EF4444]">*</span>
                      </label>
                      <input
                        type="text"
                        value={row.attribute}
                        onChange={(e) => {
                          const updated = [...attributeRows];
                          updated[rowIndex].attribute = e.target.value;
                          setAttributeRows(updated);
                        }}
                        placeholder="eg. colour"
                        className="rf-input !h-[38px] bg-white"
                      />
                    </div>

                    <div>
                      <label className="rf-field-label">
                        Options <span className="text-[#EF4444]">*</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-[#E5E5E5] bg-white px-3 py-1.5 min-h-[38px] focus-within:border-[#9D43D6] focus-within:ring-2 focus-within:ring-[#9D43D6]/15 transition">
                        {row.options.map((opt, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-[6px] bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-semibold text-[#9D43D6]"
                          >
                            {opt}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...attributeRows];
                                updated[rowIndex].options = updated[rowIndex].options.filter((_, i) => i !== idx);
                                setAttributeRows(updated);
                              }}
                              className="hover:text-[#6D2898] transition cursor-pointer"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={row.optionInput}
                          onChange={(e) => {
                            const updated = [...attributeRows];
                            updated[rowIndex].optionInput = e.target.value;
                            setAttributeRows(updated);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && row.optionInput.trim()) {
                              e.preventDefault();
                              const updated = [...attributeRows];
                              updated[rowIndex].options = [...updated[rowIndex].options, updated[rowIndex].optionInput.trim()];
                              updated[rowIndex].optionInput = "";
                              setAttributeRows(updated);
                            }
                          }}
                          data-handle-enter="true"
                          placeholder={row.options.length === 0 ? "Enter options and press Enter" : "+ add..."}
                          className="flex-1 border-0 bg-transparent px-1 py-0.5 text-[12px] text-[#212121] placeholder:text-[#A1A1AA] focus:outline-none min-w-[100px]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAttributeRows([...attributeRows, { id: Date.now(), attribute: "", options: [], optionInput: "" }]);
                        }}
                        className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[8px] bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#212121] text-[12px] font-medium transition cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add More Attribute</span>
                      </button>
                      {attributeRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAttributeRows(attributeRows.filter((_, i) => i !== rowIndex));
                          }}
                          className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[#FEE2E2]/80 text-[#EF4444] hover:bg-[#FEE2E2] transition cursor-pointer"
                          title="Remove Attribute"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Item Variants Header + Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold text-[#1B1B1B]">Item Variants</h2>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 py-2 text-[13px] font-medium text-[#212121] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sellable}
                    onChange={(e) => setSellable(e.target.checked)}
                    className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer"
                  />
                  <span>Sellable</span>
                </label>
                <label className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 py-2 text-[13px] font-medium text-[#212121] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={purchasable}
                    onChange={(e) => setPurchasable(e.target.checked)}
                    className="h-4 w-4 rounded-[4px] border-[#D4D4D8] accent-[#9D43D6] cursor-pointer"
                  />
                  <span>Purchasable</span>
                </label>
                {itemType === "goods" && <FloatingCheckbox label="Track Inventory" defaultChecked />}
              </div>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead className="bg-[#1B1B1B] text-white">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div>{createAttributes ? "ITEM" : "ITEM NAME*"}</div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div>SIZE</div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div>SKU</div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <span>HSN CODE</span>
                          <button
                            type="button"
                            onClick={() => handleCopyToAll("hsnCode")}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-medium normal-case cursor-pointer"
                          >
                            Copy All
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <span>REORDER POINT</span>
                          <button
                            type="button"
                            onClick={() => handleCopyToAll("reorderPoint")}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-medium normal-case cursor-pointer"
                          >
                            Copy All
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <span>COST PRICE</span>
                          <button
                            type="button"
                            onClick={() => handleCopyToAll("costPrice")}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-medium normal-case cursor-pointer"
                          >
                            Copy All
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <span>SELLING PRICE</span>
                          <button
                            type="button"
                            onClick={() => handleCopyToAll("sellingPrice")}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-medium normal-case cursor-pointer"
                          >
                            Copy All
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <span>MRP</span>
                          <button
                            type="button"
                            onClick={() => handleCopyToAll("mrp")}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-medium normal-case cursor-pointer"
                          >
                            Copy All
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                        <div>PRICE WITH GST</div>
                      </th>
                      <th className="px-3 py-3.5 w-12"></th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {!createAttributes ? (
                    <>
                      {itemRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-4 py-8 text-center text-sm font-medium text-gray-400"
                          >
                            No manual items configured
                          </td>
                        </tr>
                      )}
                      {itemRows.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-purple-50/20 transition-colors">
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].name = e.target.value;
                                if (!itemSkuManuallyEdited[item.id || idx]) {
                                  updated[idx].sku = generateSkuPreview(e.target.value, item.size || "");
                                }
                                setItemRows(updated);
                              }}
                              placeholder="Item Name"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.size || ""}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].size = e.target.value;
                                if (!itemSkuManuallyEdited[item.id || idx]) {
                                  updated[idx].sku = generateSkuPreview(item.name || "", e.target.value);
                                }
                                setItemRows(updated);
                              }}
                              placeholder="Size"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.sku}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].sku = e.target.value.toUpperCase();
                                setItemRows(updated);
                                setItemSkuManuallyEdited(prev => ({ ...prev, [item.id || idx]: true }));
                              }}
                              onFocus={(e) => {
                                if (!item.sku && !itemSkuManuallyEdited[item.id || idx] && item.name) {
                                  const updated = [...itemRows];
                                  updated[idx].sku = generateSkuPreview(item.name, item.size || "");
                                  setItemRows(updated);
                                }
                              }}
                              placeholder="Auto-generated"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.hsnCode || ""}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].hsnCode = e.target.value;
                                setItemRows(updated);
                              }}
                              placeholder="HSN"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.reorderPoint || ""}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].reorderPoint = e.target.value;
                                setItemRows(updated);
                              }}
                              placeholder="Qty"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.costPrice}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].costPrice = e.target.value;
                                setItemRows(updated);
                              }}
                              placeholder="0.00"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.sellingPrice}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].sellingPrice = e.target.value;
                                if (!updated[idx].mrp || updated[idx].mrp === "0") {
                                  updated[idx].mrp = e.target.value;
                                }
                                setItemRows(updated);
                              }}
                              placeholder="0.00"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={item.mrp || ""}
                              onChange={(e) => {
                                const updated = [...itemRows];
                                updated[idx].mrp = e.target.value;
                                setItemRows(updated);
                              }}
                              placeholder="0.00"
                              className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            {(() => {
                              const gstDetails = calculateGSTDetails(
                                item.sellingPrice,
                                selectedTaxRateValue,
                                priceIncludesGST
                              );
                              if (!gstDetails) {
                                return <span className="text-xs text-gray-400 font-mono">—</span>;
                              }
                              return priceIncludesGST ? (
                                <div className="text-[11px] font-mono space-y-0.5">
                                  <div className="text-gray-600">Base: ₹{gstDetails.basePrice}</div>
                                  <div className="text-purple-700 font-bold">Total: ₹{gstDetails.finalPrice}</div>
                                </div>
                              ) : (
                                <div className="text-[11px] font-mono space-y-0.5">
                                  <div className="text-purple-700 font-bold">Total: ₹{gstDetails.finalPrice}</div>
                                  <div className="text-gray-500">GST ({gstDetails.percentage}%): ₹{gstDetails.gstAmount}</div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => {
                                const confirmDelete = window.confirm(`Are you sure you want to delete "${item.name || "this item"}"?`);
                                if (confirmDelete) {
                                  setItemRows(itemRows.filter((_, i) => i !== idx));
                                }
                              }}
                              className="h-7 w-7 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition flex items-center justify-center cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : createAttributes && generatedItems.length > 0 ? (
                    generatedItems.map((item, idx) => {
                      let displayName = item.name;
                      if (item.attributeCombination && Array.isArray(item.attributeCombination) && item.attributeCombination.length > 0) {
                        const optionsStr = item.attributeCombination.join("/");
                        displayName = `${itemGroupName || "Item"} - ${optionsStr}`;
                      }
                      
                      const sizeAttributeIndex = attributeRows.findIndex(row => row.attribute?.toLowerCase() === "size");
                      const sizeValue = sizeAttributeIndex !== -1 && item.attributeCombination && item.attributeCombination[sizeAttributeIndex] 
                        ? item.attributeCombination[sizeAttributeIndex] 
                        : (item.size || "");
                      
                      const baseName = itemGroupName || "Item";
                      
                      return (
                      <tr key={item.id} className="hover:bg-purple-50/20 transition-colors">
                        <td className="px-3.5 py-3 text-xs font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{displayName}</span>
                            <button
                              onClick={() => {
                                const newName = window.prompt("Enter item name", item.name);
                                if (newName !== null) {
                                  const trimmedName = newName.trim();
                                  if (trimmedName !== "") {
                                    const updated = [...generatedItems];
                                    updated[idx].name = trimmedName;
                                    if (!itemSkuManuallyEdited[item.id]) {
                                      updated[idx].sku = generateSkuPreview(baseName, sizeValue, item.attributeCombination);
                                    }
                                    setGeneratedItems(updated);
                                    previousGeneratedItemsRef.current = updated;
                                  }
                                }
                              }}
                              className="h-5 w-5 rounded-md bg-purple-50 text-purple-600 hover:bg-purple-100 flex items-center justify-center transition cursor-pointer"
                              title="Rename Item"
                            >
                              <Edit size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={sizeValue}
                            onChange={(e) => {
                              const updated = [...generatedItems];
                              const newSize = e.target.value;
                              updated[idx].size = newSize;
                              if (sizeAttributeIndex !== -1 && updated[idx].attributeCombination) {
                                updated[idx].attributeCombination[sizeAttributeIndex] = newSize;
                              }
                              if (!itemSkuManuallyEdited[item.id]) {
                                updated[idx].sku = generateSkuPreview(baseName, newSize, updated[idx].attributeCombination);
                              }
                              setGeneratedItems(updated);
                              previousGeneratedItemsRef.current = updated;
                            }}
                            placeholder="Size"
                            className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.sku}
                            onChange={(e) => {
                              const updated = [...generatedItems];
                              updated[idx].sku = e.target.value.toUpperCase();
                              setGeneratedItems(updated);
                              previousGeneratedItemsRef.current = updated;
                              setItemSkuManuallyEdited(prev => ({ ...prev, [item.id]: true }));
                            }}
                            onFocus={(e) => {
                              if (!item.sku && !itemSkuManuallyEdited[item.id] && baseName) {
                                const updated = [...generatedItems];
                                updated[idx].sku = generateSkuPreview(baseName, sizeValue, item.attributeCombination);
                                setGeneratedItems(updated);
                                previousGeneratedItemsRef.current = updated;
                              }
                            }}
                            placeholder="Auto-generated"
                            className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.hsnCode || ""}
                            onChange={(e) => {
                              const updated = [...generatedItems];
                              updated[idx].hsnCode = e.target.value;
                              setGeneratedItems(updated);
                              previousGeneratedItemsRef.current = updated;
                            }}
                            placeholder="HSN"
                            className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.reorderPoint || ""}
                            onChange={(e) => {
                              const updated = [...generatedItems];
                              updated[idx].reorderPoint = e.target.value;
                              setGeneratedItems(updated);
                              previousGeneratedItemsRef.current = updated;
                            }}
                            placeholder="Qty"
                            className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.costPrice}
                            onChange={(e) => {
                              const updated = [...generatedItems];
                              updated[idx].costPrice = e.target.value;
                              setGeneratedItems(updated);
                            }}
                            placeholder="0.00"
                            className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.sellingPrice}
                            onChange={(e) => {
                              const updated = [...generatedItems];
                              updated[idx].sellingPrice = e.target.value;
                              if (!updated[idx].mrp || updated[idx].mrp === "0") {
                                updated[idx].mrp = e.target.value;
                              }
                              setGeneratedItems(updated);
                            }}
                            placeholder="0.00"
                            className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={item.mrp || ""}
                            onChange={(e) => {
                              const updated = [...generatedItems];
                              updated[idx].mrp = e.target.value;
                              setGeneratedItems(updated);
                            }}
                            placeholder="0.00"
                            className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition font-mono"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => {
                            const gstDetails = calculateGSTDetails(
                              item.sellingPrice,
                              selectedTaxRateValue,
                              priceIncludesGST
                            );
                            if (!gstDetails) {
                              return <span className="text-xs text-gray-400 font-mono">—</span>;
                            }
                            return priceIncludesGST ? (
                              <div className="text-[11px] font-mono space-y-0.5">
                                <div className="text-gray-600">Base: ₹{gstDetails.basePrice}</div>
                                <div className="text-purple-700 font-bold">Total: ₹{gstDetails.finalPrice}</div>
                              </div>
                            ) : (
                              <div className="text-[11px] font-mono space-y-0.5">
                                <div className="text-purple-700 font-bold">Total: ₹{gstDetails.finalPrice}</div>
                                <div className="text-gray-500">GST ({gstDetails.percentage}%): ₹{gstDetails.gstAmount}</div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5">
                          <button 
                            onClick={() => {
                              const confirmDelete = window.confirm(`Are you sure you want to delete "${displayName}"?`);
                              if (confirmDelete) {
                                const updated = generatedItems.filter((_, i) => i !== idx);
                                setGeneratedItems(updated);
                                previousGeneratedItemsRef.current = updated;
                              }
                            }}
                            className="h-7 w-7 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition flex items-center justify-center cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-sm font-medium text-gray-400"
                      >
                        Please enter attributes and options to generate items.
                      </td>
                    </tr>
                  )}
                  </tbody>
                </table>
              </div>
              {!createAttributes && (
                <div className="px-4 py-3 border-t border-[#F0F0F0] bg-white flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setItemRows([
                        ...itemRows,
                        { id: Date.now(), name: "", size: "", sku: "", hsnCode: "", reorderPoint: "", costPrice: "", sellingPrice: "", mrp: "" },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 h-[36px] px-4 rounded-[10px] bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#212121] text-[13px] font-medium transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Row</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 pb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="text-[13px] text-[#7A7A7A]">
              {createAttributes ? `${generatedItems.length} variant(s) generated` : `${itemRows.length} item(s) configured`}
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                to={isEditMode ? `/shoe-sales/item-groups/${id}` : "/shoe-sales/item-groups"}
                className="rf-btn-cancel inline-flex items-center justify-center !h-[40px] !px-5 !text-[13px]"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleSave}
                className="rf-btn-primary inline-flex items-center justify-center !h-[40px] !px-6 !text-[13px]"
              >
                {isEditMode ? "Update Item Group" : "Save Item Group"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manufacturer Modal */}
      {showManufacturerModal && (
        <ManufacturerModal
          onClose={() => {
            setShowManufacturerModal(false);
            setNewManufacturer("");
          }}
          onAdd={async (name) => {
            if (name.trim()) {
              try {
                const currentUser = JSON.parse(localStorage.getItem("rootfinuser")) || {};
                const createdBy = currentUser.username || currentUser.locName || "System";
                
                const response = await fetch(`${API_ROOT}/api/shoe-sales/manufacturers`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: name.trim(),
                    createdBy: createdBy,
                  }),
                });
                
                if (response.ok) {
                  const data = await response.json();
                  const manufacturerName = data.name;
                  setManufacturers((prev) =>
                    prev.includes(manufacturerName) ? prev : [...prev, manufacturerName]
                  );
                  setSelectedManufacturer(manufacturerName);
                  setShowManufacturerModal(false);
                  setNewManufacturer("");
                } else {
                  const errorData = await response.json().catch(() => ({ message: "Failed to create manufacturer" }));
                  alert(errorData.message || "Failed to create manufacturer. Please try again.");
                }
              } catch (error) {
                console.error("Error creating manufacturer:", error);
                alert("Failed to create manufacturer. Please try again.");
              }
            }
          }}
          newManufacturer={newManufacturer}
          setNewManufacturer={setNewManufacturer}
        />
      )}

      {/* Brand Modal */}
      {showBrandModal && (
        <BrandModal
          onClose={() => {
            setShowBrandModal(false);
            setNewBrand("");
          }}
          onAdd={async (name) => {
            if (name.trim()) {
              try {
                const currentUser = JSON.parse(localStorage.getItem("rootfinuser")) || {};
                const createdBy = currentUser.username || currentUser.locName || "System";
                
                const response = await fetch(`${API_ROOT}/api/shoe-sales/brands`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: name.trim(),
                    createdBy: createdBy,
                  }),
                });
                
                if (response.ok) {
                  const data = await response.json();
                  const brandName = data.name;
                  setBrands((prev) =>
                    prev.includes(brandName) ? prev : [...prev, brandName]
                  );
                  setSelectedBrand(brandName);
                  setShowBrandModal(false);
                  setNewBrand("");
                } else {
                  const errorData = await response.json().catch(() => ({ message: "Failed to create brand" }));
                  alert(errorData.message || "Failed to create brand. Please try again.");
                }
              } catch (error) {
                console.error("Error creating brand:", error);
                alert("Failed to create brand. Please try again.");
              }
            }
          }}
          newBrand={newBrand}
          setNewBrand={setNewBrand}
        />
      )}

      {/* Single Item Confirmation Modal */}
      {showSingleItemModal && (
        <SingleItemModal
          onYes={() => {
            switchToManualMode();
            setShowSingleItemModal(false);
          }}
          onNo={() => {
            setShowSingleItemModal(false);
          }}
          onClose={() => {
            setShowSingleItemModal(false);
            setCreateAttributes(true);
          }}
        />
      )}
    </div>
  );
};

const InventoryValuationSelect = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const options = [
    "FIFO (First In First Out)",
    "WAC (Weighted Average Costing)",
    "LIFO (Last In First Out)",
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter((o) => o.toLowerCase().includes(term));
  }, [search]);

  const displayValue = value || "";

  return (
    <div className="relative flex w-full flex-col gap-1.5 text-sm" ref={containerRef}>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <div
        className={`flex h-10 items-center justify-between rounded-xl border px-3.5 text-sm transition ${
          open ? "border-purple-500 ring-2 ring-purple-100" : "border-gray-200 hover:border-gray-300"
        } bg-white text-gray-900 cursor-pointer`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value ? "text-gray-900 font-medium" : "text-gray-400"}>{displayValue || "Select valuation method"}</span>
        <ChevronDown
          size={16}
          className={`ml-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-purple-600" : "rotate-0"}`}
        />
      </div>
      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-2.5 bg-gray-50/50">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className="h-7 w-full border-none text-xs text-gray-900 outline-none placeholder:text-gray-400 bg-transparent"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">No matching results</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value === option;
                return (
                  <div
                    key={option}
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex items-center justify-between px-3.5 py-2 text-xs cursor-pointer transition ${
                      isSelected
                        ? "bg-purple-50 font-bold text-purple-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{option}</span>
                    {isSelected && <Check size={14} className="text-purple-600" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SingleItemModal = ({ onYes, onNo, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-100 bg-white shadow-2xl p-6 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition"
        >
          <X size={18} />
        </button>
        <div>
          <h2 className="mb-6 text-lg font-bold text-gray-900">Do you want to create a single item?</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              onClick={onYes}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-purple-200 bg-purple-50/50 p-6 text-center transition hover:bg-purple-100/70 hover:border-purple-300 cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <ShoppingBag size={20} />
              </div>
              <p className="text-xs font-semibold text-purple-950 leading-relaxed">
                Yes, proceed to create a single standalone item.
              </p>
            </button>
            <button
              onClick={onNo}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-6 text-center transition hover:bg-gray-100 hover:border-gray-300 cursor-pointer shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-800 text-white flex items-center justify-center shadow-xs">
                <ShoppingCart size={20} />
              </div>
              <p className="text-xs font-semibold text-gray-800 leading-relaxed">
                No, continue on this page to create grouped items.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShoeSalesItemGroupCreate;

const FloatingCheckbox = ({ label, defaultChecked = false, checked, onChange }) => (
  <label className="inline-flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 cursor-pointer hover:border-purple-200 hover:bg-purple-50/30 transition select-none shadow-2xs">
    <input
      type="checkbox"
      checked={checked !== undefined ? checked : defaultChecked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:cursor-not-allowed cursor-pointer accent-purple-600"
    />
    {label}
  </label>
);

const UnitSelect = ({ label, placeholder, value, onChange, options = [], required = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter((o) => o.toLowerCase().includes(term));
  }, [options, search]);

  const displayValue = value || "";

  return (
    <div className="relative flex w-full flex-col gap-1.5 text-sm" ref={containerRef}>
      <span className="text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </span>
      <div
        className={`flex h-10 items-center justify-between rounded-xl border px-3.5 text-sm transition ${
          open ? "border-purple-500 ring-2 ring-purple-100" : "border-gray-200 hover:border-gray-300"
        } bg-white text-gray-900 cursor-pointer`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value ? "text-gray-900 font-medium" : "text-gray-400"}>{displayValue || placeholder}</span>
        <ChevronDown
          size={16}
          className={`ml-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-purple-600" : "rotate-0"}`}
        />
      </div>
      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-2.5 bg-gray-50/50">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim() && !filteredOptions.includes(search.trim())) {
                  e.preventDefault();
                  onChange(search.trim());
                  setOpen(false);
                  setSearch("");
                }
              }}
              placeholder="Select or type to add..."
              className="h-7 w-full border-none bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 && search.trim() ? (
              <div
                onClick={() => {
                  onChange(search.trim());
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center px-3.5 py-2.5 text-left text-xs cursor-pointer transition font-bold text-purple-600 hover:bg-purple-50"
              >
                + Add "{search.trim()}"
              </div>
            ) : filteredOptions.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">No matching results</p>
            ) : (
              <>
                {search.trim() && !filteredOptions.includes(search.trim()) && (
                  <div
                    onClick={() => {
                      onChange(search.trim());
                      setOpen(false);
                      setSearch("");
                    }}
                    className="flex w-full items-center px-3.5 py-2.5 text-left text-xs cursor-pointer transition font-bold text-purple-600 hover:bg-purple-50 border-b border-gray-100"
                  >
                    + Add "{search.trim()}"
                  </div>
                )}
                {filteredOptions.map((option) => {
                  const isSelected = value === option;
                  return (
                    <div
                      key={option}
                      onClick={() => {
                        onChange(option);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={`flex w-full items-center px-3.5 py-2 text-left text-xs cursor-pointer transition ${
                        isSelected
                          ? "bg-purple-50 font-bold text-purple-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {option}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ManufacturerSelect = ({ label, placeholder, value, onChange, manufacturers = [], onManageClick }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredManufacturers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return manufacturers;
    }
    return manufacturers.filter((m) => m.toLowerCase().includes(term));
  }, [manufacturers, search]);

  const displayValue = value || "";

  return (
    <div className="relative flex w-full flex-col gap-1.5 text-sm" ref={containerRef}>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <div
        className={`flex h-10 items-center justify-between rounded-xl border px-3.5 text-sm transition ${
          open ? "border-purple-500 ring-2 ring-purple-100" : "border-gray-200 hover:border-gray-300"
        } bg-white text-gray-900 cursor-pointer`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={displayValue ? "text-gray-900 font-medium" : "text-gray-400"}>{displayValue || placeholder}</span>
        <ChevronDown
          size={16}
          className={`ml-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-purple-600" : "rotate-0"}`}
        />
      </div>
      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-2.5 bg-gray-50/50">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search manufacturer..."
              className="h-7 w-full border-none text-xs text-gray-900 outline-none placeholder:text-gray-400 bg-transparent"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredManufacturers.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">No matching results</p>
            ) : (
              filteredManufacturers.map((manufacturer) => {
                const isSelected = value === manufacturer;
                return (
                  <button
                    key={manufacturer}
                    type="button"
                    onClick={() => {
                      onChange(manufacturer);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center px-3.5 py-2 text-left text-xs transition ${
                      isSelected
                        ? "bg-purple-50 font-bold text-purple-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {manufacturer}
                  </button>
                );
              })
            )}
          </div>
          {onManageClick && (
            <div className="border-t border-gray-100 px-3.5 py-2 bg-gray-50/50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManageClick();
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center gap-2 text-xs font-semibold text-purple-600 hover:text-purple-700 transition"
              >
                <Settings size={13} />
                Manage Manufacturers
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ManufacturerModal = ({ onClose, onAdd, newManufacturer, setNewManufacturer }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (newManufacturer.trim()) {
      onAdd(newManufacturer.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50/80 to-white">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Add Manufacturer</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              Manufacturer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newManufacturer}
              onChange={(e) => setNewManufacturer(e.target.value)}
              placeholder="Enter manufacturer name"
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition outline-none"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newManufacturer.trim()}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white transition hover:from-purple-700 hover:to-indigo-700 shadow-sm shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Manufacturer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BrandSelect = ({ label, placeholder, value, onChange, brands = [], onManageClick }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBrands = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return brands;
    }
    return brands.filter((b) => b.toLowerCase().includes(term));
  }, [brands, search]);

  const displayValue = value || "";

  return (
    <div className="relative flex w-full flex-col gap-1.5 text-sm" ref={containerRef}>
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <div
        className={`flex h-10 items-center justify-between rounded-xl border px-3.5 text-sm transition ${
          open ? "border-purple-500 ring-2 ring-purple-100" : "border-gray-200 hover:border-gray-300"
        } bg-white text-gray-900 cursor-pointer`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={displayValue ? "text-gray-900 font-medium" : "text-gray-400"}>{displayValue || placeholder}</span>
        <ChevronDown
          size={16}
          className={`ml-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-purple-600" : "rotate-0"}`}
        />
      </div>
      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-2.5 bg-gray-50/50">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search brand..."
              className="h-7 w-full border-none bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredBrands.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">No matching results</p>
            ) : (
              filteredBrands.map((brand) => {
                const isSelected = value === brand;
                return (
                  <div
                    key={brand}
                    onClick={() => {
                      onChange(brand);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center px-3.5 py-2 text-left text-xs cursor-pointer transition ${
                      isSelected
                        ? "bg-purple-50 font-bold text-purple-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {brand}
                  </div>
                );
              })
            )}
          </div>
          {onManageClick && (
            <div className="border-t border-gray-100 px-3.5 py-2 bg-gray-50/50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManageClick();
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center gap-2 text-xs font-semibold text-purple-600 hover:text-purple-700 transition"
              >
                <Settings size={13} />
                Manage Brands
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BrandModal = ({ onClose, onAdd, newBrand, setNewBrand }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (newBrand.trim()) {
      onAdd(newBrand.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50/80 to-white">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Add Brand</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              Brand Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Enter brand name"
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition outline-none"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newBrand.trim()}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white transition hover:from-purple-700 hover:to-indigo-700 shadow-sm shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Brand
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TaxRateSelect = ({ label, value, onChange, type }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const taxRateOptions = type === "intra" 
    ? [
        "GST0 [0%]",
        "GST5 [5%]",
        "GST12 [12%]",
        "GST18 [18%]",
        "GST28 [28%]",
      ]
    : [
        "IGST0 [0%]",
        "IGST5 [5%]",
        "IGST12 [12%]",
        "IGST18 [18%]",
        "IGST28 [28%]",
      ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return taxRateOptions;
    }
    return taxRateOptions.filter((o) => o.toLowerCase().includes(term));
  }, [search, taxRateOptions]);

  const displayValue = value || "";

  return (
    <div className="relative flex w-full flex-col gap-1.5 text-sm" ref={containerRef}>
      <label className="text-xs font-semibold text-gray-700">
        {label}
      </label>
      <div
        className={`flex h-10 items-center justify-between rounded-xl border px-3.5 text-sm transition ${
          open ? "border-purple-500 ring-2 ring-purple-100" : "border-gray-200 hover:border-gray-300"
        } bg-white text-gray-900 cursor-pointer`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value ? "text-gray-900 font-medium" : "text-gray-400"}>
          {displayValue || "Select tax rate"}
        </span>
        <ChevronDown
          size={16}
          className={`ml-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180 text-purple-600" : "rotate-0"}`}
        />
      </div>
      {open && (
        <div className="absolute top-full z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-2.5 bg-gray-50/50">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tax rate..."
              className="h-7 w-full border-none bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-400"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">No matching results</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value === option;
                return (
                  <div
                    key={option}
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex items-center justify-between px-3.5 py-2 text-xs cursor-pointer transition ${
                      isSelected
                        ? "bg-purple-50 font-bold text-purple-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{option}</span>
                    {isSelected && <Check size={14} className="text-purple-600" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};