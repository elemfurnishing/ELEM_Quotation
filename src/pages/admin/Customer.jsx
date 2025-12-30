import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, FilePlus, Loader2, CheckCircle, X, User, Phone, Mail, MapPin, Camera, Upload, Package, DollarSign, Percent, Save, Building2, Hash, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_SHEET_API_URL;
import CreateQuotation from './CreateQuotation';
const SHEET_NAME = import.meta.env.VITE_SHEET_CUSTOMER;
const QUOTATION_SHEET = import.meta.env.VITE_SHEET_QUOTATION;

const Customer = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    serialNo: '',
    customerId: '',
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  // Success Popup State
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [popupPhase, setPopupPhase] = useState("loading"); // "loading" or "success"

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false); // Delete success popup

  // Quotation Modal State
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [selectedCustomerForQuote, setSelectedCustomerForQuote] = useState(null);

  // Fetch Customers
  // returnData: if true, returns the data instead of setting state (for concurrency handling)
  // showLoading: if false, fetches silently without showing loader
  const fetchCustomers = async (returnData = false, showLoading = true) => {
    try {
      if (!returnData && showLoading) setLoading(true); // Don't show global loader for background fetch

      const response = await fetch(`${API_URL}?sheet=${SHEET_NAME}&action=getData`);
      if (!response.ok) throw new Error('Failed to fetch customers');

      const data = await response.json();
      if (data.success && data.data) {
        // Skip header row (index 0)
        const formattedData = data.data.slice(1).map((row, index) => ({
          rowIndex: index + 2, // Sheet row index (1-based, +1 for header)
          timestamp: row[0],         // Column A
          customerId: row[1],        // Column B - Customer ID
          name: row[2],              // Column C - Name
          phone: row[3],             // Column D - Phone Number
          leadType: row[4],          // Column E - Lead Type
          leadSource: row[5],        // Column F - Lead Source
          address: row[6],           // Column G - Address
          email: row[7]              // Column H - Email
        })).filter(c => c.customerId).reverse(); // Filter empty rows and show latest first

        if (returnData) return formattedData; // Return fresh data for ID generation

        setCustomers(formattedData);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      if (!returnData) showToast('Failed to load customers', 'error');
      return [];
    } finally {
      if (!returnData && showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // ID Generation
  const generateIds = (currentList) => {
    // Find max Serial
    let nextSerial = 1;
    let nextCustId = 1;

    if (currentList && currentList.length > 0) {
      const serials = currentList.map(c => parseInt(c.serialNo?.split('-')[1] || 0));
      const custIds = currentList.map(c => parseInt(c.customerId?.split('-')[1] || 0));

      if (serials.length > 0) nextSerial = Math.max(...serials) + 1;
      if (custIds.length > 0) nextCustId = Math.max(...custIds) + 1;
    }

    const serialNo = `SN-${String(nextSerial).padStart(3, '0')}`;
    const customerId = `CN-${String(nextCustId).padStart(4, '0')}`;

    return { serialNo, customerId };
  };

  // Handlers
  const handleAddNew = () => {
    // IDs will be generated on Save to prevent race conditions
    setFormData({
      serialNo: 'Auto-generated',
      customerId: 'Auto-generated',
      name: '',
      phone: '',
      email: '',
      address: ''
    });
    setEditingCustomer(null);
    setShowModal(true);
  };

  const handleEdit = (customer) => {
    setFormData({
      serialNo: customer.serialNo,
      customerId: customer.customerId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address
    });
    setEditingCustomer(customer);
    setShowModal(true);
  };

  // Lock Body Scroll when Modal is Open
  useEffect(() => {
    if (showModal || showQuotationModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, showQuotationModal]);

  // Quotation Modal Handlers
  const handleCreateQuote = (customer) => {
    setSelectedCustomerForQuote(customer);
    setShowQuotationModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      showToast("Please enter Name", 'error');
      return;
    }

    try {
      setLoading(true);

      const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
      let finalSerialNo = formData.serialNo;
      let finalCustomerId = formData.customerId;

      // If creating new customer, fetch latest data to generate unique IDs
      if (!editingCustomer) {
        try {
          // Fetch fresh data from server to get latest Serial/ID
          const freshCustomers = await fetchCustomers(true, false);

          // Use fresh data if available, otherwise fall back to local state
          // We check length to ensure we don't accidentally use empty array on error if we have local data
          const sourceData = (freshCustomers && freshCustomers.length > 0) ? freshCustomers : customers;

          const newIds = generateIds(sourceData);
          finalSerialNo = newIds.serialNo;
          finalCustomerId = newIds.customerId;
        } catch (error) {
          console.error("Error fetching fresh data for ID generation:", error);
          // Fallback to local state on error
          const newIds = generateIds(customers);
          finalSerialNo = newIds.serialNo;
          finalCustomerId = newIds.customerId;
        }
      }

      const rowData = [
        editingCustomer ? editingCustomer.timestamp : timestamp,
        finalSerialNo,
        finalCustomerId,
        formData.name,
        formData.phone,
        formData.email,
        formData.address
      ];

      // Close modal immediately for faster UX
      setShowModal(false);

      // Optimistic update - add to local state immediately
      if (!editingCustomer) {
        const newCustomer = {
          rowIndex: customers.length + 2,
          timestamp,
          serialNo: finalSerialNo,
          customerId: finalCustomerId,
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address
        };
        setCustomers(prev => [newCustomer, ...prev]);
      } else {
        // Update existing customer in local state
        setCustomers(prev => prev.map(c =>
          c.serialNo === editingCustomer.serialNo
            ? { ...c, name: formData.name, phone: formData.phone, email: formData.email, address: formData.address }
            : c
        ));
      }

      setSuccessMessage("Saving customer details...");
      setPopupPhase("loading"); // Start with loading phase
      setShowSuccessPopup(true);
      setLoading(false);

      // After 2 seconds, show success message
      setTimeout(() => {
        setSuccessMessage(editingCustomer ? "Customer updated successfully!" : "New customer added successfully!");
        setPopupPhase("success");
      }, 2000);

      // Auto-hide popup after 4 seconds total (2s loading + 2s success)
      setTimeout(() => {
        setShowSuccessPopup(false);
        setSuccessMessage("");
        setPopupPhase("loading");
      }, 4000);

      // Save to server in background (non-blocking)
      const action = editingCustomer ? 'update' : 'insert';
      const body = {
        action,
        sheetName: SHEET_NAME,
        rowData: JSON.stringify(rowData)
      };

      if (editingCustomer) {
        body.rowIndex = editingCustomer.rowIndex;
      }

      fetch(API_URL, {
        method: 'POST',
        body: new URLSearchParams(body)
      }).then(() => {
        // Wait 5 seconds for sheet to save, then refresh data silently
        setTimeout(() => {
          fetchCustomers(false, false);
        }, 5000);
      }).catch(error => {
        console.error('Error saving customer:', error);
        showToast('Failed to save customer', 'error');
        // Revert on error by fetching fresh data (after 5 sec delay)
        setTimeout(() => {
          fetchCustomers(false, false);
        }, 5000);
      });

    } catch (error) {
      console.error('Error saving customer:', error);
      showToast('Failed to save customer', 'error');
      setLoading(false);
    }
  };

  const handleDeleteClick = (customer) => {
    setCustomerToDelete(customer);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;

    try {
      setLoading(true);
      await fetch(API_URL, {
        method: 'POST',
        body: new URLSearchParams({
          action: 'delete',
          sheetName: SHEET_NAME,
          rowIndex: customerToDelete.rowIndex
        })
      });

      // Remove deleted customer from local state immediately
      setCustomers(prev => prev.filter(c => c.rowIndex !== customerToDelete.rowIndex));

      setShowDeleteConfirm(false);
      setCustomerToDelete(null);

      // Show delete success popup for 1 second
      setShowDeleteSuccess(true);
      setTimeout(() => {
        setShowDeleteSuccess(false);
      }, 1000);

      // Refresh data silently after 5 seconds
      setTimeout(() => {
        fetchCustomers(false, false);
      }, 5000);

    } catch (error) {
      console.error('Error deleting customer:', error);
      showToast('Failed to delete customer', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-10">
        <div className="px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your client relationships</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Search Bar - Moved to Header */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm"
                />
              </div>
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
              <p className="font-medium animate-pulse">Loading customers...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <User size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-gray-600 mb-1">No Customers Found</h3>
              <p className="text-sm">Try adjusting your search or add a new customer.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table Header */}
              <div className="hidden lg:grid grid-cols-[1fr_2fr_1.2fr_1.5fr_1fr_1fr_1.5fr_0.6fr] gap-4 px-6 py-3 bg-[#052e25] border-b border-gray-200 text-xs font-bold text-white uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                <div className="text-center">Customer ID</div>
                <div className="pl-10 text-left">Name</div>
                <div className="text-center">Phone Number</div>
                <div className="text-center">Email</div>
                <div className="text-center">Lead Type</div>
                <div className="text-center">Lead Source</div>
                <div className="text-center">Address</div>
                <div className="text-center">Action</div>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/50">
                <div className="divide-y divide-gray-100">
                  {filteredCustomers.map((customer) => (
                    <div key={customer.customerId} className="group hover:bg-green-50/50 transition-colors">
                      {/* Desktop Row */}
                      <div className="hidden lg:grid grid-cols-[1fr_2fr_1.2fr_1.5fr_1fr_1fr_1.5fr_0.6fr] gap-4 px-6 py-3 items-center">
                        {/* Customer ID */}
                        <div className="text-center">
                          <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-medium">
                            {customer.customerId}
                          </span>
                        </div>

                        {/* Name */}
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getRandomColor(customer.name || '?')} flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0`}>
                            {getInitials(customer.name || '?')}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{customer.name || 'Unknown'}</p>
                          </div>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center justify-center gap-2 text-gray-600">
                          <Phone size={14} className="text-green-600" />
                          <span className="text-xs font-mono">{customer.phone}</span>
                        </div>

                        {/* Email */}
                        <div className="flex items-center justify-center gap-2 text-gray-600">
                          <Mail size={14} className="text-green-600 flex-shrink-0" />
                          <span className="text-xs break-all line-clamp-1">{customer.email}</span>
                        </div>

                        {/* Lead Type */}
                        <div className="text-center">
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{customer.leadType || '-'}</span>
                        </div>

                        {/* Lead Source */}
                        <div className="text-center">
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{customer.leadSource || '-'}</span>
                        </div>

                        {/* Address */}
                        <div className="flex items-start justify-center gap-2 text-gray-600">
                          <MapPin size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-left line-clamp-2">{customer.address}</span>
                        </div>

                        {/* Actions - Only Create Quotation */}
                        <div className="flex items-center justify-center">
                          <button onClick={() => handleCreateQuote(customer)} className="p-1.5 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors" title="Create Quotation">
                            <FilePlus size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Mobile Card Layout */}
                      <div className="lg:hidden p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${getRandomColor(customer.name || '?')} flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0`}>
                              {getInitials(customer.name || '?')}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{customer.name}</h3>
                              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mt-1 inline-block font-medium">{customer.customerId}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-y-2 text-sm border-t border-b border-gray-50 py-3 my-1">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-400 flex-shrink-0" />
                            <span>{customer.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="break-all">{customer.email}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                            <span>{customer.address}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-gray-500">Lead Type: <span className="font-medium text-gray-700">{customer.leadType || '-'}</span></span>
                            <span className="text-xs text-gray-500">Lead Source: <span className="font-medium text-gray-700">{customer.leadSource || '-'}</span></span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center pt-1">
                          <button onClick={() => handleCreateQuote(customer)} className="flex items-center gap-2 text-sm font-medium text-white bg-purple-600 px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-sm">
                            <FilePlus size={16} />
                            Create Quotation
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



      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full transform scale-100 animate-bounce-short bg-white border border-gray-100">
            {popupPhase === "loading" ? (
              <>
                {/* Loading Phase - 3 seconds */}
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Processing...</h3>
                <p className="text-gray-600 mb-6">{successMessage || "Please wait..."}</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-500 h-1.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
              </>
            ) : (
              <>
                {/* Success Phase - 2 seconds */}
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Success!</h3>
                <p className="text-gray-600 mb-6">{successMessage}</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ animation: 'shrink 2s linear forwards', width: '100%' }}></div>
                </div>
              </>
            )}
            <style>{`
              @keyframes shrink {
                from { width: 100%; }
                to { width: 0%; }
              }
              .animate-bounce-short {
                  animation: bounce-short 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              }
              @keyframes bounce-short {
                  0% { transform: scale(0.8); opacity: 0; }
                  100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Create Quotation Modal */}
      {showQuotationModal && (
        <CreateQuotation
          isOpen={showQuotationModal}
          onClose={() => setShowQuotationModal(false)}
          customer={selectedCustomerForQuote}
        />
      )}

    </div >
  );
};

export default Customer;