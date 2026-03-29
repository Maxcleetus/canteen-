import React from 'react';
import { LayoutDashboard, Menu as MenuIcon, ClipboardList, Settings, LogOut, UtensilsCrossed, X } from 'lucide-react';

const Sidebar = ({ currentView, setCurrentView, isOpen, onClose, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Active Orders', icon: ClipboardList },
    { id: 'menu', label: 'Menu Management', icon: MenuIcon },
  ];

  const renderNavItems = (mobile = false) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 group
              ${isActive 
                ? 'bg-green-500/10 text-green-400 font-medium' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-green-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
            {item.label}
            {isActive && (
              <div className="ml-auto w-1.5 h-6 bg-green-500 rounded-full" />
            )}
          </button>
        );
      })}

      {mobile ? (
        <button
          onClick={onClose}
          className="w-full flex items-center px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors mt-2"
        >
          <X className="w-5 h-5 mr-3 text-slate-500" />
          Close Menu
        </button>
      ) : null}
    </>
  );

  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-slate-900 text-white flex flex-col shadow-2xl">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
              <div className="flex items-center">
                <UtensilsCrossed className="w-6 h-6 text-green-400 mr-3" />
                <span className="font-bold text-lg tracking-tight">RIT Canteen</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
              {renderNavItems(true)}
            </nav>

            <div className="p-4 border-t border-slate-800">
              <button className="w-full flex items-center px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <Settings className="w-5 h-5 mr-3 text-slate-500" />
                Settings
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors mt-1"
              >
                <LogOut className="w-5 h-5 mr-3 text-red-400/70" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="w-64 bg-slate-900 text-white hidden md:flex md:flex-col transition-all duration-300 shadow-xl z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <UtensilsCrossed className="w-6 h-6 text-green-400 mr-3" />
          <span className="font-bold text-lg tracking-tight">RIT Canteen</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {renderNavItems()}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <Settings className="w-5 h-5 mr-3 text-slate-500" />
            Settings
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors mt-1"
          >
            <LogOut className="w-5 h-5 mr-3 text-red-400/70" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
