import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface SignaturePadProps {
  /** Receives a PNG data URL after each stroke, or null when cleared. */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Accessible label of the drawing area. */
  label?: string;
}

const HEIGHT = 160;
const INK = '#0f1b2d';

/** Draw-to-sign pad for mouse, pen or touch. It produces an image, not a certificate-based digital signature. */
export const SignaturePad = ({ onChange, disabled = false, invalid = false, label = 'Khung ký tên' }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const hasInkRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Match the bitmap to the displayed size (and pixel ratio) so strokes stay sharp; refit when the pad resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let cssWidth = 0;
    const fit = () => {
      const nextWidth = canvas.offsetWidth;
      if (nextWidth === cssWidth) return;
      const ratio = window.devicePixelRatio || 1;
      // Keep the existing strokes: the backing store is wiped whenever width/height are assigned.
      const snapshot = hasInkRef.current && cssWidth > 0 ? document.createElement('canvas') : null;
      if (snapshot) {
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
      }
      const previousWidth = cssWidth;
      cssWidth = nextWidth;
      canvas.width = nextWidth * ratio;
      canvas.height = HEIGHT * ratio;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(ratio, ratio);
      context.lineWidth = 2.2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = INK;
      if (!snapshot) return;
      context.drawImage(snapshot, 0, 0, previousWidth, HEIGHT);
      onChangeRef.current(canvas.toDataURL('image/png'));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Disabling the pad mid-stroke finishes that stroke so the parent still receives what was drawn.
  useEffect(() => {
    if (!disabled || !drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    hasInkRef.current = true;
    setHasInk(true);
    onChangeRef.current(canvas.toDataURL('image/png'));
  }, [disabled]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const end = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    hasInkRef.current = true;
    setHasInk(true);
    onChange(event.currentTarget.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border border-dashed bg-surface',
          invalid ? 'border-crit' : 'border-line-2',
          disabled && 'opacity-60',
        )}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className="block w-full touch-none cursor-crosshair"
          style={{ height: HEIGHT }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {hasInk ? null : (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-3">
            Ký tên bằng chuột hoặc ngón tay
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-line" aria-hidden />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">Chữ ký vẽ, lưu kèm người ký, thời điểm và lần trình; không phải ký số có chứng thư.</p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled || !hasInk}>
          <Eraser className="h-4 w-4" />
          Ký lại
        </Button>
      </div>
    </div>
  );
};
