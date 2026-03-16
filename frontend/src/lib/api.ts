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
  reativarCliente: (id: string) => api.put(`/users/clients/${id}/reativar`),
  convidarCliente: (id: string) => api.post(`/users/clients/${id}/invite`),
};

// ── Technicians (Técnicos Maginf) ──
export const techniciansApi = {
  listar: (filtros?: any) => api.get('/users/technicians', { params: filtros }),
  buscar: (id: string) => api.get(`/users/technicians/${id}`),
  criar: (dados: any) => api.post('/users/technicians', dados),
  atualizar: (id: string, dados: any) => api.put(`/users/technicians/${id}`, dados),
  desativar: (id: string) => api.delete(`/users/technicians/${id}`),
  reativar: (id: string) => api.put(`/users/technicians/${id}/reativar`),
  contagem: () => api.get('/users/technicians/contagem'),
};

// ── Devices ──
export const devicesApi = {
  listar: (filtros?: any) => api.get('/devices', { params: filtros }),
  buscar: (id: string) => api.get(`/devices/${id}`),
  resumo: () => api.get('/devices/resumo'),
  atualizar: (id: string, dados: any) => api.put(`/devices/${id}`, dados),
  remover: (id: string) => api.delete(`/devices/${id}`),
  inventario: (id: string, tipo?: string) => api.get(`/devices/${id}/inventario`, { params: tipo ? { tipo } : {} }),
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
  timeline: (id: string, limit?: number, offset?: number) =>
    api.get(`/tickets/${id}/timeline`, { params: { limit, offset } }),
  resumo: (id: string) => api.get(`/tickets/${id}/resumo`),
  atribuir: (id: string, technicianId: string, technicianNome: string) =>
    api.put(`/tickets/${id}/atribuir`, { technicianId, technicianNome }),
  resolver: (id: string) => api.put(`/tickets/${id}/resolver`),
  fechar: (id: string) => api.put(`/tickets/${id}/fechar`),
  reabrir: (id: string) => api.put(`/tickets/${id}/reabrir`),
  cancelar: (id: string) => api.put(`/tickets/${id}/cancelar`),
  aguardarCliente: (id: string) => api.put(`/tickets/${id}/aguardar-cliente`),
  aguardarTecnico: (id: string) => api.put(`/tickets/${id}/aguardar-tecnico`),
  comentar: (id: string, conteudo: string, visivelCliente?: boolean) =>
    api.post(`/tickets/${id}/comentario`, { conteudo, visivelCliente }),
  notaInterna: (id: string, conteudo: string) =>
    api.post(`/tickets/${id}/nota-interna`, { conteudo }),
  avaliar: (id: string, nota: number, comentario?: string) =>
    api.post(`/tickets/${id}/avaliar`, { nota, comentario }),
};

// ── Chat ──
export const chatApi = {
  mensagens: (ticketId: string, limit?: number, offset?: number) =>
    api.get(`/chat/tickets/${ticketId}/messages`, { params: { limit, offset } }),
  enviar: (ticketId: string, conteudo: string, arquivoUrl?: string, arquivoNome?: string, arquivoTamanho?: number) =>
    api.post(`/chat/tickets/${ticketId}/messages`, { conteudo, arquivoUrl, arquivoNome, arquivoTamanho }),
  marcarLida: (id: string) => api.put(`/chat/messages/${id}/read`),
  marcarTodasLidas: (ticketId: string) => api.put(`/chat/tickets/${ticketId}/read-all`),
  naoLidas: (ticketId: string) => api.get(`/chat/tickets/${ticketId}/unread`),
};

// ── Remote Sessions ──
export const sessionsApi = {
  listar: (filtros?: any) => api.get('/remote-sessions', { params: filtros }),
  buscar: (id: string) => api.get(`/remote-sessions/${id}`),
  solicitar: (dados: { deviceId: string; ticketId?: string; motivo?: string; gravarSessao?: boolean }) =>
    api.post('/remote-sessions', dados),
  estatisticas: () => api.get('/remote-sessions/estatisticas'),
  policy: (deviceId: string) => api.get(`/remote-sessions/device/${deviceId}/policy`),
  historicoDevice: (deviceId: string) => api.get(`/remote-sessions/device/${deviceId}/historico`),
  iniciar: (id: string, rustdeskSessionId?: string) =>
    api.put(`/remote-sessions/${id}/start`, { rustdeskSessionId }),
  finalizar: (id: string, dados?: { resumo?: string; gravacaoUrl?: string }) =>
    api.put(`/remote-sessions/${id}/end`, dados),
  cancelar: (id: string, motivo?: string) =>
    api.put(`/remote-sessions/${id}/cancel`, { motivo }),
  marcarErro: (id: string, erro: string) =>
    api.put(`/remote-sessions/${id}/error`, { erro }),
  consent: (id: string, consentido: boolean, dados?: any) =>
    api.put(`/remote-sessions/${id}/consent`, { consentido, ...dados }),
  logs: (id: string) => api.get(`/remote-sessions/${id}/logs`),
  registrarLog: (id: string, dados: { tipo: string; descricao: string; detalhes?: any; arquivoUrl?: string }) =>
    api.post(`/remote-sessions/${id}/log`, dados),
  evidencias: (id: string) => api.get(`/remote-sessions/${id}/evidencias`),
  registrarEvidencia: (id: string, dados: any) =>
    api.post(`/remote-sessions/${id}/evidencia`, dados),
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
  tecnico: () => api.get('/reports/tecnico'),
  disponibilidade: () => api.get('/reports/disponibilidade'),
  agendamentos: () => api.get('/reports/agendamentos'),
  criarAgendamento: (dados: any) => api.post('/reports/agendamentos', dados),
  exportDispositivos: (formato: 'csv' | 'json') => api.get('/reports/export/dispositivos', { params: { formato }, responseType: formato === 'csv' ? 'blob' : 'json' }),
  exportTickets: (formato: 'csv' | 'json') => api.get('/reports/export/tickets', { params: { formato }, responseType: formato === 'csv' ? 'blob' : 'json' }),
  exportSessoes: (formato: 'csv' | 'json') => api.get('/reports/export/sessoes', { params: { formato }, responseType: formato === 'csv' ? 'blob' : 'json' }),
  exportInventario: (formato: 'csv' | 'json') => api.get('/reports/export/inventario', { params: { formato }, responseType: formato === 'csv' ? 'blob' : 'json' }),
  exportAudit: (formato: 'csv' | 'json') => api.get('/reports/export/audit', { params: { formato }, responseType: formato === 'csv' ? 'blob' : 'json' }),
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
  processarSolicitacao: (id: string, dados: any) => api.put(`/lgpd/solicitacoes/${id}/processar`, dados),
  consentimentos: () => api.get('/lgpd/consentimentos'),
  registrarConsentimento: (dados: any) => api.post('/lgpd/consentimentos', dados),
  politicasRetencao: () => api.get('/lgpd/retencao/politicas'),
  executarLimpeza: () => api.post('/lgpd/retencao/executar'),
};

export default api;
