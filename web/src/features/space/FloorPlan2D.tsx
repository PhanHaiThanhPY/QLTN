import { useRef, useState, useCallback } from 'react';
import type { Asset, FloorKey } from './types';
import { BLOCKS, STATUS_COLORS, STATUS_LABELS } from './constants';
import { REPAIR_STAGES } from './constants';

interface Props {
  block: string;
  floor: FloorKey;
  assets: Asset[];
  onPickBlock: (id: string) => void;
  onPickAsset: (id: string) => void;
  onPickZone: (name: string) => void;
}

const BLOCK_LAYOUT = [
  { id: 'A', x: 115, y: 110, c: '#d9e9e5' },
  { id: 'B', x: 660, y: 110, c: '#e4e5ef' },
  { id: 'C', x: 115, y: 355, c: '#e8ecdc' },
  { id: 'D', x: 660, y: 355, c: '#eee5d8' },
];

function esc(t: unknown): string {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function Overview({ onPickBlock, onPickZone }: { onPickBlock: (id: string) => void; onPickZone: (name: string) => void }) {
  return (
    <>
      {/* outer rings */}
      <rect x="45" y="40" width="910" height="515" rx="20" fill="#e9efdf" />
      <rect x="68" y="63" width="864" height="465" rx="20" fill="#dae2e1" />
      <rect x="102" y="94" width="796" height="397" rx="15" fill="#edf3e6" />
      <path d="M85 506H915" stroke="white" strokeWidth="2" strokeDasharray="14 12" />
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i * Math.PI * 2) / 32;
        return <circle key={i} cx={500 + 380 * Math.cos(a)} cy={285 + 185 * Math.sin(a)} r="9" fill="#bad0ac" opacity="0.65" />;
      })}
      {/* Pool */}
      <g className="cursor-pointer" role="button" tabIndex={0} onClick={() => onPickZone('pool')} onKeyDown={e => e.key === 'Enter' && onPickZone('pool')}>
        <rect x="392" y="135" width="215" height="118" rx="22" fill="#bee0e6" />
        <text x="448" y="170" fontSize="17" fill="#3d7a86" fontWeight="650">HỒ BƠI</text>
        <path d="M412 198q20-14 40 0t40 0t40 0t40 0" stroke="#90c5ce" fill="none" strokeWidth="3" />
      </g>
      {/* Garden */}
      <g className="cursor-pointer" role="button" tabIndex={0} onClick={() => onPickZone('garden')} onKeyDown={e => e.key === 'Enter' && onPickZone('garden')}>
        <rect x="392" y="282" width="215" height="99" rx="20" fill="#d3e3c3" />
        <text x="439" y="323" fontSize="17" fill="#5d7952" fontWeight="650">SÂN VƯỜN</text>
      </g>
      {/* Community */}
      <g className="cursor-pointer" role="button" tabIndex={0} onClick={() => onPickZone('community')} onKeyDown={e => e.key === 'Enter' && onPickZone('community')}>
        <rect x="399" y="405" width="201" height="55" rx="10" fill="#f7edd4" />
        <text x="415" y="438" fontSize="15" fill="#9a8150" fontWeight="650">Khu sinh hoạt chung</text>
      </g>
      {/* Blocks */}
      {BLOCK_LAYOUT.map(b => {
        const bdata = BLOCKS.find(x => x.id === b.id)!;
        return (
          <g
            key={b.id}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => onPickBlock(b.id)}
            onKeyDown={e => e.key === 'Enter' && onPickBlock(b.id)}
          >
            <rect x={b.x + 7} y={b.y + 8} width="226" height="145" rx="0" fill="#becdc6" />
            <rect x={b.x} y={b.y} width="226" height="145" rx="10" fill={b.c} stroke="#9fb4b0" strokeWidth="2" />
            <text x={b.x + 22} y={b.y + 40} fontSize="23" fill="#224b51" fontWeight="650">BLOCK {b.id}</text>
            <text x={b.x + 22} y={b.y + 67} fontSize="11" fill="#355761">Căn hộ &amp; không gian chung</text>
            {[0, 1, 2, 3, 4, 5].map(j => (
              <rect key={j} x={b.x + 22 + j * 30} y={b.y + 83} width="19" height="14" rx="3" fill="#ffffff90" />
            ))}
            <text x={b.x + 22} y={b.y + 124} fontSize="12" fill="#355761">
              {bdata.jobs} việc mở · {bdata.due} lịch bảo trì
            </text>
          </g>
        );
      })}
      <text x="405" y="531" fontSize="12" fill="#728891">ĐƯỜNG NỘI BỘ</text>
      {/* Gate */}
      <g className="cursor-pointer" role="button" tabIndex={0} onClick={() => onPickZone('gate')} onKeyDown={e => e.key === 'Enter' && onPickZone('gate')}>
        <rect x="452" y="540" width="96" height="35" rx="7" fill="white" stroke="#d0dadb" strokeWidth="1" />
        <text x="466" y="563" fontSize="12" fill="#355761">Cổng chính</text>
      </g>
      <text x="74" y="571" fontSize="13" fill="#728891">N ↑</text>
      <text x="769" y="552" fontSize="12" fill="#728891">↘ Lối xuống hầm</text>
    </>
  );
}

