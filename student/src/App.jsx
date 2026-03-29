import React, { useState, useEffect } from 'react';
import StudentPortal from './components/StudentPortal';
import { loginStudent, registerStudent, api } from './api';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          setIsAuthenticated(true);
        })
        .catch(() => localStorage.removeItem('studentToken'));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        const studentUser = await registerStudent(formData);
        setUser(studentUser);
        setIsAuthenticated(true);
      } else {
        const studentUser = await loginStudent(formData.email, formData.password);
        setUser(studentUser);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || `${isRegistering ? 'Registration' : 'Login'} failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studentToken');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 overflow-hidden relative">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <motion.div 
            animate={{ x: [0, 120, 0], y: [0, 60, 0], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-green-500/15 blur-[120px] mix-blend-screen"
          />
          <motion.div 
            animate={{ x: [0, -120, 0], y: [0, -60, 0], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/15 blur-[120px] mix-blend-screen"
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-purple-500/10 blur-[100px] mix-blend-screen"
          />
        </div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          onSubmit={handleSubmit} 
          className="relative z-10 w-full max-w-md glass-dark p-8 md:p-10 rounded-3xl"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 mb-2">RIT Canteen</h1>
            <p className="text-slate-400">Student Portal {isRegistering ? 'Registration' : 'Sign In'}</p>
          </div>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-5">
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 outline-none backdrop-blur-sm transition-all shadow-inner" 
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 outline-none backdrop-blur-sm transition-all shadow-inner" 
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
              <input 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 outline-none backdrop-blur-sm transition-all shadow-inner" 
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Access Portal')}
            </button>
          </div>

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setFormData({ email: '', password: '', name: '' });
              }}
              className="text-slate-400 hover:text-green-400 transition-colors text-sm"
            >
              {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
            </button>
          </div>
        </motion.form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-green-500/30">
      <StudentPortal user={user} onLogout={handleLogout} />
    </div>
  );
}

export default App;
