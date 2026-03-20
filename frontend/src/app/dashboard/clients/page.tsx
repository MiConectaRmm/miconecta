'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Plus, Search, Monitor, Mail, Loader2 } from 'lucide-react'
import { tenantsApi, usersApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

export default function ClientsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [novoCliente, setNovoCliente] = useState({
    nome: '', razaoSocial: '', slug: '', email: '', cnpj: '', telefone: '',
    contatoPrincipal: '', cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '', enderecoLivre: '',
    inscricaoEstadual: '', atividadePrincipal: '', naturezaJuridica: '',
    porte: '', situacaoCadastral: '', dataAbertura: '', plano: 'basic',
    maxDispositivos: '50', maxUsuarios: '10',
  })
  const [portal, setPortal] = useState({
    criar: true,
    nome: '',
    email: '',
    senha: '',
    funcao: 'admin_cliente' as 'admin_cliente' | 'gestor' | 'usuario',
  })
  const [carregando, setCarregando] = useState(true)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjError, setCnpjError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => { carregar() }, [])

  const carregar = async () => {
    try {
      const { data } = await tenantsApi.listar()
      setTenants(data)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  const montarEndereco = () => {
    if (novoCliente.enderecoLivre?.trim()) return novoCliente.enderecoLivre.trim()
    const p = [novoCliente.logradouro, novoCliente.numero, novoCliente.complemento, novoCliente.bairro, novoCliente.cidade, novoCliente.uf, novoCliente.cep].filter(Boolean)
    return p.length ? p.join(', ') : undefined
  }

  const criarCliente = async () => {
    try {
      setSubmitLoading(true)
      setSubmitError('')
      const payload: Record<string, unknown> = {
        nome: novoCliente.nome,
        razaoSocial: novoCliente.razaoSocial || undefined,
        slug: novoCliente.slug,
        email: novoCliente.email || undefined,
        cnpj: novoCliente.cnpj?.replace(/[^\d]/g, '') || undefined,
        telefone: novoCliente.telefone || undefined,
        contatoPrincipal: novoCliente.contatoPrincipal || undefined,
        cep: novoCliente.cep || undefined,
        logradouro: novoCliente.logradouro || undefined,
        numero: novoCliente.numero || undefined,
        complemento: novoCliente.complemento || undefined,
        bairro: novoCliente.bairro || undefined,
        cidade: novoCliente.cidade || undefined,
        uf: novoCliente.uf || undefined,
        endereco: montarEndereco(),
        inscricaoEstadual: novoCliente.inscricaoEstadual || undefined,
        atividadePrincipal: novoCliente.atividadePrincipal || undefined,
        naturezaJuridica: novoCliente.naturezaJuridica || undefined,
        porte: novoCliente.porte || undefined,
        situacaoCadastral: novoCliente.situacaoCadastral || undefined,
        dataAbertura: novoCliente.dataAbertura || undefined,
        plano: novoCliente.plano,
        ativo: true,
      }
      const md = parseInt(novoCliente.maxDispositivos, 10)
      const mu = parseInt(novoCliente.maxUsuarios, 10)
      if (!Number.isNaN(md) && md > 0) payload.maxDispositivos = md
      if (!Number.isNaN(mu) && mu > 0) payload.maxUsuarios = mu

      const { data: tenant } = await tenantsApi.criar(payload)

      if (portal.criar && tenant?.id && portal.nome?.trim() && portal.email?.trim() && portal.senha?.length >= 6) {
        await usersApi.criarCliente(
          {
            nome: portal.nome.trim(),
            email: portal.email.trim().toLowerCase(),
            senha: portal.senha,
            funcao: portal.funcao,
          },
          tenant.id,
        )
      }

      setShowModal(false)
      resetForm()
      carregar()
    } catch (err) {
      console.error('Erro ao criar cliente:', err)
      const anyErr: any = err
      const msg = anyErr?.response?.data?.message || 'Erro ao criar cliente. Verifique os campos obrigatórios.'
      setSubmitError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
    finally {
      setSubmitLoading(false)
    }
  }

  const resetForm = () => {
    setNovoCliente({
      nome: '', razaoSocial: '', slug: '', email: '', cnpj: '', telefone: '',
      contatoPrincipal: '', cep: '', logradouro: '', numero: '', complemento: '',
      bairro: '', cidade: '', uf: '', enderecoLivre: '',
      inscricaoEstadual: '', atividadePrincipal: '', naturezaJuridica: '',
      porte: '', situacaoCadastral: '', dataAbertura: '', plano: 'basic',
      maxDispositivos: '50', maxUsuarios: '10',
    })
    setPortal({ criar: true, nome: '', email: '', senha: '', funcao: 'admin_cliente' })
    setCnpjError('')
    setSubmitError('')
  }

  const consultarCnpj = useCallback(async (cnpj: string) => {
    const limpo = cnpj.replace(/[^\d]/g, '')
    if (limpo.length !== 14) return

    setCnpjLoading(true)
    setCnpjError('')
    try {
      const { data } = await tenantsApi.consultarCnpj(limpo)
      const fantasia = data.nomeFantasia || data.razaoSocial || ''
      setNovoCliente(prev => ({
        ...prev,
        nome: fantasia || prev.nome,
        razaoSocial: data.razaoSocial || '',
        slug: (fantasia || prev.nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        email: data.email || prev.email,
        telefone: data.telefone || prev.telefone,
        cep: data.cep || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        uf: data.uf || '',
        atividadePrincipal: data.atividadePrincipal || '',
        naturezaJuridica: data.naturezaJuridica || '',
        porte: data.porte || '',
        situacaoCadastral: data.situacaoCadastral || '',
      }))
    } catch (err: any) {
      setCnpjError(err.response?.data?.message || 'CNPJ não encontrado')
    } finally {
      setCnpjLoading(false)
    }
  }, [])

  const handleCnpjChange = (value: string) => {
    const formatted = formatCnpjInput(value)
    setNovoCliente(prev => ({ ...prev, cnpj: formatted }))
    setCnpjError('')
    const limpo = formatted.replace(/[^\d]/g, '')
    if (limpo.length === 14) {
      consultarCnpj(limpo)
    }
  }

  const filtrados = tenants.filter(t =>
    !busca || t.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    t.slug?.toLowerCase().includes(busca.toLowerCase()) ||
    t.cnpj?.includes(busca) ||
    t.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cadastro de clientes (empresa)</h1>
          <p className="text-dark-400 text-sm mt-1">
            Cadastro empresarial completo (CNPJ, endereço, contrato). Opcionalmente crie o primeiro usuário do{' '}
            <strong className="text-dark-200">portal do cliente</strong> — ele verá apenas o parque tecnológico, tickets e chat da própria empresa.
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            placeholder="Buscar por nome, slug, CNPJ ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carregando ? (
          <div className="col-span-full card text-center py-12 text-dark-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="col-span-full card text-center py-12">
            <Building2 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum cliente encontrado</p>
          </div>
        ) : (
          filtrados.map((tenant: any) => (
            <Link key={tenant.id} href={`/dashboard/clients/${tenant.id}`} className="card hover:border-dark-600 transition-colors group cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-600/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium group-hover:text-brand-400 truncate">{tenant.nome}</h3>
                  <p className="text-dark-500 text-xs">{tenant.slug}</p>
                </div>
              </div>
              {tenant.cnpj && (
                <p className="text-dark-400 text-xs mb-1 font-mono">{tenant.cnpj}</p>
              )}
              {tenant.email && (
                <div className="flex items-center gap-2 text-xs text-dark-400 mb-2">
                  <Mail className="w-3 h-3" /> {tenant.email}
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-dark-400 text-xs">
                    <Monitor className="w-3.5 h-3.5" />
                    {tenant.organizacoes?.length || 0} orgs
                  </span>
                  {tenant.plano && (
                    <span className="text-dark-500 text-xs capitalize">{tenant.plano}</span>
                  )}
                </div>
                <StatusBadge status={tenant.ativo ? 'ativo' : 'suspenso'} />
              </div>
            </Link>
          ))
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo cliente — cadastro empresarial" size="lg">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* CNPJ - primeiro campo */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">CNPJ</label>
            <div className="relative">
              <input
                type="text"
                value={novoCliente.cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                className="input w-full pr-10"
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              {cnpjLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400 animate-spin" />
              )}
            </div>
            {cnpjError && <p className="text-red-400 text-xs mt-1">{cnpjError}</p>}
            {!cnpjError && novoCliente.razaoSocial && (
              <p className="text-green-400 text-xs mt-1">CNPJ encontrado - dados preenchidos automaticamente</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome Fantasia</label>
              <input
                type="text"
                value={novoCliente.nome}
                onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                className="input w-full"
                placeholder="Empresa LTDA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Razão Social</label>
              <input
                type="text"
                value={novoCliente.razaoSocial}
                onChange={(e) => setNovoCliente({ ...novoCliente, razaoSocial: e.target.value })}
                className="input w-full"
                placeholder="Razão Social Completa"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Slug</label>
              <input
                type="text"
                value={novoCliente.slug}
                onChange={(e) => setNovoCliente({ ...novoCliente, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="input w-full"
                placeholder="empresa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">E-mail</label>
              <input
                type="email"
                value={novoCliente.email}
                onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })}
                className="input w-full"
                placeholder="contato@empresa.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Telefone</label>
              <input
                type="text"
                value={novoCliente.telefone}
                onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                className="input w-full"
                placeholder="(11) 99999-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Contato Principal</label>
              <input
                type="text"
                value={novoCliente.contatoPrincipal}
                onChange={(e) => setNovoCliente({ ...novoCliente, contatoPrincipal: e.target.value })}
                className="input w-full"
                placeholder="Nome do responsável"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="border-t border-dark-700 pt-4 mt-4">
            <p className="text-xs uppercase tracking-wider text-dark-500 font-semibold mb-3">Endereço</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">CEP</label>
                <input type="text" value={novoCliente.cep} onChange={(e) => setNovoCliente({ ...novoCliente, cep: e.target.value })} className="input w-full" placeholder="00000-000" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Logradouro</label>
                <input type="text" value={novoCliente.logradouro} onChange={(e) => setNovoCliente({ ...novoCliente, logradouro: e.target.value })} className="input w-full" placeholder="Rua / Avenida" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Nº</label>
                <input type="text" value={novoCliente.numero} onChange={(e) => setNovoCliente({ ...novoCliente, numero: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Compl.</label>
                <input type="text" value={novoCliente.complemento} onChange={(e) => setNovoCliente({ ...novoCliente, complemento: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Bairro</label>
                <input type="text" value={novoCliente.bairro} onChange={(e) => setNovoCliente({ ...novoCliente, bairro: e.target.value })} className="input w-full" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Cidade</label>
                  <input type="text" value={novoCliente.cidade} onChange={(e) => setNovoCliente({ ...novoCliente, cidade: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">UF</label>
                  <input type="text" value={novoCliente.uf} onChange={(e) => setNovoCliente({ ...novoCliente, uf: e.target.value.toUpperCase() })} className="input w-full" maxLength={2} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Endereço (texto completo, opcional)</label>
            <textarea
              value={novoCliente.enderecoLivre}
              onChange={(e) => setNovoCliente({ ...novoCliente, enderecoLivre: e.target.value })}
              className="input w-full min-h-[72px]"
              placeholder="Se preencher, substitui a montagem automática a partir dos campos acima."
            />
          </div>

          <div className="border-t border-dark-700 pt-4 mt-4">
            <p className="text-xs uppercase tracking-wider text-dark-500 font-semibold mb-3">Dados fiscais e jurídicos</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Inscrição estadual</label>
                <input
                  type="text"
                  value={novoCliente.inscricaoEstadual}
                  onChange={(e) => setNovoCliente({ ...novoCliente, inscricaoEstadual: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Data de abertura</label>
                <input
                  type="date"
                  value={novoCliente.dataAbertura}
                  onChange={(e) => setNovoCliente({ ...novoCliente, dataAbertura: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Atividade principal</label>
                <input
                  type="text"
                  value={novoCliente.atividadePrincipal}
                  onChange={(e) => setNovoCliente({ ...novoCliente, atividadePrincipal: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Natureza jurídica</label>
                <input
                  type="text"
                  value={novoCliente.naturezaJuridica}
                  onChange={(e) => setNovoCliente({ ...novoCliente, naturezaJuridica: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Porte</label>
                <input
                  type="text"
                  value={novoCliente.porte}
                  onChange={(e) => setNovoCliente({ ...novoCliente, porte: e.target.value })}
                  className="input w-full"
                  placeholder="ME, EPP, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Situação cadastral</label>
                <input
                  type="text"
                  value={novoCliente.situacaoCadastral}
                  onChange={(e) => setNovoCliente({ ...novoCliente, situacaoCadastral: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-dark-700 pt-4 mt-4">
            <p className="text-xs uppercase tracking-wider text-dark-500 font-semibold mb-3">Plano e limites</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Plano</label>
                <select
                  value={novoCliente.plano}
                  onChange={(e) => setNovoCliente({ ...novoCliente, plano: e.target.value })}
                  className="input w-full"
                >
                  <option value="basic">Básico</option>
                  <option value="professional">Profissional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Máx. dispositivos</label>
                <input
                  type="number"
                  min={1}
                  value={novoCliente.maxDispositivos}
                  onChange={(e) => setNovoCliente({ ...novoCliente, maxDispositivos: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Máx. usuários portal</label>
                <input
                  type="number"
                  min={1}
                  value={novoCliente.maxUsuarios}
                  onChange={(e) => setNovoCliente({ ...novoCliente, maxUsuarios: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-dark-700 pt-4 mt-4">
            <p className="text-xs uppercase tracking-wider text-dark-500 font-semibold mb-2">Portal do cliente</p>
            <p className="text-dark-500 text-xs mb-3">
              Usuários do portal acessam apenas dados da própria empresa: dispositivos, tickets e chat. Não administram a plataforma Maginf.
            </p>
            <label className="flex items-center gap-2 text-sm text-dark-300 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={portal.criar}
                onChange={(e) => setPortal({ ...portal, criar: e.target.checked })}
                className="rounded border-dark-600"
              />
              Criar primeiro usuário do portal neste cadastro
            </label>
            {portal.criar && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome completo</label>
                  <input
                    type="text"
                    value={portal.nome}
                    onChange={(e) => setPortal({ ...portal, nome: e.target.value })}
                    className="input w-full"
                    placeholder="Responsável pelo portal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">E-mail (login)</label>
                  <input
                    type="email"
                    value={portal.email}
                    onChange={(e) => setPortal({ ...portal, email: e.target.value })}
                    className="input w-full"
                    placeholder="usuario@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Senha</label>
                  <input
                    type="password"
                    value={portal.senha}
                    onChange={(e) => setPortal({ ...portal, senha: e.target.value })}
                    className="input w-full"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Perfil no portal</label>
                  <select
                    value={portal.funcao}
                    onChange={(e) =>
                      setPortal({ ...portal, funcao: e.target.value as typeof portal.funcao })
                    }
                    className="input w-full"
                  >
                    <option value="admin_cliente">Administrador do cliente (gerencia usuários do portal)</option>
                    <option value="gestor">Gestor</option>
                    <option value="usuario">Usuário</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {submitError && (
            <p className="text-red-400 text-xs mt-1">{submitError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button
              onClick={criarCliente}
              className="btn-primary flex items-center gap-2"
              disabled={
                submitLoading ||
                !novoCliente.nome ||
                !novoCliente.slug ||
                !novoCliente.email ||
                (portal.criar &&
                  (!portal.nome?.trim() || !portal.email?.trim() || (portal.senha?.length || 0) < 6))
              }
            >
              {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar Cliente
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function formatCnpjInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0,2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`
}
