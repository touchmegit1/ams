import api from './api.js';

export const getAccounts = (params) => api.get('/admin/accounts', { params }).then((response) => response.data);
export const updateAccount = (id, data) => api.patch(`/admin/accounts/${id}`, data).then((response) => response.data);
