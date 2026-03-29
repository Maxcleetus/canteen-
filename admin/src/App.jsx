import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './views/Dashboard';
import MenuView from './views/Menu';
import OrdersView from './views/Orders';
import { loginAdmin, logoutAdmin, api } from './api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      // Validate token on load
      api.get('/auth/me')
        .then(res => {
          if (res.data.user.role === 'ADMIN') {
            setUser(res.data.user);
            setIsAuthenticated(true);
          }
        })
        .catch(() => logoutAdmin());
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const adminUser = await loginAdmin(email, password);
      setUser(adminUser);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    setIsAuthenticated(false);
    setUser(null);
    setIsMobileSidebarOpen(false);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-100">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 text-center text-green-400">RIT Canteen Admin</h2>
          {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-xl mb-4 text-sm">{error}</div>}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500 outline-none" 
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500 outline-none" 
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'menu':
        return <MenuView />;
      case 'orders':
        return <OrdersView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={handleNavigate}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          toggleSidebar={() => setIsMobileSidebarOpen(true)}
          currentView={currentView} 
          user={user}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-in fade-in duration-300">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
