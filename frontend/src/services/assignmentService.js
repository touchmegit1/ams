import api from './api.js';
const data = (request) => request.then((response) => response.data);
export const assignmentService = {
  list: (params) => data(api.get('/assignments', { params })),
  get: (id) => data(api.get(`/assignments/${id}`)),
  save: (id, body) => data(id ? api.put(`/assignments/${id}`, body) : api.post('/assignments', body)),
  remove: (id) => data(api.delete(`/assignments/${id}`)),
  transition: (id, action) => data(api.post(`/assignments/${id}/${action}`)),
  subjects: () => data(api.get('/subjects')),
  generate: (body) => data(api.post('/assignments/ai/generate', body, { timeout: 35000 })),
};
export const studentAssignmentService = {
  list: () => data(api.get('/student/assignments')),
  get: (id) => data(api.get(`/student/assignments/${id}`)),
  history: (id) => data(api.get(`/student/assignments/${id}/submissions`)),
  submit: (id, form) => data(api.post(`/student/assignments/${id}/submissions`, form, { headers: { 'Content-Type': 'multipart/form-data' } })),
};
export const submissionReviewService = {
  list: (id, params = {}) => data(api.get(`/assignments/${id}/submissions`, { params })),
  review: (assignmentId, submissionId, body) => data(api.patch(`/assignments/${assignmentId}/submissions/${submissionId}/review`, body)),
  retry: (assignmentId, submissionId) => data(api.post(`/assignments/${assignmentId}/submissions/${submissionId}/retry`)),
};
export const templateService = {
  list: (params) => data(api.get('/assignment-templates', { params })),
  get: (id) => data(api.get(`/assignment-templates/${id}`)),
};
