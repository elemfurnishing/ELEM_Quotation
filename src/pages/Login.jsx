import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, User, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username || !password) {
      setError('Please enter both username and password');
      setIsLoading(false);
      return;
    }

    // Simulate API delay
    setTimeout(async () => {
      const result = await login(username, password);

      if (result === true) {
        // Get user from localStorage to determine first accessible page
        const storedUser = localStorage.getItem('service_installation_user');
        let firstPage = '/login'; // Default to login if no access

        if (storedUser) {
          const userData = JSON.parse(storedUser);

          // Stop loading and show Welcome Popup
          setIsLoading(false);
          setShowWelcomePopup(true);
          setWelcomeName(userData.userName || username);

          // Navigate after 4 seconds
          setTimeout(() => {
            // Mapping of page names to routes (includes common typo variations)
            const pageRoutes = {
              'Dashboard': '/admin/dashboard',
              'Dashborad': '/admin/dashboard', // Common typo
              'Customer': '/admin/customer',
              'History': '/admin/quotations', // Map legacy History to Quotations
              'Quotations': '/admin/quotations',
              'Settings': '/admin/settings'
            };

            // Go to first accessible page for ALL users
            let firstPage = '/login';
            const accessiblePages = userData.pageAccess || [];
            if (accessiblePages.length > 0) {
              const pageName = accessiblePages[0].trim();
              firstPage = pageRoutes[pageName] || '/login';
            }
            navigate(firstPage);
          }, 4000); // 4 seconds delay

          return; // Stop further execution until timeout
        }

        // Fallback navigation if no user data (shouldn't happen with correct login flow)
        navigate('/login');

      } else if (result === 'deactivated') {
        setError('Access denied! Your account has been deactivated. Please contact Admin.');
        setIsLoading(false);
      } else if (result === 'no_access') {
        setError('You have no access to any page. Please contact Admin.');
        setIsLoading(false);
      } else {
        setError('Invalid username or password.');
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gray-50/50">
      {/* Abstract Background Shapes - Green Only */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-green-200/40 rounded-full blur-[100px] animate-blob mix-blend-multiply"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-green-100/40 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply"></div>
        <div className="absolute top-[40%] left-[40%] w-[40rem] h-[40rem] bg-emerald-100/30 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-6">
        <div className="bg-white/90 backdrop-blur-xl p-8 sm:p-12 rounded-3xl animate-fade-in-up shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/50">

          {/* Logo Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="mb-6 transform hover:scale-105 transition-transform duration-500">
              <img src="/logo.png" alt="ELEM Logo" className="h-20 object-contain drop-shadow-sm" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Welcome Back</h2>
              <p className="text-gray-500 text-sm font-medium">Please sign in to continue</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start animate-shake shadow-sm">
              <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            <div className="space-y-5">

              {/* User ID Input */}
              <div className="group relative">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1 group-focus-within:text-green-700 transition-colors">
                  User ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={20} className="text-gray-400 group-focus-within:text-green-700 transition-colors duration-300" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 focus:bg-white transition-all duration-300 pointer-events-auto"
                    placeholder="Enter your ID"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="group relative">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1 group-focus-within:text-green-700 transition-colors">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={20} className="text-gray-400 group-focus-within:text-green-700 transition-colors duration-300" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-green-600 focus:bg-white transition-all duration-300 pointer-events-auto"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-xl shadow-lg shadow-green-900/10 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-900/20 disabled:opacity-70 disabled:cursor-not-allowed bg-[#052e25] text-white hover:bg-[#0a4739]"
              >
                <div className="flex items-center justify-center gap-3">
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="font-semibold tracking-wide">Signing in...</span>
                    </>
                  ) : (
                    <span className="font-semibold tracking-wide text-sm uppercase">Sign In</span>
                  )}
                </div>
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Welcome Popup */}
      {showWelcomePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in-up">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full transform scale-100 animate-bounce-short border border-gray-100">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-green-50">
              <User size={40} className="text-green-700" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h3>
            <p className="text-xl text-green-700 font-semibold mb-6">{welcomeName}</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-green-600 h-1.5 rounded-full" style={{ animation: 'shrink 4s linear forwards', width: '100%' }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-4">Redirecting to dashboard...</p>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0">
        <Footer />
      </div>
    </div>
  );
};

export default Login;