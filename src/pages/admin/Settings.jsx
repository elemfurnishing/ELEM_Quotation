import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, User, Key, Shield, Save, Loader2, Layout, Eye, EyeOff, CheckCircle, Search } from "lucide-react";
import { useToast } from '../../contexts/ToastContext';

const API_URL = import.meta.env.VITE_SHEET_API_URL;
const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const LOGIN_SHEET = import.meta.env.VITE_SHEET_LOGIN_NAME;

const Settings = () => {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // Search term state
  const [roleFilter, setRoleFilter] = useState("All"); // Role filter state
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pageOptions, setPageOptions] = useState([]); // Store available pages
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility in form
  const [showSuccessPopup, setShowSuccessPopup] = useState(false); // Success popup state
  const [successMessage, setSuccessMessage] = useState(""); // Dynamic success message
  const [popupPhase, setPopupPhase] = useState("loading"); // "loading" or "success"
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Delete confirmation state
  const [userToDelete, setUserToDelete] = useState(null); // User selected for deletion
  const [visiblePasswords, setVisiblePasswords] = useState({}); // Track visible passwords in table

  const [formData, setFormData] = useState({
    serialNo: "",
    employeeCode: "",
    userName: "",
    userId: "",
    password: "",
    role: "User",
    pageAccess: [], // Store selected pages
    status: "Activated", // Status: Activated or Deactivated
  });

  // Fetch page options from Login Master sheet column H
  const fetchPageOptions = async () => {
    // We will enforce the new system pages
    const systemPages = ["Dashboard", "Customer", "Quotations", "Settings"];
    setPageOptions(systemPages);
  };

  // Fetch users from Google Sheets
  const fetchUsers = async (returnData = false, showLoading = true) => {
    try {
      if (!returnData && showLoading) setLoading(true);
      const response = await fetch(
        `${API_URL}?sheet=${LOGIN_SHEET}&action=getData`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch users data');
      }

      const data = await response.json();
      if (data.success && data.data) {
        const sheetData = data.data;
        const usersData = [];

        // Start from row 2 (index 1) as per specification
        // Columns: A=Serial No, B=Employee Code, C=User Name, D=User ID, E=Password, F=Role, G=Page Access, H=Status
        for (let i = 1; i < sheetData.length; i++) {
          const row = sheetData[i];

          // Check if row has at least basic data (Serial No in column A)
          if (row[0]) { // Column A has data (Serial No)
            const user = {
              id: i + 1, // Use row number as ID for editing
              serialNo: row[0] || '', // Column A - Serial No
              employeeCode: row[1] || '', // Column B - Employee Code
              userName: row[2] || '', // Column C - User Name
              userId: row[3] || '', // Column D - User ID
              password: row[4] || '', // Column E - Password
              role: row[5] || 'User', // Column F - Role
              pageAccess: row[6] ? String(row[6]).split(',').map(s => s.trim()).filter(Boolean) : [], // Column G - Page Access
              status: row[7] || 'Activated', // Column H - Status
              rowIndex: i + 1 // Store actual row index for updates
            };
            usersData.push(user);
          }
        }

        const formattedData = usersData.reverse(); // Show latest first

        if (returnData) return formattedData;

        setUsers(formattedData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      if (!returnData) showToast('Failed to load users. Please try again.', 'error');
      return [];
    } finally {
      if (!returnData && showLoading) setLoading(false);
    }
  };

  // Generate new Serial Number (SN-001, SN-002, SN-003...n)
  const generateSerialNo = (userList = users) => {
    if (!userList || userList.length === 0) return 'SN-001';

    // Find the highest serial number from all users
    let maxNum = 0;
    userList.forEach(user => {
      const match = user.serialNo?.match(/SN-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    // Generate next serial number
    const nextNum = maxNum + 1;
    return `SN-${String(nextNum).padStart(3, '0')}`;
  };

  // Load users on component mount
  useEffect(() => {
    fetchUsers();
    fetchPageOptions();
  }, []);

  const handleAddNewUser = () => {
    setFormData({
      serialNo: generateSerialNo(),
      employeeCode: "",
      userName: "",
      userId: "",
      password: "",
      role: "User",
      pageAccess: [],
      status: "Activated",
    });
    setEditingUser(null);
    setShowModal(true);
  };

  const handleEdit = (user) => {
    setFormData({
      serialNo: user.serialNo,
      employeeCode: user.employeeCode || '',
      userName: user.userName,
      userId: user.userId,
      password: user.password,
      role: user.role,
      pageAccess: user.pageAccess || [],
      status: user.status || 'Activated',
    });
    setEditingUser(user);
    setShowModal(true);
  };

  const handleDelete = (user) => {
    // Prevent deactivation of first admin (row index 2 = first data row)
    if (user.rowIndex === 2 && user.role === 'Admin') {
      showToast('Cannot deactivate the first admin user!', 'error');
      return;
    }

    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);

      // Prepare row data with status set to Deactivated
      // Columns: A=Serial No, B=Employee Code, C=User Name, D=User ID, E=Password, F=Role, G=Page Access, H=Status
      const rowData = [
        userToDelete.serialNo,
        userToDelete.employeeCode || '',
        userToDelete.userName,
        userToDelete.userId,
        userToDelete.password,
        userToDelete.role,
        userToDelete.pageAccess.join(", "),
        "Deactivated" // Column H - Status
      ];

      const response = await fetch(API_URL, {
        method: 'POST',
        body: new URLSearchParams({
          action: 'update',
          sheetName: LOGIN_SHEET,
          rowIndex: userToDelete.rowIndex,
          rowData: JSON.stringify(rowData)
        })
      });

      const result = await response.json();

      if (result.success) {
        setShowDeleteConfirm(false);
        setUserToDelete(null);

        setSuccessMessage("User deactivated successfully!");
        setShowSuccessPopup(true);

        // Auto-hide after 4 seconds for Delete
        setTimeout(() => {
          setShowSuccessPopup(false);
          setSuccessMessage("");
        }, 4000);

        await fetchUsers(); // Refresh data
      } else {
        throw new Error(result.error || 'Failed to deactivate user');
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      showToast(`Error deactivating user: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Map backend/internal names to state names if needed
    const stateName = name === 'new_credential_secret' ? 'password' : name;

    setFormData((prev) => ({
      ...prev,
      [stateName]: value,
    }));
  };

  const handlePageAccessChange = (page) => {
    setFormData((prev) => {
      const currentAccess = prev.pageAccess || [];
      if (currentAccess.includes(page)) {
        return { ...prev, pageAccess: currentAccess.filter(p => p !== page) };
      } else {
        return { ...prev, pageAccess: [...currentAccess, page] };
      }
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.userName.trim()) {
      showToast("Please enter user name", 'error');
      return;
    }
    if (!formData.userId.trim()) {
      showToast("Please enter user ID", 'error');
      return;
    }
    if (!formData.password.trim()) {
      showToast("Please enter password", 'error');
      return;
    }
    if (!formData.role.trim()) {
      showToast("Please select role", 'error');
      return;
    }

    try {
      setLoading(true);

      let finalSerialNo = formData.serialNo;

      // If creating new user, fetch latest data to generate unique Serial No
      if (!editingUser) {
        try {
          const freshUsers = await fetchUsers(true, false);
          // Use fresh data if available
          const sourceData = (freshUsers && freshUsers.length > 0) ? freshUsers : users;
          finalSerialNo = generateSerialNo(sourceData);
        } catch (error) {
          console.error("Error fetching fresh data for ID generation:", error);
          // Fallback to local state if fetch fails
          finalSerialNo = generateSerialNo(users);
        }
      }

      // Prepare row data according to sheet columns
      // Columns: A=Serial No, B=Employee Code, C=User Name, D=User ID, E=Password, F=Role, G=Page Access, H=Status
      const rowData = [
        finalSerialNo,      // Column A - Serial No
        formData.employeeCode,  // Column B - Employee Code
        formData.userName,      // Column C - User Name
        formData.userId,        // Column D - User ID
        formData.password,      // Column E - Password
        formData.role,          // Column F - Role
        formData.pageAccess.join(", "), // Column G - Page Access
        formData.status         // Column H - Status
      ];

      // Create detailed success message
      const actionMessage = editingUser
        ? <span>User updated successfully!<br /><span className="text-sm font-normal text-gray-500 mt-1 block">ID: {formData.userId}</span></span>
        : <span>New user added successfully!<br /><span className="text-sm font-normal text-gray-500 mt-1 block">ID: {formData.userId} • Pass: {formData.password}</span></span>;

      // Close modal immediately for faster UX
      setShowModal(false);

      // Optimistic update - add/update in local state immediately
      if (!editingUser) {
        const newUser = {
          id: users.length + 2,
          rowIndex: users.length + 2,
          serialNo: finalSerialNo,
          employeeCode: formData.employeeCode,
          userName: formData.userName, // Fix: use userName

          userId: formData.userId,
          password: formData.password,
          role: formData.role,
          pageAccess: formData.pageAccess,
          status: formData.status
        };
        setUsers(prev => [newUser, ...prev]);
      } else {
        // Update existing user in local state
        setUsers(prev => prev.map(u =>
          u.id === editingUser.id
            ? { ...u, employeeCode: formData.employeeCode, userName: formData.userName, userId: formData.userId, password: formData.password, role: formData.role, pageAccess: formData.pageAccess, status: formData.status }
            : u
        ));
      }

      // Reset form
      setFormData({
        serialNo: "",
        employeeCode: "",
        userName: "",
        userId: "",
        password: "",
        role: "User",
        pageAccess: [],
        status: "Activated",
      });

      setEditingUser(null);
      setSuccessMessage(actionMessage);
      setSuccessMessage(actionMessage);
      setPopupPhase("success"); // Start directly with success phase
      setShowSuccessPopup(true);
      setLoading(false);

      // Auto-hide popup after 4 seconds
      setTimeout(() => {
        setShowSuccessPopup(false);
        setSuccessMessage("");
      }, 4000);



      // Save to server in background (non-blocking)
      const action = editingUser ? 'update' : 'insert';
      const body = {
        action,
        sheetName: LOGIN_SHEET,
        rowData: JSON.stringify(rowData)
      };

      if (editingUser) {
        body.rowIndex = editingUser.rowIndex;
      }

      fetch(API_URL, {
        method: 'POST',
        body: new URLSearchParams(body)
      }).then(() => {
        // Wait 5 seconds for sheet to save, then refresh data silently
        setTimeout(() => {
          fetchUsers(false, false);
        }, 5000);
      }).catch(error => {
        console.error('Error saving user:', error);
        showToast('Failed to save user', 'error');
        // Revert on error by fetching fresh data (after 5 sec delay)
        setTimeout(() => {
          fetchUsers(false, false);
        }, 5000);
      });

    } catch (error) {
      console.error('Error saving user:', error);
      showToast(`Error saving user: ${error.message}`, 'error');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      serialNo: "",
      employeeCode: "",
      userName: "",
      userId: "",
      password: "",
      role: "User",
      pageAccess: [],
      status: "Activated",
    });
    setEditingUser(null);
    setShowModal(false);
  };

  // Count the number of activated admin users
  const activatedAdminCount = users.filter(u => u.role === 'Admin' && u.status === 'Activated').length;

  // Filter users based on search term and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.serialNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "All" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden animate-fade-in">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-10">
        <div className="px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold text-gray-800">System Users</h1>
              <p className="text-sm text-gray-500 mt-1">Manage system users and access controls</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm"
                />
              </div>

              {/* Role Filter Dropdown */}
              <div className="relative w-full sm:w-auto">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all bg-white cursor-pointer"
                >
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="User">User</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <button
                onClick={handleAddNewUser}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all hover:bg-green-800 shadow-md shadow-green-900/20 shrink-0 bg-[#052e25]"
                disabled={loading}
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add User</span>
              </button>
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
              <p className="font-medium animate-pulse">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <User size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-gray-600 mb-1">No Users Found</h3>
              <p className="text-sm">Try adjusting your search or add a new user.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table Header */}
              <div className="hidden lg:grid grid-cols-[0.8fr_1fr_1.5fr_1fr_1.2fr_0.8fr_1.5fr_1fr_1fr] gap-4 px-6 py-3 bg-[#052e25] border-b border-gray-200 text-xs font-bold text-white uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                <div className="text-center">Serial No</div>
                <div className="text-center">Employee Code</div>
                <div className="text-left pl-2">Name</div>
                <div className="text-center">User ID</div>
                <div className="text-center">Password</div>
                <div className="text-center">Role</div>
                <div className="text-center">Page Access</div>
                <div className="text-center">Status</div>
                <div className="text-right">Action</div>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/50">
                <div className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="group hover:bg-green-50/50 transition-colors">
                      {/* Desktop Row */}
                      <div className="hidden lg:grid grid-cols-[0.8fr_1fr_1.5fr_1fr_1.2fr_0.8fr_1.5fr_1fr_1fr] gap-4 px-6 py-3 items-center">
                        {/* Serial No */}
                        <div className="text-center">
                          <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{user.serialNo}</span>
                        </div>

                        {/* Employee Code */}
                        <div className="text-center">
                          <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{user.employeeCode || '-'}</span>
                        </div>

                        {/* Name */}
                        <div className="flex items-center gap-2 pl-2">
                          <div className={`w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0`}>
                            {user.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="font-bold text-gray-900 text-sm truncate">{user.userName}</div>
                        </div>

                        {/* User ID */}
                        <div className="text-center">
                          <span className="text-xs font-mono text-gray-600">{user.userId}</span>
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-center gap-2">
                          <Key size={14} className={`text-gray-400 ${visiblePasswords[user.id] ? 'text-green-500' : ''}`} />
                          <span className="font-mono text-xs w-16 text-center">{visiblePasswords[user.id] ? user.password : "••••••••"}</span>
                          <button
                            type="button"
                            onClick={() => setVisiblePasswords(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                            className="text-gray-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            {visiblePasswords[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Role */}
                        <div className="text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${user.role === "Admin" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                            <Shield size={12} />
                            {user.role}
                          </span>
                        </div>

                        {/* Page Access */}
                        <div className="flex flex-wrap justify-center gap-1">
                          {user.pageAccess && user.pageAccess.length > 0 ? (
                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded border border-gray-200">{user.pageAccess.length} Pages</span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">None</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${user.status === "Activated" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                            {user.status === "Activated" ? <CheckCircle size={12} /> : <X size={12} />}
                            {user.status || 'Activated'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="text-right">
                          {(user.role === 'Admin' && user.status === 'Activated' && activatedAdminCount <= 1) ? (
                            <span className="text-xs text-gray-400 italic flex items-center justify-end gap-1"><Shield size={12} /> Protected</span>
                          ) : (
                            <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(user)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mobile Card Layout */}
                      <div className="lg:hidden p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0`}>
                              {user.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{user.userName}</h3>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{user.serialNo}</span>
                                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{user.employeeCode || '-'}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            {(user.role === 'Admin' && user.status === 'Activated' && activatedAdminCount <= 1) ? (
                              <span className="text-xs text-gray-400 italic flex items-center gap-1"><Shield size={12} /> Protected</span>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => handleEdit(user)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(user)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 text-sm border-t border-b border-gray-50 py-3 my-1">
                          <div className="flex items-center gap-2">
                            <Shield size={14} className="text-purple-500" />
                            <span className="font-medium text-gray-700">{user.role}</span>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${user.status === "Activated" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                              {user.status || 'Activated'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block mb-0.5">User ID</span>
                            <span className="font-mono text-xs">{user.userId}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-400 block mb-0.5">Access</span>
                            <span className="text-xs">{user.pageAccess?.length || 0} Pages</span>
                          </div>
                        </div>

                        {/* Mobile Page Access List */}
                        <div className="flex flex-wrap gap-1">
                          {user.pageAccess && user.pageAccess.length > 0 ? (
                            user.pageAccess.map((page, idx) => (
                              <span key={idx} className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded border border-gray-200">{page}</span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic text-xs">No pages</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Add/Edit User Modal */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
              <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl shadow-2xl transform transition-all scale-100 border border-gray-100">
                <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-white">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-800">
                      {editingUser ? "Edit User" : "Add User"}
                    </h3>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-colors"
                    disabled={loading}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-3 overflow-y-auto max-h-[calc(85vh-44px)] space-y-2 bg-white text-sm">
                  {/* Employee Code */}
                  <div>
                    <label className="block mb-0.5 text-xs font-semibold text-gray-700">Employee Code</label>
                    <div className="relative">
                      <Shield className="absolute left-2.5 top-1/2 w-3 h-3 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        name="employeeCode"
                        value={formData.employeeCode}
                        onChange={handleInputChange}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white font-mono"
                        placeholder="EMP-001"
                        disabled={loading}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* User Name */}
                    <div>
                      <label className="block mb-0.5 text-xs font-semibold text-gray-700">
                        User Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 w-3 h-3 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          name="userName"
                          value={formData.userName}
                          onChange={handleInputChange}
                          className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white"
                          placeholder="User Name"
                          disabled={loading}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    {/* User ID */}
                    <div>
                      <label className="block mb-0.5 text-xs font-semibold text-gray-700">
                        User ID <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 w-3 h-3 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          name="userId"
                          value={formData.userId}
                          onChange={handleInputChange}
                          className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white font-mono"
                          placeholder="User ID"
                          disabled={loading}
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block mb-0.5 text-xs font-semibold text-gray-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Key className="absolute left-2.5 top-1/2 w-3 h-3 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="new_credential_secret"
                        id="new_credential_secret"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all bg-white font-mono"
                        placeholder="••••••••"
                        disabled={loading}
                        autoComplete="off"
                        data-lpignore="true"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100 transition-colors"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Role */}
                    <div>
                      <label className="block mb-0.5 text-xs font-semibold text-gray-700">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Shield className="absolute left-2.5 top-1/2 w-3 h-3 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleInputChange}
                          className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-green-600 focus:border-green-600 bg-white disabled:opacity-50 appearance-none"
                          disabled={loading}
                        >
                          <option value="User">User</option>
                          <option value="Admin">Admin</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Status - Only show when editing */}
                    {editingUser && (
                      <div>
                        <label className="block mb-0.5 text-xs font-semibold text-gray-700">
                          Status
                        </label>
                        <div className="relative">
                          <Shield className="absolute left-2.5 top-1/2 w-3 h-3 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                          <select
                            name="status"
                            value={formData.status}
                            onChange={handleInputChange}
                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-green-600 focus:border-green-600 bg-white disabled:opacity-50 appearance-none"
                            disabled={loading}
                          >
                            <option value="Activated">Activated</option>
                            <option value="Deactivated">Deactivated</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Page Access */}
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700">Page Access Control</label>
                    <div className="border border-gray-200 rounded-md p-1.5 bg-gray-50">
                      <div className="grid grid-cols-2 gap-1">
                        {pageOptions.map((page) => (
                          <label key={page} className="flex items-center p-1 rounded hover:bg-green-50 transition-all cursor-pointer group">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.pageAccess.includes(page)}
                                onChange={() => handlePageAccessChange(page)}
                                className="peer h-3 w-3 rounded border-gray-300 text-green-700 focus:ring-green-600 cursor-pointer accent-green-700"
                                disabled={loading}
                              />
                            </div>
                            <span className="ml-1.5 text-xs text-gray-700 font-medium group-hover:text-green-800 transition-colors">
                              {page}
                            </span>
                          </label>
                        ))}
                      </div>
                      {pageOptions.length === 0 && (
                        <p className="text-xs text-gray-500 italic text-center py-1">No pages available</p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end pt-2 border-t border-gray-100 mt-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-colors shadow-sm disabled:opacity-50"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-md transition-all hover:bg-green-800 hover:shadow shadow-green-900/20 disabled:opacity-50 transform hover:-translate-y-0.5"
                      style={{ backgroundColor: '#052e25' }}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      {editingUser ? "Update User" : "Save User"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Saving...</h3>
                    <p className="text-gray-600 mb-6">Please wait while we save your data</p>
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
                    <p className="text-gray-600 mb-6">{successMessage || "Operation completed successfully."}</p>
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
          {/* Delete Confirmation Popup */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
              <div className="glass-panel rounded-2xl shadow-2xl p-6 text-center max-w-sm w-full transform scale-100 animate-bounce-short bg-white border border-gray-100">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm Delete</h3>
                <p className="text-gray-600 mb-6 text-sm">
                  Are you sure you want to deactivate user <span className="font-semibold text-gray-900">"{userToDelete?.userName}"</span>?
                  <br />This action can be undone by reactivating the user.
                </p>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-lg shadow-red-500/30"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deactivate User"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;