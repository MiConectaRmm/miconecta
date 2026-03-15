import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para adicionar token JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('miconecta_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor para lidar com 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('miconecta_token');
      localStorage.removeItem('miconecta_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// === Auth ===
export const authApi = {
  login: (email: string, senha: string) =>
    api.post('/auth/login', { email, senha }),
  me: () => api.get('/auth/me'),
};

// === Tenants ===
export const tenantsApi = {
  listar: () => api.get('/tenants'),
  buscar: (id: string) => api.get(`/tenants/${id}`),
  criar: (dados: any) => api.post('/tenants', dados),
  atualizar: (id: string, dados: any) => api.put(`/tenants/${id}`, dados),
  remover: (id: string) => api.delete(`/tenants/${id}`),
  listarOrgs: (tenantId: string) => api.get(`/tenants/${tenantId}/organizacoes`),
  criarOrg: (tenantId: string, dados: any) => api.post(`/tenants/${tenantId}/organizacoes`, dados),
};

// === Dispositivos ===
export const devicesApi = {
  listar: (filtros?: any) => api.get('/devices', { params: filtros }),
  buscar: (id: string) => api.get(`/devices/${id}`),
  resumo: () => api.get('/devices/resumo'),
  atualizar: (id: string, dados: any) => api.put(`/devices/${id}`, dados),
  remover: (id: string) => api.delete(`/devices/${id}`),
  inventario: (id: string) => api.get(`/devices/${id}/inventario`),
};

// === Métricas ===
export const metricsApi = {
  listar: (deviceId: string, params?: any) => api.get(`/metrics/${deviceId}`, { params }),
  ultima: (deviceId: string) => api.get(`/metrics/${deviceId}/ultima`),
  media: (deviceId: string, horas?: number) =>
    api.get(`/metrics/${deviceId}/media`, { params: { horas } }),
};

// === Alertas ===
export const alertsApi = {
  listar: (filtros?: any) => api.get('/alerts', { params: filtros }),
  contagem: () => api.get('/alerts/contagem'),
  reconhecer: (id: string) => api.put(`/alerts/${id}/reconhecer`),
  resolver: (id: string) => api.put(`/alerts/${id}/resolver`),
};

// === Scripts ===
export const scriptsApi = {
  listar: () => api.get('/scripts'),
  buscar: (id: string) => api.get(`/scripts/${id}`),
  criar: (dados: any) => api.post('/scripts', dados),
  atualizar: (id: string, dados: any) => api.put(`/scripts/${id}`, dados),
  remover: (id: string) => api.delete(`/scripts/${id}`),
  executar: (id: string, deviceIds: string[]) =>
    api.post(`/scripts/${id}/executar`, { deviceIds }),
  historico: (filtros?: any) => api.get('/scripts/historico', { params: filtros }),
};

// === Software ===
export const softwareApi = {
  listarPacotes: () => api.get('/software/packages'),
  uploadPacote: (formData: FormData) =>
    api.post('/software/packages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deploy: (packageId: string, deviceIds: string[]) =>
    api.post('/software/deploy', { packageId, deviceIds }),
  listarDeploys: () => api.get('/software/deploys'),
};

// === Patches ===
export const patchesApi = {
  listar: (deviceId: string, filtros?: any) =>
    api.get(`/patches/device/${deviceId}`, { params: filtros }),
  resumo: () => api.get('/patches/resumo'),
  instalar: (id: string) => api.put(`/patches/${id}/instalar`),
  agendar: (id: string, agendadoPara: string) =>
    api.put(`/patches/${id}/agendar`, { agendadoPara }),
};

// === Auditoria ===
export const auditApi = {
  listar: (filtros?: any) => api.get('/audit', { params: filtros }),
};

export default api;
