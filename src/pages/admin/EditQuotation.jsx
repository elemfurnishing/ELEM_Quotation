/**
 * EditQuotation Modal Component
 * 
 * A dedicated modal for editing existing quotations.
 */

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
    ArrowLeft, User, Phone, MapPin, Briefcase, Building2, Hash,
    Plus, Trash2, Camera, Upload, X, Save, Loader2, Package,
    IndianRupee, Percent, CheckCircle, Image as ImageIcon, Search, Edit
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { generateQuotationPDFBlob } from '../../utils/generateQuotationPDF';

const API_URL = import.meta.env.VITE_SHEET_API_URL;
const QUOTATION_SHEET = import.meta.env.VITE_SHEET_QUOTATIONS;
const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

// Inventory API for product search
const INVENTORY_API_URL = import.meta.env.VITE_INVENTORY_API_UPI;
const INVENTORY_SHEET_NAME = import.meta.env.VITE_SHEET_INVENTORY;

// Helper function to convert Google Drive URLs to displayable thumbnail format (matches Inventory component)
const getDisplayableImageUrl = (url) => {
    if (!url || typeof url !== 'string') return null;

    // If it's already a direct image URL, return as-is
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    try {
        // Match /file/d/FILE_ID format
        const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (directMatch && directMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${directMatch[1]}&sz=w400`;
        }

        // Match ?id=FILE_ID or &id=FILE_ID format
        const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (ucMatch && ucMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w400`;
        }

        // Match open?id=FILE_ID format
        const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
        if (openMatch && openMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w400`;
        }

        // Already a thumbnail URL
        if (url.includes("thumbnail?id=")) {
            return url;
        }

        // Try to extract any long alphanumeric ID (likely a Drive file ID)
        const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
        if (anyIdMatch && anyIdMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w400`;
        }

        // Return original URL with cache buster as fallback
        const cacheBuster = Date.now();
        return url.includes("?") ? `${url}&cb=${cacheBuster}` : `${url}?cb=${cacheBuster}`;
    } catch (e) {
        console.error("Error processing image URL:", url, e);
        return url;
    }
};

