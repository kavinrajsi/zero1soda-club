'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ScannerState = 'starting' | 'scanning' | 'denied' | 'unsupported'

/** Shape of the Barcode Detection API, which TypeScript's DOM lib omits. */
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

const SCAN_INTERVAL_MS = 250

const STATUS_TEXT: Record<ScannerState, string> = {
  starting: 'Starting camera…',
  scanning: 'Point at the ticket QR code',
  denied: 'Camera blocked. Allow camera access, or type the code below.',
  unsupported: 'This browser has no camera access. Type the code below.',
}

/**
 * Reads a Club Zero1 check-in URL from the camera and routes to it. Uses the
 * native BarcodeDetector where it exists (Android Chrome) and falls back to
 * jsQR everywhere else, which is what iOS Safari needs.
 */
export default function QrScanner({ checkinPrefix }: { checkinPrefix: string }) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handledRef = useRef(false)

  const [state, setState] = useState<ScannerState>('starting')
  const [manualCode, setManualCode] = useState('')
  const [hint, setHint] = useState('')

  const handleValue = useCallback(
    (value: string) => {
      if (handledRef.current) return
      const token = tokenFromValue(value, checkinPrefix)
      if (!token) {
        setHint('That code is not a Club Zero1 ticket.')
        return
      }
      setHint('')
      handledRef.current = true
      router.push(`/checkin/${token}`)
    },
    [checkinPrefix, router]
  )

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unsupported')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
      } catch {
        setState('denied')
        return
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => undefined)
      setState('scanning')

      const detectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
        .BarcodeDetector
      const detector = detectorCtor ? new detectorCtor({ formats: ['qr_code'] }) : null
      const decodeFallback = detector ? null : (await import('jsqr')).default

      const tick = async () => {
        if (cancelled || handledRef.current) return
        const canvas = canvasRef.current
        if (!video.videoWidth || !canvas) return

        try {
          if (detector) {
            const codes = await detector.detect(video)
            if (codes[0]?.rawValue) handleValue(codes[0].rawValue)
          } else if (decodeFallback) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (!context) return
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            const frame = context.getImageData(0, 0, canvas.width, canvas.height)
            const found = decodeFallback(frame.data, frame.width, frame.height)
            if (found?.data) handleValue(found.data)
          }
        } catch {
          // A dropped frame is not worth surfacing; the next tick retries.
        }
      }

      timer = window.setInterval(tick, SCAN_INTERVAL_MS)
    }

    start()

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [handleValue])

  return (
    <div className="scanner">
      <div className="scanner__viewport">
        <video className="scanner__video" ref={videoRef} muted playsInline />
        <canvas className="scanner__canvas" ref={canvasRef} hidden />
        <div className="scanner__frame" aria-hidden="true" />
      </div>

      {/* A rejected code must report itself whatever the camera is doing. */}
      <p
        className={`scanner__status${hint ? ' scanner__status--warn' : ''}`}
        role="status"
      >
        {hint || STATUS_TEXT[state]}
      </p>

      <form
        className="scanner__manual"
        onSubmit={(event) => {
          event.preventDefault()
          handleValue(manualCode.trim())
        }}
      >
        <label className="scanner__label" htmlFor="scanner-code">
          Ticket code or link
        </label>
        <div className="scanner__row">
          <input
            id="scanner-code"
            className="scanner__input"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            placeholder="Paste from the ticket"
            autoComplete="off"
          />
          <button type="submit" className="scanner__submit">
            Check
          </button>
        </div>
      </form>
    </div>
  )
}

/** Accepts a full check-in URL, a /checkin/<token> path, or a bare token. */
function tokenFromValue(value: string, checkinPrefix: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const fromUrl = trimmed.startsWith('http')
    ? safePath(trimmed)
    : trimmed.startsWith('/')
      ? trimmed
      : null

  const path = fromUrl ?? `${checkinPrefix}${trimmed}`
  const marker = '/checkin/'
  const at = path.indexOf(marker)
  if (at === -1) return null

  const token = path.slice(at + marker.length).split(/[?#/]/)[0]
  return token && token.includes('.') ? token : null
}

function safePath(url: string): string | null {
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}
