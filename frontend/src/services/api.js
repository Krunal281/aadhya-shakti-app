// Automatically resolve API URL based on environment
const getApiUrl = () => {
  // If running locally, connect to local server
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  // When running on Netlify, connect to your live Render backend URL.
  // Replace the URL below with your actual deployed Render backend API URL!
  return 'https://aadhya-shakti-backend.onrender.com/api'; 
};

const API_URL = getApiUrl();

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
};

export const api = {
  // Dashboard
  getDashboard: () => fetch(`${API_URL}/dashboard`).then(handleResponse),

  // Products
  getProducts: () => fetch(`${API_URL}/products`).then(handleResponse),
  createProduct: (data) => fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateProduct: (id, data) => fetch(`${API_URL}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteProduct: (id) => fetch(`${API_URL}/products/${id}`, {
    method: 'DELETE'
  }).then(handleResponse),

  // Suppliers
  getSuppliers: () => fetch(`${API_URL}/suppliers`).then(handleResponse),
  createSupplier: (data) => fetch(`${API_URL}/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateSupplier: (id, data) => fetch(`${API_URL}/suppliers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteSupplier: (id) => fetch(`${API_URL}/suppliers/${id}`, {
    method: 'DELETE'
  }).then(handleResponse),
  getSupplierDetails: (name) => fetch(`${API_URL}/suppliers/${encodeURIComponent(name)}/details`).then(handleResponse),

  // Purchases
  getPurchases: () => fetch(`${API_URL}/purchases`).then(handleResponse),
  createPurchase: (data) => fetch(`${API_URL}/purchases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updatePurchase: (id, data) => fetch(`${API_URL}/purchases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deletePurchase: (id) => fetch(`${API_URL}/purchases/${id}`, {
    method: 'DELETE'
  }).then(handleResponse),

  // Sales
  getSales: () => fetch(`${API_URL}/sales`).then(handleResponse),
  createSale: (data) => fetch(`${API_URL}/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updateSale: (id, data) => fetch(`${API_URL}/sales/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deleteSale: (id) => fetch(`${API_URL}/sales/${id}`).then(handleResponse),
  removeSale: (id) => fetch(`${API_URL}/sales/${id}`, {
    method: 'DELETE'
  }).then(handleResponse),
  clearSale: (id) => fetch(`${API_URL}/sales/${id}/clear`, {
    method: 'POST'
  }).then(handleResponse),

  // Payments
  getPayments: () => fetch(`${API_URL}/payments`).then(handleResponse),
  createPayment: (data) => fetch(`${API_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  updatePayment: (id, data) => fetch(`${API_URL}/payments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  deletePayment: (id) => fetch(`${API_URL}/payments/${id}`, {
    method: 'DELETE'
  }).then(handleResponse),
  clearPayment: (data) => fetch(`${API_URL}/payments/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(handleResponse),
  undoClearPayment: (purchaseId) => fetch(`${API_URL}/payments/undo/${purchaseId}`, {
    method: 'POST'
  }).then(handleResponse)
};
