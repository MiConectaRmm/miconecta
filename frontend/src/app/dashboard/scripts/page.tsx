'use client'

import { useEffect, useState } from 'react'
import { Terminal, Plus, Play, Trash2, Edit } from 'lucide-react'
import { scriptsApi } from '@/lib/api'

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [scriptForm, setScriptForm] = useState({
    nome: '', descricao: '', tipo: 'powershell', conteudo: '', timeoutSegundos: 300,
  })

  useEffect(() => {
    carregarScripts()
  }, [])

  const carregarScripts = async () => {
    try {
      const { data } = await scriptsApi.listar()
      setScripts(data)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  const salvarScript = async () => {
    try {
      await scriptsApi.criar(scriptForm)
      setModalAberto(false)
      setScriptForm({ nome: '', descricao: '', tipo: 'powershell', conteudo: '', timeoutSegundos: 300 })
      carregarScripts()
    } catch (err) {
      console.error('Erro ao salvar script:', err)
    }
  }

  const removerScript = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este script?')) return
    try {
      await scriptsApi.remover(id)
      carregarScripts()
    } catch (err) {
      console.error('Erro ao remover script:', err)
    }
  }

  const tipoLabel: Record<string, string> = {
    powershell: 'PowerShell',
    cmd: 'CMD',
    batch: 'Batch',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Scripts</h1>
          <p className="text-dark-400 mt-1">Gerencie e execute scripts remotamente</p>
        </div>
        <button onClick={() => setModalAberto(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Script
        </button>
      </div>

      {/* Lista de Scripts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carregando ? (
          <div className="col-span-full text-center py-12 text-dark-400">Carregando...</div>
        ) : scripts.length === 0 ? (
          <div className="col-span-full card text-center py-12">
            <Terminal className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum script cadastrado</p>
          </div>
        ) : (
          scripts.map((script: any) => (
            <div key={script.id} className="card hover:border-dark-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-brand-400" />
                  <h3 className="text-white font-medium">{script.nome}</h3>
                </div>
                <span className="text-xs bg-dark-700 text-dark-300 px-2 py-0.5 rounded">
                  {tipoLabel[script.tipo] || script.tipo}
                </span>
              </div>
              <p className="text-dark-400 text-sm mb-4 line-clamp-2">{script.descricao || 'Sem descrição'}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {/* TODO: modal de execução */}}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Executar
                </button>
                <button
                  onClick={() => removerScript(script.id)}
                  className="text-dark-500 hover:text-red-400 transition-colors p-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Novo Script */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Novo Script</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={scriptForm.nome}
                  onChange={(e) => setScriptForm({ ...scriptForm, nome: e.target.value })}
                  className="input w-full"
                  placeholder="Nome do script"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Descrição</label>
                <input
                  type="text"
                  value={scriptForm.descricao}
                  onChange={(e) => setScriptForm({ ...scriptForm, descricao: e.target.value })}
                  className="input w-full"
                  placeholder="Descrição opcional"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Tipo</label>
                  <select
                    value={scriptForm.tipo}
                    onChange={(e) => setScriptForm({ ...scriptForm, tipo: e.target.value })}
                    className="input w-full"
                  >
                    <option value="powershell">PowerShell</option>
                    <option value="cmd">CMD</option>
                    <option value="batch">Batch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1.5">Timeout (s)</label>
                  <input
                    type="number"
                    value={scriptForm.timeoutSegundos}
                    onChange={(e) => setScriptForm({ ...scriptForm, timeoutSegundos: parseInt(e.target.value) })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Conteúdo do Script</label>
                <textarea
                  value={scriptForm.conteudo}
                  onChange={(e) => setScriptForm({ ...scriptForm, conteudo: e.target.value })}
                  className="input w-full h-48 font-mono text-sm"
                  placeholder="# Escreva seu script aqui..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setModalAberto(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={salvarScript} className="btn-primary">
                Salvar Script
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
