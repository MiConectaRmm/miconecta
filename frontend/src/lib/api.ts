import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('miconecta_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor: refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('miconecta_refresh');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('miconecta_token', data.access_token);
          localStorage.setItem('miconecta_refresh', data.refresh_token);
          localStorage.setItem('miconecta_user', JSON.stringify(data.user));
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('miconecta_token');
          localStorage.removeItem('miconecta_refresh');
          localStorage.removeItem('miconecta_user');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('miconecta_token');
        localStorage.removeItem('miconecta_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ── Auth ──
export const authApi = {
  login: (email: string, senha: string) => api.post('/auth/login', { email, senha }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ── Tenants / Clients ──
export const tenantsApi = {
  listar: () => api.get('/tenants'),
  buscar: (id: string) => api.get(`/tenants/${id}`),
  criar: (dados: any) => api.post('/tenants', dados),
  atualizar: (id: string, dados: any) => api.put(`/tenants/${id}`, dados),
  remover: (id: string) => api.delete(`/tenants/${id}`),
  listarOrgs: (tenantId: string) => api.get(`/tenants/${tenantId}/organizacoes`),
  criarOrg: (tenantId: string, dados: any) => api.post(`/tenants/${tenantId}/organizacoes`, dados),
};

// ── Users (Client Users) ──
export const usersApi = {
  listarClientes: () => api.get('/users/clients'),
  buscarCliente: (id: string) => api.get(`/users/clients/${id}`),
  criarCliente: (dados: any) => api.post('/users/clients', dados),
  atualizarCliente: (id: string, dados: any) => api.put(`/users/clients/${id}`, dados),
  desativarCliente: (id: string) => api.delete(`/users/clients/${id}`),
  convidarCliente: (id: string) => api.post(`/users/clients/${id}/invite`),
};

// ── Devices ──
export const devicesApi = {
  listar: (filtros?: any) => api.get('/devices', { params: filtros }),
  buscar: (id: string) => api.get(`/devices/${id}`),
  resumo: () => api.get('/devices/resumo'),
  atualizar: (id: string, dados: any) => api.put(`/devices/${id}`, dados),
  remover: (id: string) => api.delete(`/devices/${id}`),
  inventario: (id: string) => api.get(`/devices/${id}/inventario`),
};

// ── Metrics ──
export const metricsApi = {
  listar: (deviceId: string, params?: any) => api.get(`/metrics/${deviceId}`, { params }),
  ultima: (deviceId: string) => api.get(`/metrics/${deviceId}/ultima`),
  media: (deviceId: string, horas?: number) => api.get(`/metrics/${deviceId}/media`, { params: { horas } }),
};

// ── Alerts ──
export const alertsApi = {
  listar: (filtros?: any) => api.get('/alerts', { params: filtros }),
  contagem: () => api.get('/alerts/contagem'),
  reconhecer: (id: string) => api.put(`/alerts/${id}/reconhecer`),
  resolver: (id: string) => api.put(`/alerts/${id}/resolver`),
};

// ── Tickets ──
export const ticketsApi = {
  listar: (filtros?: any) => api.get('/tickets', { params: filtros }),
  buscar: (id: string) => api.get(`/tickets/${id}`),
  criar: (dados: any) => api.post('/tickets', dados),
  contagem: () => api.get('/tickets/contagem'),
  timeline: (id: string) => api.get(`/tickets/${id}/timeline`),
  atribuir: (id: string, technicianId: string, technicianNome: string) =>
    api.put(`/tickets/${id}/atribuir`, { technicianId, technicianNome }),
  resolver: (id: string) => api.put(`/tickets/${id}/resolver`),
  fechar: (id: string) => api.put(`/tickets/${id}/fechar`),
  reabrir: (id: string) => api.put(`/tickets/${id}/reabrir`),
  comentar: (id: string, conteudo: string, visivelCliente?: boolean) =>
    api.post(`/tickets/${id}/comentario`, { conteudo, visivelCliente }),
  avaliar: (id: string, nota: number, comentario?: string) =>
    api.post(`/tickets/${id}/avaliar`, { nota, comentario }),
};

// ── Chat ──
export const chatApi = {
  mensagens: (ticketId: string, limit?: number, offset?: number) =>
    api.get(`/chat/tickets/${ticketId}/messages`, { params: { limit, offset } }),
  enviar: (ticketId: string, conteudo: string) =>
    api.post(`/chat/tickets/${ticketId}/messages`, { conteudo }),
  marcarLida: (id: string) => api.put(`/chat/messages/${id}/read`),
  marcarTodasLidas: (ticketId: string) => api.put(`/chat/tickets/${ticketId}/read-all`),
};

// ── Remote Sessions ──
export const sessionsApi = {
  listar: (filtros?: any) => api.get('/remote-sessions', { params: filtros }),
  buscar: (id: string) => api.get(`/remote-sessions/${id}`),
  solicitar: (deviceId: string, ticketId?: string, motivo?: string) =>
    api.post('/remote-sessions', { deviceId, ticketId, motivo }),
  logs: (id: string) => api.get(`/remote-sessions/${id}/logs`),
};

// ── Scripts ──
export const scriptsApi = {
  listar: () => api.get('/scripts'),
  buscar: (id: string) => api.get(`/scripts/${id}`),
  criar: (dados: any) => api.post('/scripts', dados),
  atualizar: (id: string, dados: any) => api.put(`/scripts/${id}`, dados),
  remover: (id: string) => api.delete(`/scripts/${id}`),
  executar: (id: string, deviceIds: string[]) => api.post(`/scripts/${id}/executar`, { deviceIds }),
  historico: (filtros?: any) => api.get('/scripts/historico', { params: filtros }),
};

// ── Software ──
export const softwareApi = {
  listarPacotes: () => api.get('/software/packages'),
  uploadPacote: (formData: FormData) =>
    api.post('/software/packages', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deploy: (packageId: string, deviceIds: string[]) =>
    api.post('/software/deploy', { packageId, deviceIds }),
  listarDeploys: () => api.get('/software/deploys'),
};

// ── Patches ──
export const patchesApi = {
  listar: (deviceId: string, filtros?: any) => api.get(`/patches/device/${deviceId}`, { params: filtros }),
  resumo: () => api.get('/patches/resumo'),
  instalar: (id: string) => api.put(`/patches/${id}/instalar`),
  agendar: (id: string, agendadoPara: string) => api.put(`/patches/${id}/agendar`, { agendadoPara }),
};

// ── Audit ──
export const auditApi = {
  listar: (filtros?: any) => api.get('/audit', { params: filtros }),
};

// ── Notifications ──
export const notificationsApi = {
  listar: (naoLidas?: boolean) => api.get('/notifications', { params: { naoLidas } }),
  contar: () => api.get('/notifications/count'),
  marcarLida: (id: string) => api.put(`/notifications/${id}/read`),
  marcarTodasLidas: () => api.put('/notifications/read-all'),
};

// ── Reports ──
export const reportsApi = {
  executivo: () => api.get('/reports/executivo'),
  disponibilidade: () => api.get('/reports/disponibilidade'),
  agendamentos: () => api.get('/reports/agendamentos'),
  criarAgendamento: (dados: any) => api.post('/reports/agendamentos', dados),
};

// ── Roles ──
export const rolesApi = {
  listar: (tipo?: string) => api.get('/roles', { params: { tipo } }),
  buscar: (id: string) => api.get(`/roles/${id}`),
  permissions: (id: string) => api.get(`/roles/${id}/permissions`),
};

// ── Agents ──
export const agentsApi = {
  provision: () => api.post('/agents/provision'),
};

// ── Storage ──
export const storageApi = {
  upload: (file: File, entidadeTipo: string, entidadeId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/storage/upload?entidadeTipo=${entidadeTipo}&entidadeId=${entidadeId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getUrl: (id: string) => api.get(`/storage/${id}/url`),
  listarPorEntidade: (tipo: string, id: string) => api.get(`/storage/entidade/${tipo}/${id}`),
  deletar: (id: string) => api.delete(`/storage/${id}`),
};

// ── LGPD ──
export const lgpdApi = {
  solicitacoes: () => api.get('/lgpd/solicitacoes'),
  criarSolicitacao: (dados: any) => api.post('/lgpd/solicitacoes', dados),
  consentimentos: () => api.get('/lgpd/consentimentos'),
};

export default api;
