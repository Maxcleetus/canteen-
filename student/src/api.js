import axios from 'axios';
import { API_BASE_URL } from './config';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('studentToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginStudent = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('studentToken', data.token);
  return data.user;
};

export const registerStudent = async (userData) => {
  const { data } = await api.post('/auth/register', userData);
  localStorage.setItem('studentToken', data.token);
  return data.user;
};

export const fetchMenu = async () => {
  const { data } = await api.get('/menu');
  return data;
};

export const fetchMyOrders = async () => {
  const { data } = await api.get('/orders');
  return data;
};

export const fetchCanteenOverview = async () => {
  const { data } = await api.get('/orders/canteen-overview');
  return data;
};

export const placeOrder = async (orderPayload) => {
  const { data } = await api.post('/orders', orderPayload);
  return data;
};

export const createPaymentIntent = async (items) => {
  const { data } = await api.post('/payment/create-payment-intent', { items });
  return data;
};

export const fetchPaymentConfig = async () => {
  const { data } = await api.get('/payment/config');
  return data;
};

export const confirmPayment = async (paymentIntentId, orderId) => {
  const { data } = await api.post('/payment/confirm-payment', { paymentIntentId, orderId });
  return data;
};