function FloorRooms({ block, floor }: { block: string; floor: FloorKey }) {
  const names5 = ['501', '502', '503', '504', '508', '507', '506', '505'].map(n => block + n);
  const namesB1 = ['Bãi xe 1', 'Bãi xe 2', 'Bãi xe 3', 'Kho kỹ thuật', 'Phòng bơm', 'Máy phát', 'Phòng điện', 'Bãi xe 4'];
  const namesG = ['Phòng BQL', 'Sinh hoạt chung', 'Khu thư tín', 'WC', 'Sảnh đón', 'Khu chờ', 'Dịch vụ', 'Sảnh phụ'];
  const namesR = ['Bồn nước 1', 'Bồn nước 2', 'Sân mái 1', 'Kho kỹ thuật', 'Khu máy', 'Sân mái 2', 'Kỹ thuật', 'Sân mái 3'];
  const names = floor === '5' ? names5 : floor === 'B1' ? namesB1 : floor === 'G' ? namesG : namesR;
  const subtitles = floor === '5' ? 'Căn hộ mẫu' : 'Khu vực chung';

  return (
    <>
      {names.map((name, j) => {
        const x = 60 + (j % 4) * 220;
        const y = j < 4 ? 82 : 370;
        return (
          <g key={j} data-room={j}>
            <rect x={x} y={y} width="220" height="148" fill="#7a98a0" />
            <rect x={x} y={y} width="220" height="148" fill="#e5eef0" stroke="#7a98a0" strokeWidth="1" />
            <text x={x + 18} y={y + 32} fontSize="18" fill="#365c69" fontWeight="650">{esc(name)}</text>
            <text x={x + 18} y={y + 52} fontSize="10" fill="#557080">{subtitles}</text>
            {floor === '5' && (
              <>
                <path d={`M${x + 140} ${y + 75}V${y + 148}M${x + 140} ${y + 100}H${x + 220}`} stroke="#bfd0d6" fill="none" />
                <rect x={x + 20} y={y + 75} width="75" height="40" rx="3" fill="white" />
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

export function FloorPlan2D({ block, floor, assets, onPickBlock, onPickAsset, onPickZone }: Props) {
  const [vb, setVb] = useState({ x: 0, y: 0, w: 1000, h: 600 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  const applyZoom = useCallback((factor: number) => {
    setVb(prev => {
      const w = Math.min(1800, Math.max(280, prev.w / factor));
      const h = w * 0.6;
      return { x: prev.x + (prev.w - w) / 2, y: prev.y + (prev.h - h) / 2, w, h };
    });
  }, []);

  const resetZoom = useCallback(() => setVb({ x: 0, y: 0, w: 1000, h: 600 }), []);

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as Element).closest('button,g[role="button"]')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPos.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const old = [...pointers.current.values()];
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const next = [...pointers.current.values()];
      const before = Math.hypot(old[0].x - old[1].x, old[0].y - old[1].y);
      const after = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y);
      if (before > 0) applyZoom(after / before);
      draggedRef.current = true;
    } else if (lastPos.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) draggedRef.current = true;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setVb(prev => ({
        x: prev.x - (dx * prev.w) / rect.width,
        y: prev.y - (dy * prev.h) / rect.height,
        w: prev.w,
        h: prev.h,
      }));
    }
    lastPos.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    lastPos.current = null;
    setTimeout(() => { draggedRef.current = false; }, 50);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    applyZoom(e.deltaY < 0 ? 1.12 : 0.89);
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (draggedRef.current) return;
    const target = (e.target as SVGElement).closest<SVGElement>('[data-block],[data-asset],[data-room],[data-zone]');
    if (!target) return;
    if (target.dataset.block) onPickBlock(target.dataset.block);
    else if (target.dataset.asset) onPickAsset(target.dataset.asset);
    else if (target.dataset.zone) onPickZone(target.dataset.zone);
    else if (target.dataset.room) {
      const roomIdx = parseInt(target.dataset.room);
      if (floor === '5') {
        const roomNums = [501, 502, 503, 504, 508, 507, 506, 505];
        onPickZone(`Căn ${block}${roomNums[roomIdx]}`);
      } else {
        onPickZone(`Khu vực ${roomIdx + 1}`);
      }
    }
  }

  const isFloor = !!block;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#f6f9f8] touch-none select-none">
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full h-full"
        onClick={handleSvgClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        role="img"
        aria-label="Sơ đồ khu chung cư"
        style={{ fontFamily: 'system-ui, Arial, sans-serif' }}
      >
        {isFloor ? (
          <>
            {/* Floor plan */}
            <FloorRooms block={block} floor={floor} />
            {/* Corridor */}
            <rect x="60" y="232" width="880" height="136" fill="#fafcfc" />
            <text x="290" y="350" fontSize="13" fill="#728891">HÀNH LANG CHUNG · CHỌN THIẾT BỊ ĐỂ XEM</text>
            {/* Stair wells */}
            {[64, 825].map((sx, si) => (
              <g key={si} data-zone="stairs" className="cursor-pointer">
                <rect x={sx} y="239" width="111" height="60" rx="4" fill="#e1e6ea" stroke="#8aa1ab" strokeWidth="1" />
                <text x={sx + 13} y="260" fontSize="12" fill="#557080">Thang bộ</text>
                <path d={`M${sx + 15} 273h80m-80 8h80m-80 8h80`} stroke="#aebcc7" strokeWidth="3" fill="none" />
              </g>
            ))}
            {/* Elevator */}
            <rect x="416" y="239" width="156" height="67" rx="4" fill="#d8e9e4" stroke="#809c93" strokeWidth="1" />
            <text x="430" y="259" fontSize="12" fill="#557080">Sảnh thang máy</text>
            <rect x="430" y="269" width="55" height="26" rx="3" fill="white" />
            <rect x="500" y="269" width="55" height="26" rx="3" fill="white" />
            {/* Tech room */}
            <g data-zone="tech" className="cursor-pointer">
              <rect x="714" y="239" width="101" height="67" rx="4" fill="#f3e8d5" stroke="#ad9d80" strokeWidth="1" />
              <text x="727" y="261" fontSize="12" fill="#8b6a40">Kỹ thuật</text>
            </g>
            {/* Asset markers */}
            {assets.map(a => {
              const color = REPAIR_STAGES[a.stage]?.color ?? STATUS_COLORS[a.status];
              return (
                <g key={a.id} data-asset={a.id} className="cursor-pointer">
                  <circle cx={a.x} cy={a.y} r="14" fill={color} stroke="white" strokeWidth="3" />
                  <circle cx={a.x} cy={a.y} r="4" fill="white" />
                  <text x={a.x - 18} y={a.y + 29} fontSize="10" fill="#355761">
                    {a.code.replace(/-0(\d)/g, '-$1')}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          <Overview onPickBlock={onPickBlock} onPickZone={onPickZone} />
        )}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex bg-white shadow border border-[#e1e8e9] rounded-lg overflow-hidden z-10">
        <button className="px-3 py-2 text-sm text-[#325360] hover:bg-gray-50" onClick={() => applyZoom(1.25)} aria-label="Phóng to">+</button>
        <button className="px-3 py-2 text-sm text-[#325360] hover:bg-gray-50 border-l border-[#edf1f1]" onClick={() => applyZoom(0.8)} aria-label="Thu nhỏ">−</button>
        <button className="px-3 py-2 text-sm text-[#325360] hover:bg-gray-50 border-l border-[#edf1f1]" onClick={resetZoom} aria-label="Vừa màn hình">⤢</button>
      </div>

      {/* Legend */}
      {isFloor && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-3 flex-wrap px-4 py-2 bg-white/90 border-t border-[#edf1f1] text-[11px] text-[#728891]">
          {Object.entries(REPAIR_STAGES).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <i className="inline-block w-2 h-2 rounded-full" style={{ background: v.color }} />
              {v.label}
            </span>
          ))}
        </div>
      )}
      {!isFloor && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-4 flex-wrap px-4 py-2 bg-white/90 border-t border-[#edf1f1] text-[11px] text-[#728891]">
          {Object.entries(STATUS_COLORS).map(([k, color]) => (
            <span key={k} className="flex items-center gap-1">
              <i className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
              {STATUS_LABELS[k as keyof typeof STATUS_LABELS]}
            </span>
          ))}
        </div>
      )}
      <p className="absolute bottom-8 left-3 text-[11px] text-[#7b919a] pointer-events-none hidden sm:block">
        Kéo để di chuyển · Phóng to bằng hai ngón tay
      </p>
    </div>
  );
}
