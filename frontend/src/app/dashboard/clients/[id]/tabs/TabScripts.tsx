'use client'

import { useEffect, useState } from 'react'
import { Terminal, Plus, Trash2, Play } from 'lucide-react'
import { scriptsApi, devicesApi } from '@/lib/api'
import Modal from '@/components/ui/Modal'

interface Props {
  tenantId: string
}

export default function TabScripts({ tenantId }: Props) {
  const [scripts, setScripts] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [executarModal, setExecutarModal] = useState<any>(null)
  const [devicesSelecionados, setDevicesSelecionados] = useState<string[]>([])
  const [form, setForm] = useState({ nome: '', descricao: '', tipo: 'powershell', conteudo: '', timeoutSegundos: 300 })

  useEffect(() => { carregar() }, [tenantId])

  const carregar = async () => {
    try {
      const [scriptsRes, devRes] = await Promise.allSettled([
        scriptsApi.listar(),
        devicesApi.listar({ tenantId }),
      ])
      if (scriptsRes.status === 'fulfilled') {
        const d = scriptsRes.value.data
        setScripts(Array.isArray(d) ? d : d?.items || [])
      }
      if (devRes.status === 'fulfilled') {
        const d = devRes.value.data
        setDevices(Array.isArray(d) ? d : d?.items || [])
      }
    } catch {} finally { setCarregando(false) }
  }

  const salvar = async () => {
    try {
      await scriptsApi.criar(form)
      setModalAberto(false)
      setForm({ nome: '', descricao: '', tipo: 'powershell', conteudo: '', timeoutSegundos: 300 })
      carregar()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar script')
    }
  }

  const remover = async (id: string) => {
    if (!confirm('Remover este script?')) return
    try { await scriptsApi.remover(id); carregar() } catch {}
  }

  const executar = async () => {
    if (!executarModal || devicesSelecionados.length === 0) return
    try {
      await scriptsApi.executar(executarModal.id, devicesSelecionados)
      alert(`Script executado em ${devicesSelecionados.length} dispositivo(s)`)
      setExecutarModal(null)
      setDevicesSelecionados([])
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao executar script')
    }
  }

  const tipoLabel: Record<string, string> = { powershell: 'PowerShell', cmd: 'CMD', batch: 'Batch' }
  const devicesOnline = devices.filter(d => d.status === 'online')

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando scripts...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-dark-400 text-sm">Scripts remotos disponíveis para os dispositivos deste cliente</p>
        <button onClick={() => setModalAberto(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Novo Script
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="card text-center py-12">
          <Terminal className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Nenhum script cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script: any) => (
            <div key={script.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium">{script.nome}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-dark-700 text-dark-300">{tipoLabel[script.tipo] || script.tipo}</span>
              </div>
              <p className="text-dark-400 text-sm mb-3 line-clamp-2">{script.descricao || 'Sem descrição'}</p>
              <pre className="bg-dark-950 border border-dark-700 rounded p-2 text-xs text-dark-300 font-mono max-h-24 overflow-auto mb-3">{script.conteudo?.slice(0, 200)}{script.conteudo?.length > 200 ? '...' : ''}</pre>
              <div className="flex items-center gap-2">
                <button onClick={() => { setExecutarModal(script); setDevicesSelecionados([]) }}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                  <Play className="w-3.5 h-3.5" /> Executar
                </button>
                <button onClick={() => remover(script.id)} className="text-xs text-red-400 hover:text-red-300 py-1.5 px-3">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar script */}
      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title="Novo Script" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome</label>
              <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input w-full" placeholder="Nome do script" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input w-full">
                <option value="powershell">PowerShell</option>
                <option value="cmd">CMD</option>
                <option value="batch">Batch</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Descrição</label>
            <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="input w-full" placeholder="Breve descrição" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Conteúdo</label>
            <textarea value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} className="input w-full h-40 resize-none font-mono text-sm" placeholder="Código do script..." />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
            <button onClick={() => setModalAberto(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} className="btn-primary" disabled={!form.nome || !form.conteudo}>Criar Script</button>
          </div>
        </div>
      </Modal>

      {/* Modal executar */}
      <Modal isOpen={!!executarModal} onClose={() => setExecutarModal(null)} title={`Executar: ${executarModal?.nome || ''}`} size="lg">
        <div className="space-y-4">
          <p className="text-dark-400 text-sm">Selecione os dispositivos online deste cliente:</p>
          {devicesOnline.length === 0 ? (
            <p className="text-dark-500 text-sm text-center py-4">Nenhum dispositivo online</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {devicesOnline.map(d => (
                <label key={d.id} className="flex items-center gap-3 p-2 bg-dark-800/50 rounded-lg hover:bg-dark-700/50 cursor-pointer">
                  <input type="checkbox" checked={devicesSelecionados.includes(d.id)}
                    onChange={(e) => setDevicesSelecionados(e.target.checked
                      ? [...devicesSelecionados, d.id]
                      : devicesSelecionados.filter(x => x !== d.id))}
                    className="rounded border-dark-600" />
                  <span className="text-sm text-white">{d.hostname}</span>
                  <span className="text-xs text-dark-500">{d.ipLocal}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
            <button onClick={() => setExecutarModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={executar} className="btn-primary" disabled={devicesSelecionados.length === 0}>
              Executar em {devicesSelecionados.length} dispositivo(s)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
