import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  User,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';


const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const navigate = useNavigate();

  // Strict Page Access Control
  useEffect(() => {
    if (!user) return;

    // Helper to determine page purpose from path
    const getPageNameFromPath = (path) => {
      if (path.includes('/dashboard')) return 'Dashboard';
      if (path.includes('/customer')) return 'Customer';
      if (path.includes('/quotations')) return 'Quotations';
      if (path.includes('/settings')) return 'Settings';
      return null;
    };

    const currentPage = getPageNameFromPath(location.pathname);

    // If we can identify the page, check permissions
    if (currentPage) {
      const userPages = user.pageAccess || [];

      // Handle aliases
      const isAllowed = userPages.some(p => {
        const page = p.trim();
        if (page === currentPage) return true;
        // Handle typos
        if (currentPage === 'Dashboard' && page === 'Dashborad') return true;
        return false;
      });

      if (!isAllowed) {
        console.warn(`Access denied to ${currentPage}. Redirecting...`);
        const pageRoutes = {
          'Dashboard': '/admin/dashboard',
          'Dashborad': '/admin/dashboard',
          'Customer': '/admin/customer',
          'Quotations': '/admin/quotations',
          'Settings': '/admin/settings'
        };

        if (userPages.length > 0) {
          const firstPage = userPages[0].trim();
          const target = pageRoutes[firstPage] || '/admin/dashboard';
          if (location.pathname !== target) {
            navigate(target, { replace: true });
          }
        } else {
          navigate('/login');
        }
      }
    }
  }, [location.pathname, user, navigate]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Handle Resize: Close mobile sidebar when switching to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    if (sidebarOpen) setSidebarOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="glass-panel border-b border-elem-gold/50 fixed top-0 left-0 right-0 z-30 h-16 shadow-lg bg-white/90 backdrop-blur-md">
        <div className="px-3 sm:px-4 lg:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger Menu */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 -ml-2 text-elem-green hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <Link to="/admin/dashboard" className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-elem-green">
                {(() => {
                  if (location.pathname.includes('/customer')) return 'Customers';
                  if (location.pathname.includes('/quotations')) return 'Quotations';
                  if (location.pathname.includes('/settings')) return 'Settings';
                  return 'Dashboard';
                })()}
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            {/* User Name Display */}
            {user && (
              <div className="flex items-center gap-2 text-elem-green bg-elem-green/5 px-3 py-1.5 rounded-full border border-elem-green/10 shadow-sm">
                <User size={18} className="text-elem-green" />
                <span className="text-sm font-semibold hidden sm:inline-block">{user.name}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 focus:outline-none rounded-full px-3 py-1.5 transition-all duration-200 border border-transparent hover:border-red-100 group"
            >
              <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline-block text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 pt-16 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar - Responsive */}
        <aside
          className={`
            fixed lg:fixed top-0 lg:top-16 bottom-0 left-0 z-50
            bg-white border-r border-gray-200
            transition-all duration-300 ease-in-out shadow-xl lg:shadow-none overflow-hidden
            lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
            ${isSidebarHovered ? 'lg:w-52 lg:shadow-2xl' : 'lg:w-20'}
            w-64
          `}
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
        >
          {/* Mobile Sidebar Header */}
          <div className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-gray-100 bg-white">
            <div className="flex flex-col leading-none">
              <span className="text-xl font-extrabold text-elem-green tracking-tight">Elem</span>
              <span className="text-[10px] font-semibold text-elem-gold uppercase tracking-wider">Quotation System</span>
            </div>
            <button onClick={closeSidebar} className="p-2 -mr-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>

          <div
            className="h-full overflow-y-auto pb-20 pt-4 lg:pt-6 overflow-x-hidden [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <nav className="px-3 space-y-2">
              {(() => {
                const hasAccess = (pageName) => {
                  if (!user) return false;
                  if (!user.pageAccess || user.pageAccess.length === 0) return false;
                  const typoMap = { 'Dashboard': ['Dashboard', 'Dashborad'] };
                  const variations = typoMap[pageName] || [pageName];
                  return variations.some(name => user.pageAccess.includes(name));
                };

                return (
                  <>
                    {/* Dashboard */}
                    {hasAccess('Dashboard') && (
                      <Link
                        to="/admin/dashboard"
                        onClick={closeSidebar}
                        className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium relative whitespace-nowrap overflow-hidden
                          ${isActive('/admin/dashboard')
                            ? 'bg-elem-green text-white border-r-4 border-elem-gold shadow-lg shadow-elem-green/20'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-elem-green'
                          }`}
                      >
                        <LayoutDashboard size={20} className={`shrink-0 relative z-10 ${isActive('/admin/dashboard') ? 'text-elem-gold' : 'text-gray-500 group-hover:text-elem-green'}`} />
                        <span className={`transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:hidden ${isSidebarHovered ? '!opacity-100 !translate-x-0 !block' : ''} ${sidebarOpen ? 'block opacity-100 translate-x-0' : ''}`}>
                          Dashboard
                        </span>
                      </Link>
                    )}

                    {/* Customers */}
                    {hasAccess('Customer') && (
                      <Link
                        to="/admin/customer"
                        onClick={closeSidebar}
                        className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium relative whitespace-nowrap overflow-hidden
                          ${isActive('/admin/customer')
                            ? 'bg-elem-green text-white border-r-4 border-elem-gold shadow-lg shadow-elem-green/20'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-elem-green'
                          }`}
                      >
                        <Users size={20} className={`shrink-0 relative z-10 ${isActive('/admin/customer') ? 'text-elem-gold' : 'text-gray-500 group-hover:text-elem-green'}`} />
                        <span className={`transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:hidden ${isSidebarHovered ? '!opacity-100 !translate-x-0 !block' : ''} ${sidebarOpen ? 'block opacity-100 translate-x-0' : ''}`}>
                          Customers
                        </span>
                      </Link>
                    )}

                    {/* Quotations */}
                    {hasAccess('Quotations') && (
                      <Link
                        to="/admin/quotations"
                        onClick={closeSidebar}
                        className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium relative whitespace-nowrap overflow-hidden
                          ${isActive('/admin/quotations')
                            ? 'bg-elem-green text-white border-r-4 border-elem-gold shadow-lg shadow-elem-green/20'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-elem-green'
                          }`}
                      >
                        <FileText size={20} className={`shrink-0 relative z-10 ${isActive('/admin/quotations') ? 'text-elem-gold' : 'text-gray-500 group-hover:text-elem-green'}`} />
                        <span className={`transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:hidden ${isSidebarHovered ? '!opacity-100 !translate-x-0 !block' : ''} ${sidebarOpen ? 'block opacity-100 translate-x-0' : ''}`}>
                          Quotations
                        </span>
                      </Link>
                    )}

                    {/* Settings */}
                    {hasAccess('Settings') && (
                      <Link
                        to="/admin/settings"
                        onClick={closeSidebar}
                        className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium relative whitespace-nowrap overflow-hidden
                          ${isActive('/admin/settings')
                            ? 'bg-elem-green text-white border-r-4 border-elem-gold shadow-lg shadow-elem-green/20'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-elem-green'
                          }`}
                      >
                        <Settings size={20} className={`shrink-0 relative z-10 ${isActive('/admin/settings') ? 'text-elem-gold' : 'text-gray-500 group-hover:text-elem-green'}`} />
                        <span className={`transition-all duration-300 lg:opacity-0 lg:-translate-x-4 lg:hidden ${isSidebarHovered ? '!opacity-100 !translate-x-0 !block' : ''} ${sidebarOpen ? 'block opacity-100 translate-x-0' : ''}`}>
                          Settings
                        </span>
                      </Link>
                    )}
                  </>
                );
              })()}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 min-w-0 bg-gray-50 relative z-0 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarHovered ? 'lg:ml-52' : 'lg:ml-20'} pb-16 lg:pb-10`}>
          <div className="bg-gray-50 h-full overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer - Fixed at bottom for both Mobile and Desktop */}
      <div className={`fixed bottom-0 right-0 z-20 transition-all duration-300 ease-in-out left-0 ${isSidebarHovered ? 'lg:left-52' : 'lg:left-20'}`}>
        <Footer />
      </div>

      {/* Mobile Footer - Relative in sidebar or bottom of menu? actually sidebar has pb-20 so it might be cut off. Let's putting it in main content for mobile or just hiding it? 
          User didn't ask for footer. I'll leave the desktop footer as is. 
          The mobile bottom nav is REMOVED as per request.
      */}
    </div>
  );
};

export default AdminLayout;