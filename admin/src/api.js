import axios from 'axios';
import { API_BASE_URL } from './config';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginAdmin = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  if (data.user.role !== 'ADMIN') throw new Error('Not an admin');
  localStorage.setItem('adminToken', data.token);
  return data.user;
};

export const logoutAdmin = () => {
  localStorage.removeItem('adminToken');
};

export const fetchMenu = async () => {
  const { data } = await api.get('/menu');
  return data;
};

export const addMenuItem = async (itemData) => {
  const { data } = await api.post('/menu', itemData);
  return data;
};

export const uploadMenuImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const { data } = await api.post('/menu/upload-image', formData);
  return data;
};

export const updateMenuItem = async (id, payload) => {
  const { data } = await api.patch(`/menu/${id}`, payload);
  return data;
};

export const deleteMenuItem = async (id) => {
  const { data } = await api.delete(`/menu/${id}`);
  return data;
};

export const fetchOrders = async () => {
  const { data } = await api.get('/orders');
  return data;
};

export const updateOrderStatus = async (id, status) => {
  const { data } = await api.patch(`/orders/${id}/status`, { status });
  return data;
};

export const fetchDashboardStats = async () => {
  const { data } = await api.get('/orders/dashboard-stats');
  return data;
};

export const downloadDashboardReport = async () => {
  const response = await api.get('/orders/report', {
    responseType: 'blob'
  });

  return response;
};
