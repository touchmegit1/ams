import api from './api.js';

export const getAccounts = (params) => api.get('/admin/accounts', { params }).then((res) => res.data);
export const getAccountStats = () => api.get('/admin/accounts/stats').then((res) => res.data);
export const createAccount = (data) => api.post('/admin/accounts', data).then((res) => res.data);
export const updateAccount = (id, data) => api.patch(`/admin/accounts/${id}`, data).then((res) => res.data);
export const deleteAccount = (id) => api.delete(`/admin/accounts/${id}`).then((res) => res.data);

export const getCoursesOverview = () => api.get('/admin/courses/overview').then((res) => res.data);
export const updateCourseStatus = (id, status) => api.patch(`/admin/courses/${id}/status`, { status }).then((res) => res.data);
export const createCourse = (data) => api.post('/admin/courses', data).then((res) => res.data);
export const deleteCourse = (id) => api.delete(`/admin/courses/${id}`).then((res) => res.data);

export const getPaymentsOverview = () => api.get('/admin/payments/overview').then((res) => res.data);
