'use client'

import { useState, useCallback } from 'react'
import Cropper, { Area, Point } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { X, Loader2, ZoomIn } from 'lucide-react'
import { getCroppedImg } from '@/lib/get-cropped-img'

type Props = {
  imageSrc: string
  onCancel: () => void
  onConfirm: (blob: Blob) => Promise<void>
}

export default function ProfilePhotoCropDialog({ imageSrc, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels_: Area) => {
    setCroppedAreaPixels(croppedAreaPixels_)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setErr('')
    setSaving(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, 512, 0.9)
      await onConfirm(blob)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Não foi possível processar a imagem')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Ajustar foto de perfil</h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="px-4 pt-3 text-sm text-gray-600">
          Arraste para centralizar e use o zoom para enquadrar o rosto. A foto será guardada em formato circular no perfil.
        </p>

        <div className="relative w-full h-[280px] bg-gray-900 mt-3">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-3 border-t border-gray-100">
          <ZoomIn className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-2 accent-brand-500"
          />
        </div>

        {err && <p className="px-4 pb-2 text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !croppedAreaPixels}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Aplicar e enviar
          </button>
        </div>
      </div>
    </div>
  )
}
