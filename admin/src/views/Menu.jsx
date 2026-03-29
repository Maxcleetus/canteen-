import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Upload } from 'lucide-react';
import { fetchMenu, addMenuItem, updateMenuItem, deleteMenuItem, uploadMenuImage } from '../api';
import { useToast } from '../components/ToastProvider';

const FALLBACK_MENU_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'%3E%3Crect width='400' height='240' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' fill='%2364758b' font-family='Arial, sans-serif' font-size='24' text-anchor='middle' dominant-baseline='middle'%3ENo image%3C/text%3E%3C/svg%3E";

const createEmptyFormData = () => ({
  name: '',
  description: '',
  price: '',
  image: '',
  stock: '',
  status: 'AVAILABLE',
  categoryName: ''
});

const MenuView = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState(createEmptyFormData);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchMenu().then(data => {
      setItems(data);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to fetch menu:', err);
      setLoading(false);
    });
  }, []);

  const resetModalState = () => {
    setShowAddModal(false);
    setEditingItem(null);
    setFormData(createEmptyFormData());
    setImageUploadError('');
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData(createEmptyFormData());
    setImageUploadError('');
    setShowAddModal(true);
  };

  const categories = ['All', ...new Set(items.map(item => item.category?.name).filter(Boolean))];

  const filteredItems = items.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category?.name === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddItem = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setImageUploadError('');

    try {
      if (editingItem) {
        const updatedItem = await updateMenuItem(editingItem.id, {
          ...formData,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock) || 0
        });
        setItems(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
        toast.success('Menu item updated', `${updatedItem.name} is ready for service.`);
      } else {
        const newItem = await addMenuItem({
          ...formData,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock) || 0
        });
        setItems(prev => [newItem, ...prev]);
        toast.success('Menu item added', `${newItem.name} is now on the menu.`);
      }
      resetModalState();
    } catch (error) {
      console.error('Failed to save item:', error);
      toast.error(
        'Unable to save menu item',
        error?.response?.data?.error || 'Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setImageUploadError('');
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      image: item.image || '',
      stock: item.stock.toString(),
      status: item.status,
      categoryName: item.category?.name || ''
    });
    setShowAddModal(true);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setImageUploadError('');
    setUploadingImage(true);

    try {
      const { imageUrl } = await uploadMenuImage(file);
      setFormData(prev => ({ ...prev, image: imageUrl }));
      toast.success('Image uploaded', 'Dish photo saved to Cloudinary.');
    } catch (error) {
      console.error('Failed to upload menu image:', error);
      const message = error?.response?.data?.error || 'Failed to upload image. Please try again.';
      setImageUploadError(message);
      toast.error('Image upload failed', message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteMenuItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      toast.success('Menu item deleted', 'The dish has been removed from the menu.');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error(
        'Unable to delete menu item',
        error?.response?.data?.error || 'Please try again.'
      );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-700';
      case 'LOW_STOCK': return 'bg-orange-100 text-orange-700';
      case 'OUT_OF_STOCK': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Menu Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage food items, categories, and availability.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white text-slate-700 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all">
            Manage Categories
          </button>
          <button 
            onClick={openAddModal}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 shadow-sm shadow-green-600/20 transition-all flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                activeCategory === cat 
                  ? 'bg-white text-green-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search menu items..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-200 rounded-lg text-sm transition-all w-full lg:w-64 outline-none"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">Loading menu...</div>
        ) : (
          <>
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:border-green-200 transition-all">
                <div className="h-40 relative overflow-hidden bg-slate-100">
                  <img 
                    src={item.image || FALLBACK_MENU_IMAGE}
                    alt={item.name} 
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_MENU_IMAGE;
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusBadge(item.status)}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg group-hover:text-green-600 transition-colors">{item.name}</h3>
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{item.category?.name}</p>
                    </div>
                    <span className="font-bold text-lg text-slate-800 bg-slate-50 px-2 py-1 rounded-lg">₹{item.price}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-slate-500 mb-5">
                    <span className="w-2 h-2 rounded-full bg-slate-300 mr-2"></span>
                    Stock: <span className="font-semibold text-slate-700 ml-1">{item.stock} portions</span>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => handleEditItem(item)}
                      className="flex-1 flex items-center justify-center py-2 text-sm font-medium text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button 
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex-1 flex items-center justify-center py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Placeholder Card */}
            <div
              onClick={openAddModal}
              className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 hover:text-green-600 hover:border-green-300 hover:bg-green-50/50 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 group-hover:scale-110 shadow-sm transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold">Add New Item</span>
            </div>
          </>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
              <button 
                onClick={resetModalState}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Item Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="e.g., Chicken Biryani"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  rows="3"
                  placeholder="Optional description"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Stock</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <input
                  type="text"
                  required
                  value={formData.categoryName}
                  onChange={(e) => setFormData(prev => ({ ...prev, categoryName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="e.g., Meals, Snacks, Beverages"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-slate-700">Dish Image</label>
                  <label className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${uploadingImage ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100 cursor-pointer'}`}>
                    <Upload className="w-4 h-4" />
                    {uploadingImage ? 'Uploading...' : 'Upload to Cloudinary'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="mb-3 h-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  <img
                    src={formData.image || FALLBACK_MENU_IMAGE}
                    alt={formData.name || 'Dish preview'}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_MENU_IMAGE;
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-slate-500 mb-3">Upload an image file to Cloudinary or paste a public image URL manually.</p>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => {
                    setImageUploadError('');
                    setFormData(prev => ({ ...prev, image: e.target.value }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="https://res.cloudinary.com/..."
                />
                {imageUploadError ? (
                  <p className="mt-2 text-sm text-red-600">{imageUploadError}</p>
                ) : null}
                {formData.image ? (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                    className="mt-3 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
                  >
                    Remove image
                  </button>
                ) : null}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetModalState}
                  className="flex-1 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploadingImage ? 'Uploading image...' : (submitting ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuView;
