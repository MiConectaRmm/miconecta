'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { storageApi, authApi } from '@/lib/api'
import ProfilePhotoCropDialog from '@/components/ProfilePhotoCropDialog'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, setUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [nome, setNome] = useState(user?.nome || '')
  const [email, setEmail] = useState(user?.email || '')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirmar, setSenhaConfirmar] = useState('')
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showSenhaNova, setShowSenhaNova] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhotoUrl || '')
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      setNome(user.nome || '')
      setEmail(user.email || '')
      setPhotoPreview(user.profilePhotoUrl || '')
    }
  }, [isOpen, user])

  useEffect(() => {
    return () => {
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    }
  }, [cropImageSrc])

  if (!isOpen) return null

  const closeCrop = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    setCropImageSrc(null)
  }

  const handlePhotoFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Arquivo deve ser uma imagem')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Imagem deve ter no máximo 8MB (será comprimida ao ajustar)')
      return
    }

    setError('')
    setCropImageSrc(URL.createObjectURL(file))
  }

  const handleCroppedBlob = async (blob: Blob) => {
    if (!user?.id) return
    setUploadingPhoto(true)
    setError('')
    try {
      const file = new File([blob], 'perfil.jpg', { type: 'image/jpeg' })
      const { data } = await storageApi.upload(file, 'user_profile', user.id)
      const url = data?.url as string | undefined
      if (url) {
        await authApi.updateProfile({ profilePhotoUrl: url })
        const { data: me } = await authApi.me()
        setUser(me)
        setPhotoPreview(me.profilePhotoUrl || url)
      }
      setSuccess('Foto atualizada com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
      closeCrop()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao fazer upload da foto')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const updates: any = {}
      
      if (nome !== user?.nome) updates.nome = nome
      if (email !== user?.email) updates.email = email
      
      if (senhaNova) {
        if (senhaNova !== senhaConfirmar) {
          setError('As senhas não coincidem')
          setLoading(false)
          return
        }
        if (senhaNova.length < 6) {
          setError('A senha deve ter no mínimo 6 caracteres')
          setLoading(false)
          return
        }
        updates.senhaAtual = senhaAtual
        updates.senhaNova = senhaNova
      }

      if (Object.keys(updates).length > 0) {
        await authApi.updateProfile(updates)
        const { data: updatedUser } = await authApi.me()
        setUser(updatedUser)
        setSuccess('Perfil atualizado com sucesso!')
        setSenhaAtual('')
        setSenhaNova('')
        setSenhaConfirmar('')
        setTimeout(() => {
          setSuccess('')
          onClose()
        }, 2000)
      } else {
        setSuccess('Nenhuma alteração para salvar')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao atualizar perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      {cropImageSrc && (
        <ProfilePhotoCropDialog
          imageSrc={cropImageSrc}
          onCancel={closeCrop}
          onConfirm={handleCroppedBlob}
        />
      )}
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Meu Perfil</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Messages */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {success}
            </div>
          )}

          {/* Foto de perfil */}
          <div className="flex flex-col items-center gap-4 pb-6 border-b border-gray-200">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  user?.nome?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'
                )}
              </div>
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChosen}
                className="hidden"
                disabled={uploadingPhoto || !!cropImageSrc}
              />
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" />
                Alterar foto
              </div>
            </label>
            <p className="text-xs text-gray-500 text-center max-w-xs">
              Escolha uma imagem; depois ajuste o enquadramento e o zoom antes de enviar. JPG/PNG até 8MB.
            </p>
          </div>

          {/* Informações pessoais */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Informações Pessoais</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                required
              />
            </div>
          </div>

          {/* Segurança */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Alterar Senha</h3>
            <p className="text-xs text-gray-500">Deixe em branco se não quiser alterar a senha</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha atual
              </label>
              <div className="relative">
                <input
                  type={showSenhaAtual ? 'text' : 'password'}
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSenhaAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showSenhaNova ? 'text' : 'password'}
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                  className="input w-full pr-10"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowSenhaNova(!showSenhaNova)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showSenhaNova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={senhaConfirmar}
                onChange={(e) => setSenhaConfirmar(e.target.value)}
                className="input w-full"
                minLength={6}
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