const EditQuotation = ({ isOpen, onClose, initialData, onSuccess }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        customerId: '',
        customerName: '',
        phone: '',
        email: '',
        address: '',
        employeeCode: user?.employeeCode || user?.userId || '',
        architectCode: '',
        architectName: '',
        architectNumber: '',
        expectedDeliveryDate: ''
    });

    // Items State
    const [items, setItems] = useState([]);
    const [currentItem, setCurrentItem] = useState({
        serialNumber: '',
        title: '',
        image: null,
        imagePreview: null,
        qty: 1,
        price: '',
        discount: 0,
        modelNo: '',
        size: '',
        color: '',
        specification: '',
        remarks: ''
    });
    const [editingItemIndex, setEditingItemIndex] = useState(null);

    // UI State
    const [loading, setLoading] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [popupPhase, setPopupPhase] = useState("loading");
    const [successMessage, setSuccessMessage] = useState("");
    const [deletedItems, setDeletedItems] = useState([]);
    const [editingRowIndex, setEditingRowIndex] = useState(null);
    const [tempRowData, setTempRowData] = useState(null);
    const [showArchitectInfo, setShowArchitectInfo] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [availableQty, setAvailableQty] = useState(null);
    const [inventoryData, setInventoryData] = useState([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [inventoryReady, setInventoryReady] = useState(false);

    // Global cache reference to avoid refetching
    const inventoryCacheRef = useRef(null);

    // Initialize Data
    useEffect(() => {
        if (initialData) {
            setFormData({
                customerId: initialData.customer?.id || '',
                customerName: initialData.customer?.name || '',
                phone: initialData.customer?.phone || '',
                email: initialData.customer?.email || '',
                address: initialData.address || '',  // Column Y
                employeeCode: initialData.employeeCode || user?.employeeCode || '',
                architectCode: initialData.architect?.code || '',
                architectName: initialData.architect?.name || '',
                architectNumber: initialData.architect?.number || '',
                expectedDeliveryDate: initialData.expectedDeliveryDate || ''  // Column Z
            });
            setShowArchitectInfo(!!initialData.architect?.code);

            setDeletedItems([]);
            if (initialData.items && Array.isArray(initialData.items)) {
                setItems(initialData.items.map(item => ({
                    ...item,
                    id: item.id || Date.now() + Math.random(),
                    rowIndex: item.rowIndex,        // Preserve rowIndex for updates
                    itemNo: item.itemNo,
                    serialNumber: item.serialNumber || '',
                    modelNo: item.modelNo || '',
                    size: item.size || '',
                    color: item.color || '',
                    specification: item.specification || '',
                    remarks: item.remarks || '',
                    qty: parseFloat(item.qty) || 1,
                    price: parseFloat(item.price) || 0,
                    discount: parseFloat(item.discount) || 0
                })));
            }
        }
    }, [initialData, user?.employeeCode]);

    // FAST: Pre-load inventory data - uses cache for instant access
    useEffect(() => {
        if (isOpen) {
            // If we have cached data, use it immediately (INSTANT!)
            if (inventoryCacheRef.current && inventoryCacheRef.current.length > 0) {
                setInventoryData(inventoryCacheRef.current);
                setInventoryReady(true);
                setLoadingInventory(false);
                return;
            }

            // Otherwise, fetch data
            if (inventoryData.length === 0 && !loadingInventory) {
                const loadInventory = async () => {
                    setLoadingInventory(true);
                    try {
                        const response = await fetch(`${INVENTORY_API_URL}?sheet=${INVENTORY_SHEET_NAME}&action=getData`);
                        if (response.ok) {
                            const result = await response.json();
                            const data = result.data || result;
                            if (data && Array.isArray(data)) {
                                // Skip header row if present
                                const rows = data.length > 0 && (data[0][0] === 'Timestamp' || data[0][1] === 'Serial Number') ?
                                    data.slice(1) : data;
                                // Cache the data for future use
                                inventoryCacheRef.current = rows;
                                setInventoryData(rows);
                                setInventoryReady(true);
                                console.log('Inventory loaded:', rows.length, 'items');
                            }
                        }
                    } catch (error) {
                        console.error('Error loading inventory:', error);
                    } finally {
                        setLoadingInventory(false);
                    }
                };
                loadInventory();
            }
        }
    }, [isOpen]);

    // Clear search and reset available qty
    const clearSearch = () => {
        setSearchTerm('');
        setAvailableQty(null);
    };

    const removeItem = (index) => {
        setItems(prev => {
            const itemToRemove = prev[index];
            // Track deleted items with their rowIndex for proper deletion
            if (itemToRemove && (itemToRemove.rowIndex || itemToRemove.itemNo)) {
                setDeletedItems(d => [...d, {
                    serialNo: initialData?.serialNo,
                    itemNo: itemToRemove.itemNo,
                    rowIndex: itemToRemove.rowIndex  // Include rowIndex for deletion
                }]);
            }
            return prev.filter((_, i) => i !== index);
        });
        showToast('Item removed', 'success');
    };

    const calculateItemTotal = (item) => {
        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        const discount = parseFloat(item.discount) || 0;
        const subtotal = qty * price;
        const discountAmount = (subtotal * discount) / 100;
        return subtotal - discountAmount;
    };

    const calculateGrandTotal = () => {
        return items.reduce((total, item) => total + calculateItemTotal(item), 0);
    };

    const handleSave = async () => {
        if (items.length === 0) {
            showToast('Please add at least one item', 'error');
            return;
        }

        try {
            setLoading(true);
            setPopupPhase("loading");
            setShowSuccessPopup(true);

            // Get Serial Number
            const serialNo = initialData?.serialNo;
            if (!serialNo) {
                showToast("Error: Missing Serial Number", "error");
                setLoading(false);
                setShowSuccessPopup(false);
                return;
            }

            setSuccessMessage("Processing Files & Deletions...");

            // -- Definition of Tasks --

            // Task A: Helper to Upload Image
            const uploadImage = async (item) => {
                // Return existing URL if image is a string (and not base64 data uri which acts as preview)
                if (typeof item.image === 'string' && !item.image.startsWith('data:')) return item.image;

                if (!item.image || !(item.image instanceof File)) return item.imagePreview || '';
                try {
                    const reader = new FileReader();
                    const base64Promise = new Promise((resolve, reject) => {
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(item.image);
                    });
                    const base64Data = await base64Promise;

                    const uploadRes = await fetch(API_URL, {
                        method: 'POST',
                        body: new URLSearchParams({
                            action: 'uploadFile',
                            folderId: FOLDER_ID,
                            fileName: item.title + "_" + Date.now(),
                            base64Data: base64Data,
                            mimeType: item.image.type
                        })
                    });

                    if (uploadRes.ok) {
                        const json = await uploadRes.json();
                        return json.fileUrl || '';
                    }
                } catch (e) { console.error(e); }
                return '';
            };

            // Task B: Generate & Upload PDF (Detached)
            const processPdfTask = async () => {
                try {
                    const pdfData = {
                        serialNo: serialNo,
                        date: initialData.date || new Date().toISOString(),
                        customer: {
                            name: formData.customerName,
                            phone: formData.phone,
                            email: formData.email,
                            address: formData.address
                        },
                        items: items.map((item, index) => ({
                            ...item,
                            itemNo: index + 1
                        })),
                        totalAmount: calculateGrandTotal()
                    };

                    const pdfBlob = await generateQuotationPDFBlob(pdfData);

                    if (pdfBlob) {
                        const pdfBase64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(pdfBlob);
                        });

                        const pdfUploadRes = await fetch(API_URL, {
                            method: 'POST',
                            body: new URLSearchParams({
                                action: 'uploadFile',
                                folderId: "1rnVD3yOXN9QhL3DFK_vMs9BEN-UKHQ_V",
                                fileName: `Quotation_${serialNo}_${Date.now()}.pdf`,
                                base64Data: pdfBase64,
                                mimeType: 'application/pdf'
                            })
                        });

                        if (pdfUploadRes.ok) {
                            const json = await pdfUploadRes.json();
                            const newPdfLink = json.fileUrl || '';
                            console.log("Background PDF Updated, Link:", newPdfLink);

                            // Background Step: Update the Last Item's PDF Link in Sheet
                            if (newPdfLink) {
                                const totalCount = items.length; // Uses state closure
                                const lastItemNo = totalCount; // Sequential 1..N
                                const lastItemIndex = totalCount - 1;
                                const lastItem = items[lastItemIndex];

                                // Re-construct row data for the last item with the new link
                                // Note: We need imageUrl for the last item. 
                                // We can fetch it or re-upload? No.
                                // It was computed in the main thread (imageUrls).
                                // We need access to 'imageUrls'.
                                // Since processPdfTask is defined BEFORE imageUrls, we can't access it unless we pass it or move definition.
                                // BUT we can also just update Column Q specifically? 
                                // API updateBySerialAndItemNo expects full rowData.
                                // So we need full row.
                                // We can use 'updateRowInSheet' helper if we create one.
                                // OR simpler: Just invoke the update logic here using the data we have.
                            }
                            return newPdfLink;
                        }
                    }
                } catch (pdfErr) {
                    console.error("Error updating PDF:", pdfErr);
                }
                return '';
            };

            // Task C: Delete Items
            const processDeleteTask = async () => {
                if (deletedItems.length > 0) {
                    await Promise.all(deletedItems.map(deletedItem => {
                        if (deletedItem.itemNo) {
                            return fetch(API_URL, {
                                method: 'POST',
                                body: new URLSearchParams({
                                    action: 'deleteBySerialAndItemNo',
                                    sheetName: QUOTATION_SHEET,
                                    serialNo: serialNo,
                                    itemNo: String(deletedItem.itemNo)
                                })
                            }).catch(err => console.error("Delete failed", err));
                        }
                        return Promise.resolve();
                    }));
                }
            };

            // -- Execution --
            // 1. Start PDF Gen (Promise) but DO NOT AWAIT it yet
            // actually, we need 'imageUrls' to construct the final update row.
            // So we can start PDF Blob generation, but the "Update Sheet" part must happen after we know image URLs?
            // Yes. 
            // So: 
            // - Start PDF Blob Gen.
            // - Await Images & Deletes.
            // - Save to Sheet (with empty/old link).
            // - Show Success.
            // - Await PDF Blob.
            // - Upload PDF.
            // - Update Sheet Last Row (using known imageUrls).

            // Start Image Uploads & Deletes
            const [imageUrls] = await Promise.all([
                Promise.all(items.map(item => uploadImage(item))),
                processDeleteTask()
            ]);

            // Start PDF Generation (optimistic)
            const pdfGenPromise = (async () => {
                try {
                    const pdfData = {
                        serialNo: serialNo,
                        date: initialData.date || new Date().toISOString(),
                        customer: {
                            name: formData.customerName,
                            phone: formData.phone,
                            email: formData.email,
                            address: formData.address
                        },
                        items: items.map((item, index) => ({
                            ...item,
                            itemNo: index + 1
                        })),
                        totalAmount: calculateGrandTotal()
                    };
                    return await generateQuotationPDFBlob(pdfData);
                } catch (e) { console.error(e); return null; }
            })();

            // Initialize pdfLink as empty for the immediate save (will be updated in background)
            const pdfLink = '';

            // STEP 3: Update existing items (Link is empty for now)
            setSuccessMessage("Updating items...");
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const existingItems = items.filter(item => item.itemNo);
            const newItems = items.filter(item => !item.itemNo);
            const totalItemsCount = items.length;

            if (existingItems.length > 0) {
                const itemNoMappings = existingItems.map((item, index) => ({
                    oldItemNo: item.itemNo,
                    newItemNo: index + 1  // New sequential number
                }));

                // Update item numbers logic first
                await fetch(API_URL, {
                    method: 'POST',
                    body: new URLSearchParams({
                        action: 'updateItemNosForSerial',
                        sheetName: QUOTATION_SHEET,
                        serialNo: serialNo,
                        itemNoMappings: JSON.stringify(itemNoMappings)
                    })
                });

                // Prepare all update promises
                const updateTasks = existingItems.map((item, i) => {
                    return async () => {
                        const imageUrl = imageUrls[items.indexOf(item)];
                        const newItemNo = i + 1;
                        const isLastItem = newItemNo === totalItemsCount;

                        const rowData = [
                            timestamp,                                      // A: Timestamp
                            serialNo,                                       // B: Serial No
                            formData.employeeCode,                          // C: Employee Code
                            formData.customerId,                            // D: Customer ID
                            formData.customerName,                          // E: Customer Name
                            formData.phone,                                 // F: Phone Number
                            formData.email,                                 // G: Email
                            item.title,                                     // H: Product Name
                            imageUrl,                                       // I: Product Image
                            item.qty,                                       // J: Qty
                            item.price,                                     // K: Price
                            item.discount,                                  // L: Discount
                            calculateItemTotal(item).toFixed(2),            // M: Subtotal
                            formData.architectCode,                         // N: Architect Code
                            formData.architectName,                         // O: Architect Name
                            formData.architectNumber,                       // P: Architect Number
                            isLastItem ? pdfLink : '',                      // Q: Quotation Link (Empty initially)
                            newItemNo,                                      // R: Item No (New Sequential)
                            item.serialNumber || '',                        // S: Inventory Serial Number
                            item.modelNo || '',                             // T: Model No
                            item.size || '',                                // U: Size
                            item.color || '',                               // V: Color
                            item.specification || '',                       // W: Specification
                            item.color || '',                               // V: Color
                            item.specification || '',                       // W: Specification
                            item.remarks || '',                             // X: Remarks
                            item.make || '',                                // AA: Make (Brand)
                            formData.address || '',                         // Y: Client Address
                            formData.expectedDeliveryDate || ''             // Z: Expected Delivery Date
                        ];

                        // Update by matching NEW Item No
                        return fetch(API_URL, {
                            method: 'POST',
                            body: new URLSearchParams({
                                action: 'updateBySerialAndItemNo',
                                sheetName: QUOTATION_SHEET,
                                serialNo: serialNo,
                                itemNo: String(newItemNo),
                                rowData: JSON.stringify(rowData)
                            })
                        });
                    };
                });

                // Execute updates in chunks of 5
                const CHUNK_SIZE = 5;
                for (let i = 0; i < updateTasks.length; i += CHUNK_SIZE) {
                    const chunk = updateTasks.slice(i, i + CHUNK_SIZE);
                    await Promise.all(chunk.map(task => task()));
                }
            }

            // STEP 4: Insert new items
            if (newItems.length > 0) {
                setSuccessMessage("Adding new items...");
                const startItemNo = existingItems.length + 1;

                const newRowsData = newItems.map((item, index) => {
                    const imageUrl = imageUrls[items.indexOf(item)];
                    const currentItemNo = startItemNo + index;
                    const isLastItem = currentItemNo === totalItemsCount;

                    return [
                        timestamp,                                      // A: Timestamp
                        serialNo,                                       // B: Serial No
                        formData.employeeCode,                          // C: Employee Code
                        formData.customerId,                            // D: Customer ID
                        formData.customerName,                          // E: Customer Name
                        formData.phone,                                 // F: Phone Number
                        formData.email,                                 // G: Email
                        item.title,                                     // H: Product Name
                        imageUrl,                                       // I: Product Image
                        item.qty,                                       // J: Qty
                        item.price,                                     // K: Price
                        item.discount,                                  // L: Discount
                        calculateItemTotal(item).toFixed(2),            // M: Subtotal
                        formData.architectCode,                         // N: Architect Code
                        formData.architectName,                         // O: Architect Name
                        formData.architectNumber,                       // P: Architect Number
                        isLastItem ? pdfLink : '',                      // Q: Quotation Link (Empty initially)
                        currentItemNo,                                  // R: Item No (Sequential)
                        item.serialNumber || '',                        // S: Inventory Serial Number
                        item.modelNo || '',                             // T: Model No
                        item.size || '',                                // U: Size
                        item.color || '',                               // V: Color
                        item.specification || '',                       // W: Specification
                        item.color || '',                               // V: Color
                        item.specification || '',                       // W: Specification
                        item.remarks || '',                             // X: Remarks
                        item.make || '',                                // AA: Make (Brand)
                        formData.address || '',                         // Y: Client Address
                        formData.expectedDeliveryDate || ''             // Z: Expected Delivery Date
                    ];
                });

                await fetch(API_URL, {
                    method: 'POST',
                    body: new URLSearchParams({
                        action: 'insertBatch',
                        sheetName: QUOTATION_SHEET,
                        rowsData: JSON.stringify(newRowsData)
                    })
                });
            }

            setPopupPhase("success");
            setSuccessMessage("Data Stored in Sheet. PDF Generating in Background...");

            // Background Task: Process PDF and Update Sheet in parallel with success popup
            (async () => {
                try {
                    console.log("Waiting for PDF Generation...");
                    const pdfBlob = await pdfGenPromise;

                    if (pdfBlob) {
                        const pdfBase64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(pdfBlob);
                        });

                        const pdfUploadRes = await fetch(API_URL, {
                            method: 'POST',
                            body: new URLSearchParams({
                                action: 'uploadFile',
                                folderId: "1rnVD3yOXN9QhL3DFK_vMs9BEN-UKHQ_V",
                                fileName: `Quotation_${serialNo}_${Date.now()}.pdf`,
                                base64Data: pdfBase64,
                                mimeType: 'application/pdf'
                            })
                        });

                        if (pdfUploadRes.ok) {
                            const json = await pdfUploadRes.json();
                            const finalPdfLink = json.fileUrl;
                            console.log("Background PDF Uploaded:", finalPdfLink);

                            if (finalPdfLink) {
                                // Re-construct row data for the LAST item to update Column Q
                                const lastItemIndex = items.length - 1;
                                const lastItem = items[lastItemIndex];
                                const lastItemNo = items.length;
                                const lastItemImageUrl = imageUrls[lastItemIndex]; // We have the images!

                                const lastRowData = [
                                    timestamp, serialNo, formData.employeeCode, formData.customerId,
                                    formData.customerName, formData.phone, formData.email,
                                    lastItem.title, lastItemImageUrl, lastItem.qty, lastItem.price,
                                    lastItem.discount, calculateItemTotal(lastItem).toFixed(2),
                                    formData.architectCode, formData.architectName, formData.architectNumber,
                                    finalPdfLink, // Q: The ACTUAL PDF Link
                                    lastItemNo, lastItem.serialNumber || '', lastItem.modelNo || '',
                                    lastItem.size || '', lastItem.color || '', lastItem.specification || '',
                                    lastItem.remarks || '', formData.address || '', formData.expectedDeliveryDate || ''
                                ];

                                await fetch(API_URL, {
                                    method: 'POST',
                                    body: new URLSearchParams({
                                        action: 'updateBySerialAndItemNo',
                                        sheetName: QUOTATION_SHEET,
                                        serialNo: serialNo,
                                        itemNo: String(lastItemNo),
                                        rowData: JSON.stringify(lastRowData)
                                    })
                                });
                                console.log("Sheet Updated with PDF Link (Background)");
                            }
                        }
                    }
                } catch (bgError) {
                    console.error("Background PDF Task Failed", bgError);
                }
            })();

            setTimeout(() => {
                setShowSuccessPopup(false);
                setLoading(false);
                setSuccessMessage("");
                if (onSuccess) onSuccess();
                onClose();
            }, 5000);

        } catch (error) {
            console.error('Error saving quotation:', error);
            showToast('Failed to save quotation', 'error');
            setShowSuccessPopup(false);
            setLoading(false);
        }
    };

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Product Search Handler - INSTANT search from cached inventory data
    // Searches by Serial Number (Column B) OR Model Number (Column G)
    const handleProductSearch = () => {
        const searchValue = searchTerm.trim();
        if (!searchValue) {
            showToast('Please enter Serial Number or Model Number to search', 'warning');
            return;
        }

        if (loadingInventory) {
            showToast('Inventory is still loading, please wait...', 'info');
            return;
        }

        if (inventoryData.length === 0) {
            showToast('Inventory data not available. Please try again.', 'error');
            return;
        }

        setSearchLoading(true);
        setAvailableQty(null);

        try {
            // INSTANT search from cached inventory data
            // Column mapping (0-indexed):
            // Column B = 1 (Serial No), Column G = 6 (Model No)
            // Column C = 2 (Image), Column D = 3 (Product Name)
            // Column J = 9 (Price), Column O = 14 (Quantity)

            const foundRow = inventoryData.find(row => {
                const rowSerialNo = row[1]?.toString().trim().toLowerCase();
                const rowModelNo = row[6]?.toString().trim().toLowerCase();
                const searchLower = searchValue.toLowerCase();

                // Match by Serial Number OR Model Number
                return rowSerialNo === searchLower || rowModelNo === searchLower;
            });

            if (foundRow) {
                // Extract data from the row
                const rawImageUrl = foundRow[2] || ''; // Column C - Product Image
                const productName = foundRow[3] || ''; // Column D - Product Name
                const make = foundRow[5] || '';        // Column F - Make (Brand)
                const modelNo = foundRow[6] || '';     // Column G - Model No
                const size = foundRow[7] || '';        // Column H - Size
                const color = foundRow[8] || '';       // Column I - Color
                const price = foundRow[9] || '';       // Column J - Price
                const specification = foundRow[10] || ''; // Column K - Specification
                const quantity = foundRow[14] || 0; // Column O - Available Quantity

                // Convert Google Drive URL to displayable format
                const displayableImageUrl = getDisplayableImageUrl(rawImageUrl);

                // Prefill the item form with image, title, and price
                setCurrentItem(prev => ({
                    ...prev,
                    serialNumber: foundRow[1]?.toString() || '',
                    title: productName,
                    price: price.toString(),
                    image: null, // No file, using URL
                    imagePreview: displayableImageUrl, // Converted image URL for display
                    modelNo: modelNo,
                    make: make,
                    size: size,
                    color: color,
                    specification: specification,
                    remarks: ''
                }));

                // Show available quantity (not prefilled, just display)
                setAvailableQty(quantity);

                showToast(`Product found: ${productName}`, 'success');
                setSearchTerm(''); // Clear search field
            } else {
                showToast(`No product found with Serial No or Model No: "${searchValue}"`, 'error');
            }
        } catch (error) {
            console.error('Error searching inventory:', error);
            showToast('Error searching. Please try again.', 'error');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleProductSearch();
        }
    };

    const handleItemChange = (e) => {
        const { name, value } = e.target;
        setCurrentItem(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentItem(prev => ({
                    ...prev,
                    image: file,
                    imagePreview: reader.result
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCameraCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentItem(prev => ({
                    ...prev,
                    image: file,
                    imagePreview: reader.result
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const removeCurrentImage = () => {
        setCurrentItem(prev => ({
            ...prev,
            image: null,
            imagePreview: null
        }));
    };

    const addItem = () => {
        if (!currentItem.title) {
            showToast('Please enter item title', 'error');
            return;
        }
        if (!currentItem.price || parseFloat(currentItem.price) <= 0) {
            showToast('Please enter valid price', 'error');
            return;
        }
        if (items.length >= 100) {
            showToast('Maximum 100 items allowed', 'error');
            return;
        }

        const newItem = {
            id: Date.now(),
            title: currentItem.title,
            image: currentItem.image,
            imagePreview: currentItem.imagePreview,
            qty: parseInt(currentItem.qty) || 1,
            price: parseFloat(currentItem.price) || 0,
            discount: parseFloat(currentItem.discount) || 0,
            serialNumber: currentItem.serialNumber,
            modelNo: currentItem.modelNo,
            size: currentItem.size,
            color: currentItem.color,
            specification: currentItem.specification,
            remarks: currentItem.remarks
        };

        setItems(prev => [...prev, newItem]);
        showToast('Item added successfully', 'success');

        setCurrentItem({
            title: '',
            image: null,
            imagePreview: null,
            qty: 1,
            price: '',
            discount: 0,
            serialNumber: '',
            modelNo: '',
            size: '',
            color: '',
            specification: '',
            remarks: ''
        });
        setAvailableQty(null); // Clear available qty display
    };

    const startInlineEdit = (index, item) => {
        setEditingRowIndex(index);
        setTempRowData({ ...item });
    };

    const cancelInlineEdit = () => {
        setEditingRowIndex(null);
        setTempRowData(null);
    };

    const saveInlineEdit = () => {
        if (!tempRowData.title) {
            showToast('Title cannot be empty', 'error');
            return;
        }
        if (parseFloat(tempRowData.price) < 0) {
            showToast('Price cannot be negative', 'error');
            return;
        }

        setItems(prev => {
            const updated = [...prev];
            if (editingRowIndex >= 0 && editingRowIndex < updated.length) {
                updated[editingRowIndex] = {
                    ...updated[editingRowIndex],
                    ...tempRowData,
                    qty: parseFloat(tempRowData.qty) || 1,
                    price: parseFloat(tempRowData.price) || 0,
                    discount: parseFloat(tempRowData.discount) || 0,
                    modelNo: tempRowData.modelNo,
                    size: tempRowData.size,
                    color: tempRowData.color,
                    specification: tempRowData.specification,
                    remarks: tempRowData.remarks
                };
            }
            return updated;
        });

        showToast('Item updated', 'success');
        setEditingRowIndex(null);
        setTempRowData(null);
    };

    const handleInlineChange = (e) => {
        const { name, value } = e.target;
        setTempRowData(prev => ({ ...prev, [name]: value }));
    };

    const handleCancel = () => {
        onClose();
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-8 bg-black/60 backdrop-blur-md animate-fade-in touch-none">
            <div className="bg-white w-full max-w-2xl h-full sm:h-auto sm:max-h-[88vh] rounded-none sm:rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 bg-[#052e25] text-white shadow-md">
                    <div className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-bold">
                                Edit Quotation ({initialData?.serialNo})
                            </h1>
                            <p className="text-xs text-green-200 truncate">Customer: {formData.customerName || 'Unknown'}</p>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                            disabled={loading}
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="p-4 space-y-4">

                        {/* Customer Info */}
                        <div className="flex flex-col gap-4">
                            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border-2 border-green-200 p-3 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
                                        <User size={16} className="text-white" />
                                    </div>
                                    <h2 className="text-sm font-semibold text-gray-800">Customer Information</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-gray-500 font-medium">ID:</span>
                                        <p className="font-mono text-gray-900 font-semibold mt-0.5">{formData.customerId}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 font-medium">Name:</span>
                                        <p className="text-gray-900 font-semibold mt-0.5 truncate">{formData.customerName}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 font-medium">Phone:</span>
                                        <p className="text-gray-900 font-semibold mt-0.5">{formData.phone}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 font-medium">Employee:</span>
                                        <p className="text-gray-900 font-mono font-semibold mt-0.5 text-[10px]">{formData.employeeCode}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500 font-medium">Address:</span>
                                        <p className="text-gray-900 font-semibold mt-0.5 truncate">{formData.address || 'No address provided'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Architect Info */}
                            <div className={`bg-white rounded-xl border-2 transition-all duration-300 overflow-hidden ${showArchitectInfo ? 'border-blue-400 shadow-md' : 'border-gray-200'}`}>
                                <div className="p-4 flex items-center gap-3 bg-gray-50/50">
                                    <input
                                        type="checkbox"
                                        checked={showArchitectInfo}
                                        onChange={(e) => setShowArchitectInfo(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        id="architect-toggle"
                                    />
                                    <label htmlFor="architect-toggle" className="flex items-center gap-2 cursor-pointer select-none flex-1">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showArchitectInfo ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                            <Building2 size={18} className={showArchitectInfo ? 'text-white' : 'text-gray-500'} />
                                        </div>
                                        <div>
                                            <h2 className={`text-sm font-bold transition-colors ${showArchitectInfo ? 'text-blue-800' : 'text-gray-600'}`}>Architect Information</h2>
                                            <p className="text-[10px] text-gray-400 font-medium">Check to add architect details</p>
                                        </div>
                                    </label>
                                </div>

                                {showArchitectInfo && (
                                    <div className="p-4 pt-0 animate-fade-in">
                                        <div className="grid grid-cols-12 gap-3 mt-2">
                                            <div className="col-span-3">
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Code</label>
                                                <input
                                                    type="text"
                                                    name="architectCode"
                                                    value={formData.architectCode}
                                                    onChange={handleInputChange}
                                                    placeholder="Code"
                                                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none bg-white transition-all font-semibold text-gray-700 placeholder:text-gray-400"
                                                />
                                            </div>
                                            <div className="col-span-5">
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Name</label>
                                                <input
                                                    type="text"
                                                    name="architectName"
                                                    value={formData.architectName}
                                                    onChange={handleInputChange}
                                                    placeholder="Enter Architect Name"
                                                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none bg-white transition-all font-medium text-gray-700 placeholder:text-gray-400"
                                                />
                                            </div>
                                            <div className="col-span-4">
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Phone</label>
                                                <input
                                                    type="tel"
                                                    name="architectNumber"
                                                    value={formData.architectNumber}
                                                    onChange={handleInputChange}
                                                    placeholder="Phone Number"
                                                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none bg-white transition-all font-semibold text-gray-700 placeholder:text-gray-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Address Field */}
                            <div className="bg-white rounded-xl border-2 border-gray-200 p-4 shadow-sm">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Client Address</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    placeholder="Enter client address"
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none bg-white transition-all font-medium text-gray-700"
                                />
                            </div>

                            {/* Expected Delivery Date */}
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200 p-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                            <line x1="16" x2="16" y1="2" y2="6" />
                                            <line x1="8" x2="8" y1="2" y2="6" />
                                            <line x1="3" x2="21" y1="10" y2="10" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-purple-800 mb-1">Expected Delivery Date</label>
                                        <input
                                            type="date"
                                            name="expectedDeliveryDate"
                                            value={formData.expectedDeliveryDate}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none bg-white transition-all font-semibold text-gray-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Add Items Section */}
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-300 shadow-sm transition-all p-3">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="bg-orange-600 rounded-lg flex items-center justify-center w-7 h-7">
                                        <Package size={16} className="text-white" />
                                    </div>
                                    <h2 className="text-sm font-semibold text-gray-800 hidden sm:block">Add New Item</h2>
                                </div>
                                {/* Flexible Search Field */}
                                <div className="relative flex-1 min-w-[140px]">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Serial No or Model No..."
                                        disabled={searchLoading}
                                        className="w-full pl-8 pr-24 py-1.5 text-sm border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white font-medium placeholder:text-orange-300 transition-all disabled:bg-gray-100"
                                    />
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-orange-400" size={14} />

                                    {/* Clear & Search Buttons */}
                                    <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                                        {/* Clear Button */}
                                        {searchTerm && (
                                            <button
                                                onClick={clearSearch}
                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Clear search"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                        {/* Search Button */}
                                        <button
                                            onClick={handleProductSearch}
                                            disabled={!searchTerm.trim() || searchLoading || loadingInventory}
                                            className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        >
                                            {searchLoading ? (
                                                <>
                                                    <Loader2 size={10} className="animate-spin" />
                                                    <span>...</span>
                                                </>
                                            ) : loadingInventory ? (
                                                <>
                                                    <Loader2 size={10} className="animate-spin" />
                                                    <span>Wait</span>
                                                </>
                                            ) : (
                                                'Search'
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Loading Inventory Badge */}
                                {loadingInventory && (
                                    <span className="shrink-0 text-[10px] font-semibold text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5 border border-yellow-300 flex items-center gap-1">
                                        <Loader2 size={10} className="animate-spin" />
                                        Loading...
                                    </span>
                                )}

                                {/* Inventory Ready Badge */}
                                {!loadingInventory && inventoryData.length > 0 && (
                                    <span className="shrink-0 text-[10px] font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5 border border-green-200">
                                        ✓ {inventoryData.length} items
                                    </span>
                                )}

                                {/* Available Qty Badge */}
                                {availableQty !== null && (
                                    <span className="shrink-0 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2 py-1 border border-blue-300">
                                        Avail: {availableQty}
                                    </span>
                                )}

                                <span className="shrink-0 text-xs font-semibold text-orange-700 bg-orange-200 rounded-full px-3 py-1">
                                    {items.length}/100
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        name="title"
                                        value={currentItem.title}
                                        onChange={handleItemChange}
                                        placeholder="Item Title"
                                        className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white font-normal"
                                    />
                                    {currentItem.imagePreview ? (
                                        <div className="relative shrink-0">
                                            <img
                                                src={getDisplayableImageUrl(currentItem.imagePreview)}
                                                alt="Preview"
                                                className="object-cover rounded-lg border-2 border-orange-300 w-10 h-10"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                            <button onClick={removeCurrentImage} className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                                                <X size={11} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => fileInputRef.current?.click()} className="text-gray-600 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-orange-400 transition px-3 py-1.5" title="Upload Image">
                                                <Upload size={17} />
                                            </button>
                                            <button onClick={() => cameraInputRef.current?.click()} className="text-gray-600 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-orange-400 transition px-3 py-1.5" title="Take Photo">
                                                <Camera size={17} />
                                            </button>
                                        </div>
                                    )}
                                    {/* Item Serial No - Read Only */}
                                    {currentItem.serialNumber && (
                                        <div className="shrink-0">
                                            <div className="px-3 py-1.5 text-sm bg-blue-50 border-2 border-blue-300 rounded-lg font-semibold text-blue-700 flex items-center gap-1.5">
                                                <span className="text-[9px] text-blue-500 uppercase">S/N:</span>
                                                {currentItem.serialNumber}
                                            </div>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" />
                                </div>

                                {/* New Fields: Model, Size, Color, Specification, Remarks */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5 ml-1">Make</label>
                                        <input
                                            type="text"
                                            name="make"
                                            value={currentItem.make || ''}
                                            onChange={handleItemChange}
                                            placeholder="Brand Name"
                                            className="w-full px-2 py-1.5 text-xs border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5 ml-1">Model No</label>
                                        <input
                                            type="text"
                                            name="modelNo"
                                            value={currentItem.modelNo}
                                            onChange={handleItemChange}
                                            placeholder="Model Number"
                                            className="w-full px-2 py-1.5 text-xs border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5 ml-1">Size</label>
                                        <input
                                            type="text"
                                            name="size"
                                            value={currentItem.size}
                                            onChange={handleItemChange}
                                            placeholder="Size"
                                            className="w-full px-2 py-1.5 text-xs border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5 ml-1">Color</label>
                                        <input
                                            type="text"
                                            name="color"
                                            value={currentItem.color}
                                            onChange={handleItemChange}
                                            placeholder="Color"
                                            className="w-full px-2 py-1.5 text-xs border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5 ml-1">Remarks</label>
                                        <input
                                            type="text"
                                            name="remarks"
                                            value={currentItem.remarks}
                                            onChange={handleItemChange}
                                            placeholder="Remarks"
                                            className="w-full px-2 py-1.5 text-xs border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-0.5 ml-1">Specification</label>
                                        <textarea
                                            name="specification"
                                            value={currentItem.specification}
                                            onChange={handleItemChange}
                                            placeholder="Specification details..."
                                            rows="2"
                                            className="w-full px-2 py-1.5 text-xs border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-2.5">
                                    <div className="col-span-2">
                                        <label className="block font-medium text-gray-700 text-[10px] mb-1">Qty</label>
                                        <input
                                            type="number"
                                            name="qty"
                                            value={currentItem.qty}
                                            onChange={handleItemChange}
                                            min="1"
                                            className="w-full px-2.5 py-1.5 text-sm border-2 border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white font-medium"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="block font-medium text-gray-700 text-[10px] mb-1">Price (₹)</label>
                                        <input
                                            type="number"
                                            name="price"
                                            value={currentItem.price}
                                            onChange={handleItemChange}
                                            placeholder="0"
                                            min="0"
                                            className="w-full px-2.5 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white font-medium"
                                        />
                                        {currentItem.price && currentItem.discount > 0 && (
                                            <p className="text-[10px] text-green-600 font-bold mt-1 text-right">
                                                Net: ₹{(parseFloat(currentItem.price) * (1 - parseFloat(currentItem.discount) / 100)).toFixed(1)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block font-medium text-gray-700 text-[10px] mb-1">Disc (%)</label>
                                        <input
                                            type="number"
                                            name="discount"
                                            value={currentItem.discount || ''}
                                            onChange={handleItemChange}
                                            placeholder="0"
                                            min="0"
                                            max="100"
                                            className="w-full px-2.5 py-1.5 text-sm border-2 border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none bg-white font-semibold"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block font-bold text-gray-700 text-[10px] mb-1">&nbsp;</label>
                                        <button
                                            onClick={addItem}
                                            disabled={items.length >= 100}
                                            className="w-full font-semibold text-white rounded-lg hover:opacity-90 active:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-md py-2 text-xs bg-orange-600 hover:bg-orange-700"
                                        >
                                            <Plus size={16} />
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="bg-white rounded-xl border-2 border-gray-300 overflow-hidden shadow-md">
                            <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-5 py-4 border-b-2 border-gray-300">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2.5">
                                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                                            <Package size={18} className="text-white" />
                                        </div>
                                        Added Items
                                    </h2>
                                    <span className="bg-green-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">
                                        {items.length} {items.length === 1 ? 'Item' : 'Items'}
                                    </span>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {items.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        <Package size={48} className="mx-auto mb-3 text-gray-300 opacity-50" />
                                        <p className="text-sm font-medium">No items added yet</p>
                                        <p className="text-xs text-gray-400 mt-1">Add items using the form above</p>
                                    </div>
                                ) : (
                                    items.map((item, index) => {
                                        const isEditing = editingRowIndex === index;
                                        return (
                                            <div key={item.id} className={`p-3 sm:p-4 transition-all ${isEditing ? 'bg-amber-50 border-l-4 border-amber-400' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>
                                                {isEditing ? (
                                                    /* ===== EDIT MODE ===== */
                                                    <div className="space-y-3">
                                                        {/* Product Name with Item Serial No Badge */}
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1">
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Product Name</label>
                                                                <input
                                                                    type="text"
                                                                    name="title"
                                                                    value={tempRowData.title}
                                                                    onChange={handleInlineChange}
                                                                    className="w-full px-3 py-2.5 text-sm border-2 border-amber-300 rounded-lg font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                                                                />
                                                            </div>
                                                            {tempRowData.serialNumber && (
                                                                <div className="shrink-0">
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Item Serial No</label>
                                                                    <div className="px-3 py-2.5 text-sm bg-blue-50 border-2 border-blue-300 rounded-lg font-semibold text-blue-700">
                                                                        {tempRowData.serialNumber}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* New Fields Grid */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Make</label>
                                                                <input
                                                                    type="text"
                                                                    name="make"
                                                                    value={tempRowData.make || ''}
                                                                    onChange={handleInlineChange}
                                                                    placeholder="Brand"
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Model No</label>
                                                                <input
                                                                    type="text"
                                                                    name="modelNo"
                                                                    value={tempRowData.modelNo || ''}
                                                                    onChange={handleInlineChange}
                                                                    placeholder="Model No"
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Size</label>
                                                                <input
                                                                    type="text"
                                                                    name="size"
                                                                    value={tempRowData.size || ''}
                                                                    onChange={handleInlineChange}
                                                                    placeholder="Size"
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Color</label>
                                                                <input
                                                                    type="text"
                                                                    name="color"
                                                                    value={tempRowData.color || ''}
                                                                    onChange={handleInlineChange}
                                                                    placeholder="Color"
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Remarks</label>
                                                                <input
                                                                    type="text"
                                                                    name="remarks"
                                                                    value={tempRowData.remarks || ''}
                                                                    onChange={handleInlineChange}
                                                                    placeholder="Remarks"
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Specification</label>
                                                                <textarea
                                                                    name="specification"
                                                                    value={tempRowData.specification || ''}
                                                                    onChange={handleInlineChange}
                                                                    placeholder="Specification"
                                                                    rows="2"
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Qty, Price, Disc - 3 columns */}
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Qty</label>
                                                                <input
                                                                    type="number"
                                                                    name="qty"
                                                                    value={tempRowData.qty}
                                                                    onChange={handleInlineChange}
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg font-bold text-center bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Price</label>
                                                                <input
                                                                    type="number"
                                                                    name="price"
                                                                    value={tempRowData.price}
                                                                    onChange={handleInlineChange}
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg font-bold bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Disc %</label>
                                                                <input
                                                                    type="number"
                                                                    name="discount"
                                                                    value={tempRowData.discount}
                                                                    onChange={handleInlineChange}
                                                                    className="w-full px-2 py-2 text-sm border-2 border-amber-300 rounded-lg font-bold text-center bg-white focus:ring-2 focus:ring-amber-200 outline-none"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons - Full width on mobile */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={saveInlineEdit}
                                                                type="button"
                                                                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                                                            >
                                                                <CheckCircle size={16} />
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={cancelInlineEdit}
                                                                type="button"
                                                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm flex items-center justify-center gap-2 border border-gray-300 transition-colors"
                                                            >
                                                                <X size={16} />
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* ===== VIEW MODE ===== */
                                                    <div className="flex items-center gap-3">
                                                        {/* Image */}
                                                        <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center">
                                                            {(() => {
                                                                const displayUrl = getDisplayableImageUrl(item.imagePreview);
                                                                return displayUrl ? (
                                                                    <img
                                                                        src={displayUrl}
                                                                        alt={item.title}
                                                                        className="w-full h-full object-cover"
                                                                        referrerPolicy="no-referrer"
                                                                        onError={(e) => {
                                                                            e.target.style.display = 'none';
                                                                            if (e.target.parentElement) {
                                                                                e.target.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-300"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <ImageIcon size={20} className="text-gray-300" />
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Title & Item No */}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-gray-900 text-sm truncate">{item.title}</h4>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                <span className="text-[10px] text-gray-400 font-medium">#{item.itemNo || 'NEW'}</span>
                                                                {item.serialNumber && (
                                                                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium border border-blue-100">
                                                                        S/N: {item.serialNumber}
                                                                    </span>
                                                                )}
                                                                {/* Mobile: Show inline stats */}
                                                                <span className="sm:hidden text-[10px] text-gray-500">
                                                                    {item.qty} × ₹{parseFloat(item.price).toFixed(0)}
                                                                    {item.discount > 0 && <span className="text-red-500 ml-1">-{item.discount}%</span>}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Desktop Stats */}
                                                        <div className="hidden sm:flex items-center gap-5 text-center">
                                                            <div>
                                                                <p className="text-[10px] text-gray-400 font-medium uppercase">Qty</p>
                                                                <p className="font-bold text-gray-800">{item.qty}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-gray-400 font-medium uppercase">Price</p>
                                                                <p className="font-bold text-gray-800">₹{parseFloat(item.price).toFixed(0)}</p>
                                                            </div>
                                                            {item.discount > 0 && (
                                                                <div>
                                                                    <p className="text-[10px] text-gray-400 font-medium uppercase">Disc</p>
                                                                    <p className="font-bold text-red-500">{item.discount}%</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Total */}
                                                        <div className="text-right shrink-0">
                                                            <p className="text-[10px] text-gray-400 font-medium uppercase hidden sm:block">Total</p>
                                                            <p className="font-bold text-green-600 text-base sm:text-lg">₹{calculateItemTotal(item).toFixed(0)}</p>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex gap-0.5 shrink-0 border-l border-gray-200 pl-2">
                                                            <button
                                                                onClick={() => startInlineEdit(index, item)}
                                                                type="button"
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => removeItem(index)}
                                                                type="button"
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Remove"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Grand Total */}
                        <div className="bg-gradient-to-r from-green-100 via-emerald-100 to-green-100 border-3 border-green-500 rounded-xl p-7 shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold text-green-900 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-md">
                                        <IndianRupee size={24} className="text-white" />
                                    </div>
                                    Grand Total
                                </span>
                                <span className="text-3xl font-bold text-green-700">₹{calculateGrandTotal().toFixed(2)}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex-shrink-0 bg-white border-t-2 border-gray-200 p-3 shadow-lg">
                    <div className="flex gap-4">
                        <button
                            onClick={handleCancel}
                            className="flex-1 px-6 py-2.5 text-base font-semibold text-gray-700 bg-white border-2 border-gray-400 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition shadow-sm"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || items.length === 0}
                            className="flex-[2] flex items-center justify-center gap-3 px-6 py-2.5 text-base font-semibold text-white bg-[#052e25] rounded-xl hover:bg-green-800 active:bg-green-900 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* Success Popup */}
                {showSuccessPopup && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 text-center max-w-sm w-full mx-4 border border-gray-100">
                            {popupPhase === "loading" ? (
                                <div className="flex flex-col items-center">
                                    <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">Processing...</h3>
                                    <p className="text-sm text-gray-500">{successMessage || "Please wait..."}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">Success!</h3>
                                    <p className="text-sm text-gray-500">{successMessage}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >,
        document.body
    );
};

export default EditQuotation;