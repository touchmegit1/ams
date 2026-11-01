import api from './api';

const profileService = {
  get: () => api.get('/auth/profile'),
  update: (data) => api.patch('/auth/profile', data),
};

export default profileService;
