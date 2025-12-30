import React, { useState, useEffect } from "react";
import {
  FileText,
  Users,
  Package,
  IndianRupee,
  Loader2,
  Search,
  Calendar,
  Phone,
  TrendingUp,
} from "lucide-react";
import { useToast } from '../../contexts/ToastContext';

const API_URL = import.meta.env.VITE_SHEET_API_URL;
const QUOTATIONS_SHEET = import.meta.env.VITE_SHEET_QUOTATIONS;
const CUSTOMERS_SHEET = import.meta.env.VITE_SHEET_CUSTOMER;
const INVENTORY_API = import.meta.env.VITE_INVENTORY_API_UPI;
const INVENTORY_SHEET = import.meta.env.VITE_SHEET_INVENTORY;

// Format date helper DD/MM/YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const Dashboard = () => {
  const { showToast } = useToast();
  const [stats, setStats] = useState({
    totalQuotations: 0,
    totalCustomers: 0,
    totalInventory: 0,
    totalRevenue: 0
  });

  const [recentQuotations, setRecentQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Function to fetch data from all sheets
  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [quotationsRes, customersRes, inventoryRes] = await Promise.all([
        fetch(`${API_URL}?sheet=${QUOTATIONS_SHEET}&action=getData`),
        fetch(`${API_URL}?sheet=${CUSTOMERS_SHEET}&action=getData`),
        fetch(`${INVENTORY_API}?sheet=${INVENTORY_SHEET}&action=getData`)
      ]);

      const [quotationsData, customersData, inventoryData] = await Promise.all([
        quotationsRes.json(),
        customersRes.json(),
        inventoryRes.json()
      ]);

      return {
        quotations: (quotationsData.success && quotationsData.data) ? quotationsData.data : [],
        customers: (customersData.success && customersData.data) ? customersData.data : [],
        inventory: (inventoryData.success && inventoryData.data) ? inventoryData.data : []
      };

    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Failed to load dashboard data', 'error');
      return { quotations: [], customers: [], inventory: [] };
    }
  };

  // Process quotations data
  const processQuotationsData = (rows) => {
    const dataRows = rows.slice(1); // Skip header
    const groups = {};
    let totalRevenue = 0;

    dataRows.forEach((row) => {
      if (!row || row.length < 2 || !row[1]) return;

      const serialNo = row[1]; // Column B: Serial No

      if (!groups[serialNo]) {
        groups[serialNo] = {
          serialNo: serialNo,
          date: row[0],                    // Col A: Timestamp
          employeeCode: row[2],            // Col C: Employee Code
          customerId: row[3],              // Col D: Customer ID
          customerName: row[4],            // Col E: Customer Name
          customerPhone: row[5],           // Col F: Customer Phone
          itemsCount: 0,
          totalAmount: 0
        };
      }

      groups[serialNo].itemsCount += 1;
      const amount = parseFloat(row[12]); // Col M: Subtotal
      if (!isNaN(amount)) {
        groups[serialNo].totalAmount += amount;
        totalRevenue += amount;
      }
    });

    const quotationsList = Object.values(groups).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    return { quotationsList, totalRevenue, uniqueCount: quotationsList.length };
  };

  const loadDashboardData = async () => {
    try {
      const data = await fetchAllData();

      // Process quotations
      const { quotationsList, totalRevenue, uniqueCount } = processQuotationsData(data.quotations);

      // Count customers (skip header row)
      const customersCount = data.customers.length > 1 ? data.customers.length - 1 : 0;

      // Count inventory items (skip header row)
      const inventoryCount = data.inventory.length > 1 ? data.inventory.length - 1 : 0;

      setStats({
        totalQuotations: uniqueCount,
        totalCustomers: customersCount,
        totalInventory: inventoryCount,
        totalRevenue: totalRevenue
      });

      // Set recent quotations (top 20)
      setRecentQuotations(quotationsList.slice(0, 20));

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter quotations based on search
  const filteredQuotations = recentQuotations.filter(q =>
    q.serialNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.customerPhone?.includes(searchTerm)
  );

  const StatCard = ({ title, value, icon: Icon, color, bgColor, prefix = '' }) => (
    <div className="glass-card p-6 rounded-xl hover:-translate-y-1 transition-transform">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-800 tracking-tight">
            {prefix}{typeof value === 'number' && prefix === '₹' ? formatCurrency(value).replace('₹', '') : value}
          </h3>
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  const getInitials = (name) => {
    return name
      ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : '??';
  };

  const getRandomColor = (name) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden animate-fade-in">
      <div className="flex-1 overflow-auto px-4 lg:px-6 py-6 space-y-6 relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="p-4 rounded-full bg-white/80 shadow-lg">
              <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          </div>
        )}

        {/* Key Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Quotations"
            value={stats.totalQuotations}
            icon={FileText}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <StatCard
            title="Total Customers"
            value={stats.totalCustomers}
            icon={Users}
            color="text-purple-600"
            bgColor="bg-purple-100"
          />
          <StatCard
            title="Inventory Items"
            value={stats.totalInventory}
            icon={Package}
            color="text-orange-600"
            bgColor="bg-orange-100"
          />
          <StatCard
            title="Total Revenue"
            value={stats.totalRevenue}
            icon={TrendingUp}
            color="text-green-600"
            bgColor="bg-green-100"
            prefix="₹"
          />
        </div>

        {/* Recent Quotations Table */}
        <div className="glass-panel rounded-xl overflow-hidden shadow-lg border-0">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Recent Quotations
            </h2>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search quotations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none w-full text-sm bg-gray-50/50 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="overflow-hidden">
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-gray-100 relative">
                <thead className="bg-[#052e25] sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold tracking-wider text-left text-white uppercase">Serial No</th>
                    <th className="px-6 py-3 text-xs font-bold tracking-wider text-left text-white uppercase">Employee Code</th>
                    <th className="px-6 py-3 text-xs font-bold tracking-wider text-left text-white uppercase">Customer</th>
                    <th className="px-6 py-3 text-xs font-bold tracking-wider text-center text-white uppercase">Items</th>
                    <th className="px-6 py-3 text-xs font-bold tracking-wider text-right text-white uppercase">Amount</th>
                    <th className="px-6 py-3 text-xs font-bold tracking-wider text-center text-white uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-50">
                  {filteredQuotations.map((quote, idx) => (
                    <tr key={idx} className="hover:bg-green-50/50 transition-colors group">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          {quote.serialNo}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                          {quote.employeeCode || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getRandomColor(quote.customerName)} flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0`}>
                            {getInitials(quote.customerName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{quote.customerName || 'Unknown'}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Phone size={10} />
                              <span className="font-mono">{quote.customerPhone || '-'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="text-sm text-gray-600 font-medium">
                          {quote.itemsCount} {quote.itemsCount === 1 ? 'item' : 'items'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 w-fit ml-auto">
                          <IndianRupee size={12} className="text-gray-400" />
                          <span className="font-semibold text-gray-700">{formatCurrency(quote.totalAmount).replace('₹', '')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                          <Calendar size={12} className="text-green-600" />
                          {formatDate(quote.date)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQuotations.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-16 text-center text-gray-500 bg-gray-50/30">
                        <div className="flex flex-col items-center gap-3">
                          <Search className="w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-600">No quotations found</p>
                          <p className="text-sm text-gray-400">Try adjusting your search</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {filteredQuotations.length > 0 ? (
                filteredQuotations.map((quote, idx) => (
                  <div key={idx} className="glass-card p-4 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${getRandomColor(quote.customerName)} flex items-center justify-center text-white font-bold shadow-sm`}>
                          {getInitials(quote.customerName)}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{quote.customerName}</h4>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{quote.serialNo}</span>
                            <span className="text-[10px] text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded">{quote.employeeCode || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm border-t border-gray-50 pt-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Amount</p>
                        <p className="font-bold text-gray-900">{formatCurrency(quote.totalAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Items</p>
                        <p className="font-medium text-gray-700">{quote.itemsCount}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 mb-0.5">Date</p>
                        <p className="font-medium text-gray-700">{formatDate(quote.date)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  {searchTerm ? 'No matching records found' : 'No data available'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;