import { useState } from 'react';
import { toast } from 'sonner';
import type { Asset, AssetRecord, FloorKey, RepairStage, SelectedItem, ViewMode } from './types';
import { BLOCKS, FLOOR_TYPES, REPAIR_STAGES } from './constants';
import {
  getAssetRecord,
  transitionRepair,
  updateTaskField,
  uploadImage,
} from './repairRecords';

interface Props {
  block: string;
  floor: FloorKey;
  view: ViewMode;
  selected: SelectedItem | null;
  onClearSelection: () => void;
  onNewIncident: () => void;
  onGoBlock: (id: string) => void;
  onGoFloor: (floor: FloorKey) => void;
  onOpenChat: () => void;
  incidents: { id: string; title: string; priority: string; assetId: string | null; block: string }[];
  revision: number;
}

function RepairDetail({
  asset,
  floor,
  revision,
  onNewIncident,
  onChange,
}: {
  asset: Asset;
  floor: FloorKey;
  revision: number;
  onNewIncident: () => void;
  onChange: () => void;
}) {
  const [activeTaskId, setActiveTaskId] = useState('');
  // revision forces re-render when records change
  void revision;

  const rec: AssetRecord = getAssetRecord(asset, floor);
  const t = rec.tasks.find(x => x.id === activeTaskId) || rec.tasks.find(x => x.stage !== 'done') || rec.tasks[0];
  const stage = REPAIR_STAGES[asset.stage];
  const openCount = rec.tasks.filter(x => x.stage !== 'done').length;

  function handleTransition(next: RepairStage) {
    if (!t) return;
    const owner = (document.getElementById('repairOwner') as HTMLInputElement | null)?.value.trim() ?? '';
    const note = (document.getElementById('repairNote') as HTMLTextAreaElement | null)?.value.trim() ?? '';
    const result = transitionRepair(asset.id, t.id, next, owner, note);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(REPAIR_STAGES[next].label + ' · Đã lưu trong trình duyệt demo');
      onChange();
    }
  }

  function handleSave() {
    if (!t) return;
    const owner = (document.getElementById('repairOwner') as HTMLInputElement | null)?.value.trim() ?? '';
    const note = (document.getElementById('repairNote') as HTMLTextAreaElement | null)?.value.trim() ?? '';
    const contractor = (document.getElementById('repairContractor') as HTMLInputElement | null)?.value.trim() ?? '';
    const price = (document.getElementById('repairPrice') as HTMLInputElement | null)?.value ?? '';
    const deadline = (document.getElementById('repairDeadline') as HTMLInputElement | null)?.value ?? '';
    updateTaskField(asset.id, t.id, { owner, note, contractor, price, deadline });
    toast.success('Đã lưu hồ sơ demo');
  }

  function handleImageUpload(kind: 'before' | 'after', file: File) {
    if (!t) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 400000) {
      toast.error('Chọn ảnh JPG/PNG/WebP dưới 400 KB cho bản demo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (!uploadImage(asset.id, t.id, kind, reader.result as string)) {
        toast.error('Bộ nhớ demo đã đầy. Chưa lưu được ảnh.');
      } else {
        onChange();
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="text-sm">
      <p className="text-[10px] font-semibold text-[#718992] uppercase tracking-widest mb-1">Hồ sơ thiết bị · Dữ liệu mẫu</p>
      <h2 className="text-xl font-bold text-[#183343] mt-1">{asset.name}</h2>
      <p className="text-xs font-semibold text-[#657f87] mb-1">{asset.id}</p>
      <span
        className="inline-block rounded-full px-3 py-1 text-xs font-medium mb-3"
        style={{ color: stage.color, background: stage.color + '18' }}
      >
        {stage.label}
      </span>

      <div className="border-b border-[#edf1f1] pb-2 mb-1 flex justify-between text-xs">
        <span className="text-[#80939b]">Vị trí</span>
        <b className="text-right text-[#274b52]">Block {asset.zone.includes('Block') ? '' : ''}{FLOOR_TYPES[floor]}<br />{asset.zone}</b>
      </div>
      <div className="border-b border-[#edf1f1] pb-2 mb-3 flex justify-between text-xs">
        <span className="text-[#80939b]">Công việc chưa xong</span>
        <b className="text-[#274b52]">{openCount}</b>
      </div>

      {asset.shared && (
        <p className="text-xs bg-[#eef5f3] rounded-lg px-3 py-2 mb-3 text-[#44685e]">
          Thang máy dùng chung hồ sơ trên các tầng. Sự cố ghi riêng tầng xảy ra.
        </p>
      )}

      {rec.tasks.length > 1 && (
        <div className="mb-3">
          <label className="text-[10px] text-[#73858d] block mb-1">Chọn công việc</label>
          <select
            className="w-full border border-[#dce6e2] rounded-lg px-2 py-2 text-xs bg-white text-[#274b52]"
            value={t?.id ?? ''}
            onChange={e => setActiveTaskId(e.target.value)}
          >
            {rec.tasks.map(x => (
              <option key={x.id} value={x.id}>
                {x.title} · {REPAIR_STAGES[x.stage].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {t ? (
        <>
          <div className="bg-[#f7f9f9] rounded-lg p-3 mb-3">
            <p className="font-semibold text-xs text-[#183343]">{t.title}</p>
            <p className="text-[10px] text-[#81959e] mt-1">{t.id} · {t.location}</p>
            <p className="mt-1 text-xs font-medium" style={{ color: REPAIR_STAGES[t.stage].color }}>{REPAIR_STAGES[t.stage].label}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="text-[10px] text-[#73858d]">
              Người phụ trách
              <input id="repairOwner" defaultValue={t.owner} className="w-full border border-[#dce6e2] rounded-md px-2 py-1.5 text-xs mt-1 text-[#274b52]" />
            </label>
            <label className="text-[10px] text-[#73858d]">
              Hạn dự kiến
              <input id="repairDeadline" defaultValue={t.deadline} placeholder="dd/mm/yyyy" className="w-full border border-[#dce6e2] rounded-md px-2 py-1.5 text-xs mt-1 text-[#274b52]" />
            </label>
            <label className="text-[10px] text-[#73858d]">
              Nhà thầu
              <input id="repairContractor" defaultValue={t.contractor} className="w-full border border-[#dce6e2] rounded-md px-2 py-1.5 text-xs mt-1 text-[#274b52]" />
            </label>
            <label className="text-[10px] text-[#73858d]">
              Giá (VNĐ)
              <input id="repairPrice" type="number" min="0" defaultValue={t.price} className="w-full border border-[#dce6e2] rounded-md px-2 py-1.5 text-xs mt-1 text-[#274b52]" />
            </label>
            <label className="text-[10px] text-[#73858d] col-span-2">
              Ghi chú xử lý / nghiệm thu
              <textarea id="repairNote" defaultValue={t.note} placeholder="Ghi rõ kết quả kiểm tra…" className="w-full border border-[#dce6e2] rounded-md px-2 py-1.5 text-xs mt-1 text-[#274b52] resize-y min-h-[60px]" />
            </label>
          </div>

          {/* Evidence images */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(['before', 'after'] as const).map(kind => (
              <label key={kind} className="text-xs text-[#73858d]">
                {kind === 'before' ? 'Ảnh trước sửa' : 'Ảnh sau sửa'}
                {t[kind] ? (
                  <img src={t[kind]} alt={kind} className="w-full h-20 object-cover rounded-md mt-1" />
                ) : (
                  <div className="w-full h-20 bg-[#f2f5f4] rounded-md mt-1 flex items-center justify-center text-[10px] text-[#82968e]">Chưa có ảnh</div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="text-[9px] mt-1 w-full"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(kind, f); }}
                />
              </label>
            ))}
          </div>

          <button
            className="w-full mb-2 bg-white border border-[#d9e4e5] text-[#345563] rounded-lg py-2 text-xs font-medium hover:bg-gray-50"
            onClick={handleSave}
          >
            Lưu thông tin
          </button>

          {t.stage === 'waiting' && (
            <button className="w-full mb-2 bg-[#087f70] text-white rounded-lg py-2 text-xs font-semibold hover:bg-[#076b5e]" onClick={() => handleTransition('active')}>
              Bắt đầu sửa
            </button>
          )}
          {t.stage === 'active' && (
            <button className="w-full mb-2 bg-[#087f70] text-white rounded-lg py-2 text-xs font-semibold hover:bg-[#076b5e]" onClick={() => handleTransition('review')}>
              Báo sửa xong → Chờ nghiệm thu
            </button>
          )}
          {t.stage === 'review' && (
            <>
              <button className="w-full mb-2 bg-[#087f70] text-white rounded-lg py-2 text-xs font-semibold hover:bg-[#076b5e]" onClick={() => handleTransition('done')}>
                BQL · Nghiệm thu đạt
              </button>
              <button className="w-full mb-2 bg-white border border-[#d9e4e5] text-[#345563] rounded-lg py-2 text-xs font-medium hover:bg-gray-50" onClick={() => handleTransition('active')}>
                Không đạt · Yêu cầu sửa lại
              </button>
            </>
          )}
          {t.stage === 'done' && (
            <div className="bg-[#f7f9f9] rounded-lg p-3 mb-2 text-xs">
              <p className="font-semibold text-[#198b77]">✓ Đã nghiệm thu</p>
              <p className="text-[10px] text-[#81959e] mt-1">Thiết bị vẫn cảnh báo nếu còn công việc khác chưa hoàn tất.</p>
            </div>
          )}

          {/* History */}
          <details className="mt-3 text-xs" open>
            <summary className="cursor-pointer font-semibold text-[#183343]">Lịch sử công việc ({t.history.length})</summary>
            <div className="mt-2 border-l-2 border-[#d6e7df] pl-3 space-y-2">
              {[...t.history].reverse().map((h, i) => (
                <div key={i}>
                  <p className="text-[10px] text-[#839990]">{h.date}</p>
                  <p className="text-xs text-[#274b52]">{h.text}</p>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="bg-[#f7f9f9] rounded-lg p-3 mb-3 text-xs">
          <p className="font-semibold">Chưa ghi nhận sự cố</p>
          <p className="text-[10px] text-[#81959e] mt-1">Chưa có dữ liệu kiểm tra thực tế.</p>
        </div>
      )}

      <button
        className="w-full mb-2 bg-[#087f70] text-white rounded-lg py-2 text-xs font-semibold hover:bg-[#076b5e]"
        onClick={onNewIncident}
      >
        + Ghi nhận sự cố
      </button>

      <p className="text-[10px] text-[#8a9da4] mt-2 leading-relaxed">
        Thao tác mô phỏng vai trò kỹ thuật / BQL. Lưu trên trình duyệt, chưa có phân quyền hoặc đồng bộ máy chủ.
      </p>
    </div>
  );
}

export function SpaceSidebar({
  block,
  floor,
  view,
  selected,
  onClearSelection,
  onNewIncident,
  onGoBlock,
  onGoFloor,
  onOpenChat,
  incidents,
  revision,
}: Props) {
  const [, forceUpdate] = useState(0);

  if (!selected) {
    if (block) {
      return (
        <div className="p-5 text-sm">
          <p className="text-[10px] font-semibold text-[#718992] uppercase tracking-widest">Block {block} · {FLOOR_TYPES[floor]}</p>
          <h2 className="text-xl font-bold text-[#183343] mt-2 mb-2">Không gian của bạn</h2>
          <p className="text-[#73858d] text-xs leading-relaxed mb-4">Chọn một khu vực hoặc chấm thiết bị trên mặt bằng để xem thông tin và công việc.</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-[#f4f8f7] rounded-xl p-3">
              <p className="text-[10px] text-[#7c9198]">Thiết bị mẫu</p>
              <p className="text-2xl font-bold text-[#183343] mt-1">4</p>
            </div>
            <div className="bg-[#f4f8f7] rounded-xl p-3">
              <p className="text-[10px] text-[#7c9198]">Sự cố vừa tạo</p>
              <p className="text-2xl font-bold text-[#183343] mt-1">{incidents.filter(i => i.block === block).length}</p>
            </div>
          </div>
          {view !== '3d' && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(Object.keys(FLOOR_TYPES) as FloorKey[]).map(f => (
                <button
                  key={f}
                  className="bg-white border border-[#d9e4e5] text-[#345563] rounded-lg py-2 text-xs hover:bg-gray-50"
                  onClick={() => onGoFloor(f)}
                >
                  {FLOOR_TYPES[f]}
                </button>
              ))}
            </div>
          )}
          <button className="w-full bg-white border border-[#d9e4e5] text-[#345563] rounded-lg py-2 text-xs font-medium hover:bg-gray-50 mb-2" onClick={() => onGoBlock('')}>
            ← Trở về toàn khu
          </button>
          <p className="text-[10px] text-[#8a9da4] leading-relaxed">Các tầng ngoài tầng 5 được dựng theo bố trí giả định để trải nghiệm demo.</p>
        </div>
      );
    }

    return (
      <div className="p-5 text-sm">
        <p className="text-[10px] font-semibold text-[#718992] uppercase tracking-widest">Một khu chung cư · 4 block</p>
        <h2 className="text-[22px] font-bold text-[#183343] mt-2 mb-2 leading-tight">Mọi không gian,<br />một góc nhìn.</h2>
        <p className="text-[#73858d] text-xs leading-relaxed mb-4">Chọn block để khám phá mặt bằng, thiết bị và hoạt động vận hành.</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[#f4f8f7] rounded-xl p-3">
            <p className="text-[10px] text-[#7c9198]">Block</p>
            <p className="text-2xl font-bold text-[#183343] mt-1">4</p>
          </div>
          <div className="bg-[#f4f8f7] rounded-xl p-3">
            <p className="text-[10px] text-[#7c9198]">Việc đang mở</p>
            <p className="text-2xl font-bold text-[#183343] mt-1">7</p>
          </div>
        </div>
        <div className="space-y-2">
          {BLOCKS.map(b => (
            <button
              key={b.id}
              className="w-full flex items-center gap-3 border border-[#e5ecec] rounded-xl p-3 bg-white hover:border-[#9eb8b5] text-left"
              onClick={() => onGoBlock(b.id)}
            >
              <span className="w-9 h-9 bg-[#e7f1ec] rounded-lg flex items-center justify-center font-bold text-[#2d7668]">{b.id}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs text-[#183343]">Block {b.id}</p>
                <p className="text-[10px] text-[#8a9da4]">{b.jobs} việc mở · {b.due} lịch bảo trì</p>
              </div>
              <span className="text-[#8fa6ac] text-sm">↗</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#8a9da4] mt-4 leading-relaxed">Mặt bằng minh họa. Thay bằng bản vẽ thật khi triển khai.</p>
      </div>
    );
  }

  if (selected.type === 'asset') {
    return (
      <div className="p-4 relative">
        <button className="absolute top-3 right-3 text-lg text-[#719099] bg-[#eff5f4] rounded-full w-8 h-8 flex items-center justify-center hover:bg-[#e0eae8]" onClick={onClearSelection} aria-label="Đóng">×</button>
        <RepairDetail
          asset={selected.data}
          floor={floor}
          revision={revision}
          onNewIncident={onNewIncident}
          onChange={() => forceUpdate(n => n + 1)}
        />
      </div>
    );
  }

  // zone selected
  return (
    <div className="p-5 text-sm">
      <button className="float-right text-lg text-[#719099] bg-[#eff5f4] rounded-full w-8 h-8 flex items-center justify-center hover:bg-[#e0eae8]" onClick={onClearSelection} aria-label="Đóng">×</button>
      <p className="text-[10px] font-semibold text-[#718992] uppercase tracking-widest mb-1">Khu vực đang chọn</p>
      <h2 className="text-xl font-bold text-[#183343] mt-1 mb-1">{selected.name}</h2>
      <p className="text-xs text-[#73858d] mb-3">{block ? 'Block ' + block + ' · ' + FLOOR_TYPES[floor] : 'Tiện ích chung toàn khu'}</p>
      <div className="bg-[#f7f9f9] rounded-lg p-3 mb-3 text-xs">
        <p className="font-semibold">Hồ sơ khu vực</p>
        <p className="text-[10px] text-[#81959e] mt-1">Chưa có sự cố trong dữ liệu mẫu khu vực này.</p>
      </div>
      <button className="w-full bg-[#087f70] text-white rounded-lg py-2.5 text-xs font-semibold hover:bg-[#076b5e] mb-2" onClick={onNewIncident}>
        + Ghi nhận sự cố
      </button>
      <button className="w-full bg-white border border-[#d9e4e5] text-[#345563] rounded-lg py-2.5 text-xs hover:bg-gray-50" onClick={onOpenChat}>
        Hỏi AI về khu vực
      </button>
    </div>
  );
}
