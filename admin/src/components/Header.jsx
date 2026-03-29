import React from 'react';
import { Menu, Bell, Search } from 'lucide-react';

const Header = ({ toggleSidebar, currentView, user }) => {
  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Overview';
      case 'menu': return 'Menu Management';
      case 'orders': return 'Active Orders';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 sticky top-0">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors mr-4 md:hidden focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center space-x-3 md:space-x-5">
        <div className="hidden md:flex items-center relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input 
            type="text" 
            placeholder="Search orders, items..." 
            className="pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg text-sm transition-all w-64 outline-none"
          />
        </div>

        <button className="relative p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500">
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 pl-2 md:pl-4 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center border border-green-200">
            <span className="text-sm font-bold text-green-700">{user?.name ? user.name[0].toUpperCase() : 'A'}</span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-700 leading-tight">{user?.name || 'Administrator'}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role?.toLowerCase() || 'Manager'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
