import api from './api.js';
const data = (request) => request.then((response) => response.data);
export const assignmentService = {
  list: (params) => data(api.get('/assignments', { params })),
  get: (id) => data(api.get(`/assignments/${id}`)),
  save: (id, body) => data(id ? api.put(`/assignments/${id}`, body) : api.post('/assignments', body)),
  uploadResourceFile: (id, file) => { const body = new FormData(); body.append('file', file); return data(api.post(`/assignments/${id}/resource-file`, body)); },
  remove: (id) => data(api.delete(`/assignments/${id}`)),
  transition: (id, action) => data(api.post(`/assignments/${id}/${action}`)),
  subjects: () => data(api.get('/subjects')),
  generate: (body) => data(api.post('/assignments/ai/generate', body, { timeout: 35000 })),
};
export const templateService = {
  list: (params) => data(api.get('/assignment-templates', { params })),
  get: (id) => data(api.get(`/assignment-templates/${id}`)),
};
