import React, { useState, useEffect } from 'react';
import {
    Search,
    Edit, Eye, FileText, Trash2,
    Loader2, Phone, Calendar, IndianRupee
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import CreateQuotation from './CreateQuotation';
import EditQuotation from './EditQuotation';
import QuotationPDF from './QuotationPDF';

const Quotations = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [quotations, setQuotations] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingQuotation, setEditingQuotation] = useState(null);
    const [pdfQuotation, setPdfQuotation] = useState(null);

    // API Config
    const API_URL = import.meta.env.VITE_SHEET_API_URL;
    const SHEET_NAME = import.meta.env.VITE_SHEET_QUOTATIONS;

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}?sheet=${SHEET_NAME}&action=getData`);

            if (!response.ok) throw new Error('Failed to fetch data');

            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                processData(result.data);
            } else {
                setQuotations([]);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Failed to load quotations', 'error');
        } finally {
            setLoading(false);
        }
    };

    const processData = (rows) => {
        // Skip header (row 0)
        const dataRows = rows.slice(1);
        const groups = {};

        // Get logged-in user's Employee Code and Role
        const userEmployeeCode = user?.employeeCode || user?.userId || '';
        const userRole = user?.role?.toLowerCase() || '';
        const isAdmin = userRole === 'admin';

        dataRows.forEach((row, dataIndex) => {
            // Basic validation to ensure row has data
            if (!row || row.length < 2 || !row[1]) return;

            const serialNo = row[1]; // Column B: Serial No (Key)
            const rowEmployeeCode = row[2] || ''; // Column C: Employee Code

            // FILTER: Only apply employee code filter for non-admin users
            // Admin can see ALL quotations, regular users only see their own
            if (!isAdmin && userEmployeeCode && rowEmployeeCode.trim().toLowerCase() !== userEmployeeCode.trim().toLowerCase()) {
                return; // Skip this row if Employee Code doesn't match (for non-admin users)
            }

            // Sheet row index: +2 because header is row 1 (1-indexed) and we sliced at 1
            const sheetRowIndex = dataIndex + 2;

            if (!groups[serialNo]) {
                groups[serialNo] = {
                    serialNo: serialNo,
                    date: row[0],                              // Col A: Timestamp
                    employeeCode: row[2],                      // Col C: Employee Code
                    customer: {
                        id: row[3],                              // Col D
                        name: row[4],                            // Col E
                        phone: row[5],                           // Col F
                        email: row[6]                            // Col G
                    },
                    architect: {
                        code: row[13],                           // Col N
                        name: row[14],                           // Col O
                        number: row[15]                          // Col P
                    },
                    items: [],                                 // Store full items
                    itemsCount: 0,
                    totalAmount: 0,
                    status: 'draft',                           // Default status
                    address: row[24] || '',                    // Col Y: Client Address
                    expectedDeliveryDate: row[25] || ''        // Col Z: Expected Delivery Date
                };
            }

            // Aggregate Item Data
            groups[serialNo].itemsCount += 1;

            // Col M (Index 12) is Subtotal. Parse carefully.
            const amount = parseFloat(row[12]);
            if (!isNaN(amount)) {
                groups[serialNo].totalAmount += amount;
            }

            // Capture Item Details for Edit (including rowIndex for updates)
            groups[serialNo].items.push({
                id: Date.now() + Math.random(), // Temporary ID for frontend key
                rowIndex: sheetRowIndex,        // Sheet row index for UPDATE action
                title: row[7],                  // H: Product Name
                imagePreview: row[8],           // I: Image URL
                qty: parseFloat(row[9]) || 1,   // J: Qty
                price: parseFloat(row[10]) || 0,// K: Price
                discount: parseFloat(row[11]) || 0, // L: Discount
                itemNo: parseInt(row[17]) || 0, // R: Item No (Essential for updates)
                serialNumber: row[18] || '',    // S: Serial Number
                modelNo: row[19] || '',         // T: Model No
                size: row[20] || '',            // U: Size
                color: row[21] || '',           // V: Color
                specification: row[22] || '',   // W: Specification
                remarks: row[23] || '',         // X: Remarks
                make: row[26] || ''             // AA: Make (Brand)
            });

            // Capture Client Address from Column Y (Index 24) if available
            // Note: Address is associated with the quotation/customer, but stored per row. 
            // We'll take it from the first row of the group or update it if found.
            if (row[24]) {
                groups[serialNo].customer.address = row[24];
            }
        });

        // Convert to array and sort by Date (Newest first)
        const sortedList = Object.values(groups).sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        setQuotations(sortedList);
    };

    useEffect(() => {
        fetchQuotations();
    }, []);

    // Filter Logic
    const filteredQuotations = quotations.filter(q =>
        q.serialNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customer.phone.includes(searchTerm)
    );

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getInitials = (name) => {
        return name
            ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : '??';
    };

    const getRandomColor = (name) => {
        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const handleEdit = (quotation) => {
        setEditingQuotation(quotation);
    };

    const handleView = (quotation) => {
        setViewingQuotation(quotation);
    };

    const handlePDF = (quotation) => {
        setPdfQuotation(quotation);
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 z-10">
                <div className="px-6 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="hidden sm:block">
                            <h1 className="text-2xl font-bold text-gray-800">Quotations</h1>
                            <p className="text-sm text-gray-500 mt-1">Manage and track your customer quotations</p>
                        </div>

                        {/* Search Bar - Moved to Header */}
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search quotations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>


            {/* Content Table */}
            <div className="flex-1 overflow-hidden relative bg-gray-50 p-4 sm:p-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                            <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-3" />
                            <p className="font-medium animate-pulse">Loading quotations...</p>
                        </div>
                    ) : filteredQuotations.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-gray-600 mb-1">No Quotations Found</h3>
                            <p className="text-sm">Try adjusting your search or create a new one.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table Header */}
                            <div className="hidden lg:grid grid-cols-[1fr_1fr_1.1fr_1.8fr_1.2fr_0.6fr_0.9fr_0.9fr_0.7fr] gap-4 px-6 py-3 bg-[#052e25] border-b border-gray-200 text-xs font-bold text-white uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                <div>Serial No</div>
                                <div>Employee Code</div>
                                <div>Customer ID</div>
                                <div>Customer Name</div>
                                <div>Customer Number</div>
                                <div>Items</div>
                                <div>Amount</div>
                                <div>Date</div>
                                <div className="text-right">Action</div>
                            </div>

                            {/* Scrollable List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/50">
                                <div className="divide-y divide-gray-100">
                                    {filteredQuotations.map((quote) => (
                                        <div key={quote.serialNo} className="group hover:bg-green-50/50 transition-colors">
                                            {/* Desktop Row */}
                                            <div className="hidden lg:grid grid-cols-[1fr_1fr_1.1fr_1.8fr_1.2fr_0.6fr_0.9fr_0.9fr_0.7fr] gap-4 px-6 py-3 items-center">
                                                {/* Serial No */}
                                                <div>
                                                    <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                        {quote.serialNo}
                                                    </span>
                                                </div>

                                                {/* Employee Code */}
                                                <div>
                                                    <span className="font-mono text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                                                        {quote.employeeCode || '-'}
                                                    </span>
                                                </div>

                                                {/* Customer ID */}
                                                <div>
                                                    <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-medium">
                                                        {quote.customer.id || '-'}
                                                    </span>
                                                </div>

                                                {/* Customer Name */}
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full ${getRandomColor(quote.customer.name || '?')} flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0`}>
                                                        {getInitials(quote.customer.name || '?')}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-gray-900 text-sm truncate">{quote.customer.name || 'Unknown'}</p>
                                                    </div>
                                                </div>

                                                {/* Customer Number (With Icon) */}
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Phone size={14} className="text-green-600" />
                                                    <span className="text-xs font-mono">
                                                        {quote.customer.phone || '-'}
                                                    </span>
                                                </div>

                                                {/* Items */}
                                                <div className="text-sm text-gray-600 font-medium pl-2">
                                                    {quote.itemsCount} {quote.itemsCount === 1 ? 'item' : 'items'}
                                                </div>

                                                {/* Amount */}
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                    <IndianRupee size={12} className="text-gray-400" />
                                                    <span className="font-semibold text-gray-700">{formatCurrency(quote.totalAmount).replace('₹', '')}</span>
                                                </div>

                                                {/* Date */}
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                    <Calendar size={14} className="text-green-600" />
                                                    {formatDate(quote.date)}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(quote)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                        <Edit size={16} />
                                                    </button>
                                                    <button onClick={() => handlePDF(quote)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download PDF">
                                                        <FileText size={16} />
                                                    </button>
                                                    <button className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mobile Card Layout */}
                                            <div className="lg:hidden p-4 flex flex-col gap-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full ${getRandomColor(quote.customer.name || '?')} flex items-center justify-center text-white font-bold shadow-sm`}>
                                                            {getInitials(quote.customer.name || '?')}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-900 text-sm">{quote.customer.name}</h4>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{quote.serialNo}</span>
                                                                <span className="text-[10px] text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{quote.employeeCode || '-'}</span>
                                                                <span className="text-[10px] text-green-600 font-mono bg-green-50 px-1.5 py-0.5 rounded border border-green-100">{quote.customer.id || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-y-2 text-sm border-t border-b border-gray-50 py-3 my-1">
                                                    <div>
                                                        <p className="text-xs text-gray-400 mb-0.5">Amount</p>
                                                        <p className="font-bold text-gray-900">{formatCurrency(quote.totalAmount)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-400 mb-0.5">Date</p>
                                                        <p className="font-medium text-gray-700">{formatDate(quote.date)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-400 mb-0.5">Items</p>
                                                        <p className="font-medium text-gray-700">{quote.itemsCount}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 pt-1">
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleEdit(quote)} className="p-2 text-blue-600 bg-blue-50 rounded-lg" title="Edit"><Edit size={16} /></button>
                                                        <button onClick={() => handlePDF(quote)} className="p-2 text-green-600 bg-green-50 rounded-lg" title="PDF"><FileText size={16} /></button>
                                                    </div>
                                                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors">
                                                        <Trash2 size={16} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {/* Edit Modal */}
            {editingQuotation && (
                <EditQuotation
                    isOpen={true}
                    onClose={() => setEditingQuotation(null)}
                    initialData={editingQuotation}
                    onSuccess={() => {
                        setEditingQuotation(null);
                        fetchQuotations();
                    }}
                />
            )}



            {/* PDF Modal */}
            {pdfQuotation && (
                <QuotationPDF
                    isOpen={true}
                    onClose={() => setPdfQuotation(null)}
                    quotation={pdfQuotation}
                />
            )}
        </div >
    );
};

export default Quotations;

