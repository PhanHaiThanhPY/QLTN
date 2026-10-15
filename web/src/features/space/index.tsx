import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type { Asset, FloorKey, IncidentRecord, RepairStage, SelectedItem, ViewMode } from './types';
import { BLOCKS, FLOOR_TYPES, REPAIR_STAGES } from './constants';
import { getDeviceDefinitions, getZoneLayout } from './deviceDefinitions';
import { buildAsset, addIncidentTask, resetRepairDemo } from './repairRecords';
import { ThreeCanvas } from './ThreeCanvas';
import { FloorPlan2D } from './FloorPlan2D';
import { SpaceSidebar } from './SpaceSidebar';
import { IncidentModal } from './IncidentModal';

const STORAGE_INCIDENTS = 'condoIncidents';

function loadIncidents(): IncidentRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_INCIDENTS) ?? '[]') as IncidentRecord[]; }
  catch { return []; }
}

function saveIncidents(list: IncidentRecord[]) {
  try { localStorage.setItem(STORAGE_INCIDENTS, JSON.stringify(list)); } catch { /* ignore */ }
}

export default function SpacePage() {
  const [block, setBlock] = useState('');
  const [floor, setFloor] = useState<FloorKey>('5');
  const [view, setView] = useState<ViewMode>('3d');
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [repairFilter, setRepairFilter] = useState<RepairStage | 'all'>('all');
  const [repairQuery, setRepairQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [incidents, setIncidents] = useState<IncidentRecord[]>(loadIncidents);
  const [revision, setRevision] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  // Derived data
  const allDefs = useMemo(() => (block ? getDeviceDefinitions(block, floor) : []), [block, floor]);
  const allAssets: Asset[] = useMemo(() => allDefs.map(d => buildAsset(d, floor)), [allDefs, floor, revision]);

  const visibleAssets = useMemo(() => {
    return allAssets.filter(a => {
      const matchFilter = repairFilter === 'all' || a.stage === repairFilter;
      const matchQuery = !repairQuery || (a.name + ' ' + a.id).toLowerCase().includes(repairQuery.toLowerCase());
      return matchFilter && matchQuery;
    });
  }, [allAssets, repairFilter, repairQuery]);

  const zones = useMemo(() => (block ? getZoneLayout(floor, block) : []), [block, floor]);

  // Navigation helpers
  const goBlock = useCallback((id: string) => {
    setBlock(id);
    setSelected(null);
    if (id) {
      setView('floor3d');
    } else {
      setView('3d');
    }
  }, []);

  const goFloor = useCallback((f: FloorKey) => {
    setFloor(f);
    setSelected(null);
    setView('floor3d');
  }, []);

  const handlePickBlock = useCallback((id: string) => {
    setBlock(id);
    setSelected(null);
    setView('floor3d');
  }, []);

  const handlePickAsset = useCallback((id: string) => {
    const asset = allAssets.find(a => a.id === id);
    if (asset) setSelected({ type: 'asset', data: asset });
  }, [allAssets]);

  const handlePickZone = useCallback((name: string) => {
    setSelected({ type: 'zone', name });
  }, []);

  // Incident modal
  const locationLabel = useMemo(() => {
    const prefix = block ? `Block ${block} / ${FLOOR_TYPES[floor]} / ` : 'Toàn khu / ';
    if (selected?.type === 'asset') return prefix + selected.data.name;
    if (selected?.type === 'zone') return prefix + selected.name;
    return prefix + 'Khu vực chung';
  }, [block, floor, selected]);

  function handleSaveIncident(data: { title: string; description: string; priority: string }) {
    const item: IncidentRecord = {
      id: 'SC-' + String(Date.now()).slice(-6),
      title: data.title,
      description: data.description,
      priority: data.priority,
      location: locationLabel,
      block,
      assetId: selected?.type === 'asset' ? selected.data.id : null,
    };
    const next = [...incidents, item];
    setIncidents(next);
    saveIncidents(next);
    if (item.assetId) {
      addIncidentTask(item.assetId, { id: item.id, title: item.title, description: item.description, floor });
      setRevision(r => r + 1);
    }
    setModalOpen(false);
    toast.success(`Đã tạo ${item.id} · Lưu trong trình duyệt demo`);
  }

  // AI chat helper
  const context =
    selected?.type === 'asset'
      ? selected.data.name
      : selected?.type === 'zone'
      ? selected.name
      : block
      ? `Block ${block} / ${FLOOR_TYPES[floor]}`
      : 'toàn khu';

  function generateAiMessage(q: string) {
    const lower = q.toLowerCase();
    if (lower.includes('nguồn')) {
      return `Căn cứ: danh sách thiết bị và công việc mock của ${context}, cập nhật mẫu 14/10/2026. Đây là trợ lý mô phỏng, chưa kết nối mô hình AI hoặc hệ thống thực.`;
    }
    if (lower.includes('bảo trì')) {
      return `Trong ${context}, tủ PCCC có lịch bảo trì mẫu ngày 16/10/2026. Chọn thiết bị để xem công việc và người phụ trách. Kết quả kiểm tra cần BQL xác nhận.`;
    }
    return `Tôi đang hỗ trợ bạn tại ${context}. Trong dữ liệu mẫu, nên xem lỗi thang máy ở Block A trước, sau đó kiểm tra các lịch bảo trì đến hạn. Bấm vào chấm thiết bị để mở hồ sơ.`;
  }

  function openChat() {
    setChatMessage(generateAiMessage('ưu tiên'));
    setChatOpen(true);
  }

  // Filter summary chips
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allAssets) counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    return counts;
  }, [allAssets]);

  return (
    /* h-[calc(100dvh-104px)]: 64px AppHeader + 20px pt-5 + 20px lg:pb-5 = 104px chrome overhead */
    <div className="flex flex-col h-[calc(100dvh-104px)] overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#183343] tracking-tight">Không gian chung cư</h1>
          <p className="text-sm text-[#73858d]">Khám phá không gian, kết nối công việc.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Block selector */}
          <select
            value={block}
            onChange={e => goBlock(e.target.value)}
            className="border border-[#d9e4e5] rounded-lg px-3 py-2 text-sm bg-white text-[#234351] h-10"
            aria-label="Chọn block"
          >
            <option value="">Toàn khu</option>
            {BLOCKS.map(b => <option key={b.id} value={b.id}>Block {b.id}</option>)}
          </select>
          {/* Floor selector */}
          <select
            value={block && view !== '3d' ? floor : ''}
            disabled={!block}
            onChange={e => { if (e.target.value) goFloor(e.target.value as FloorKey); }}
            className="border border-[#d9e4e5] rounded-lg px-3 py-2 text-sm bg-white text-[#234351] h-10 disabled:opacity-50"
            aria-label="Chọn tầng"
          >
            <option value="">Chọn tầng</option>
            {(Object.keys(FLOOR_TYPES) as FloorKey[]).map(f => (
              <option key={f} value={f}>{FLOOR_TYPES[f]}</option>
            ))}
          </select>
          {/* Back to campus */}
          {block && (
            <button
              className="border border-[#d9e4e5] bg-white text-[#345563] rounded-lg px-3 py-2 text-sm h-10 hover:bg-gray-50"
              onClick={() => goBlock('')}
            >
              Toàn khu
            </button>
          )}
          {/* View tabs */}
          <div className="bg-[#e4edec] p-1 rounded-xl flex">
            {(['3d', 'map', 'list'] as const).map(v => {
              const label = v === '3d' ? '3D' : v === 'map' ? '2D' : 'Danh sách';
              const active = view === v || (v === '3d' && view === 'floor3d');
              return (
                <button
                  key={v}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${active ? 'bg-white text-[#123d46] shadow-sm font-medium' : 'text-[#5c737f] hover:text-[#123d46]'}`}
                  onClick={() => {
                    if (v === '3d') {
                      setView(block ? 'floor3d' : '3d');
                    } else {
                      setView(v);
                    }
                    setSelected(null);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main layout: map + sidebar */}
      <div className="flex gap-4 flex-1 min-h-0 relative">
        {/* Map card */}
        <div className="flex-1 min-w-0 bg-white border border-[#e0e9e9] rounded-2xl overflow-hidden flex flex-col">
          {/* Map header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8eeee]">
            <span className="text-sm font-semibold text-[#183343]">
              {block
                ? `Block ${block}${view === '3d' || view === 'floor3d' ? ' · Tổng thể / 3D' : ' / ' + FLOOR_TYPES[floor]}`
                : 'Toàn khu · 4 block'}
            </span>
            <span className="text-xs text-[#90a0a7]">Bố trí minh họa · Không theo tỷ lệ</span>
          </div>

          {/* Repair filter bar (only when a block+floor is selected and not 3D view) */}
          {block && view !== '3d' && view !== 'floor3d' && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[#edf1f1] flex-wrap">
                <input
                  value={repairQuery}
                  onChange={e => { setRepairQuery(e.target.value); setSelected(null); }}
                  placeholder="Tìm mã hoặc tên thiết bị…"
                  className="border border-[#d9e4e5] rounded-lg px-3 py-2 text-xs flex-1 min-w-[160px] max-w-[220px]"
                />
                <select
                  value={repairFilter}
                  onChange={e => { setRepairFilter(e.target.value as RepairStage | 'all'); setSelected(null); }}
                  className="border border-[#d9e4e5] rounded-lg px-2 py-2 text-xs bg-white text-[#234351]"
                >
                  <option value="all">Tất cả trạng thái</option>
                  {(Object.entries(REPAIR_STAGES) as [RepairStage, { label: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <span className="text-xs text-[#73858d] ml-auto">{visibleAssets.length} / {allAssets.length} thiết bị</span>
              </div>
              {/* Stage summary chips */}
              <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-[#edf1f1]">
                {(Object.entries(REPAIR_STAGES) as [RepairStage, { label: string; color: string }][]).map(([k, v]) => (
                  <button
                    key={k}
                    className={`whitespace-nowrap rounded-lg px-3 py-1 text-[11px] flex items-center gap-1 transition-colors ${repairFilter === k ? 'bg-[#dbeee7] text-[#126f60] font-medium' : 'bg-[#f3f6f5] text-[#617974] hover:bg-[#e8f0ee]'}`}
                    onClick={() => { setRepairFilter(repairFilter === k ? 'all' : k); setSelected(null); }}
                  >
                    <i className="w-2 h-2 rounded-full inline-block" style={{ background: v.color }} />
                    {v.label}
                    <b className="ml-1">{stageCounts[k] ?? 0}</b>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* View area */}
          <div className="flex-1 min-h-0 relative">
            {(view === '3d' || view === 'floor3d') && (
              <ThreeCanvas
                block={block}
                floor={floor}
                view={view}
                assets={visibleAssets}
                zones={zones}
                onPickBlock={handlePickBlock}
                onPickAsset={handlePickAsset}
                onPickZone={handlePickZone}
              />
            )}
            {view === 'map' && (
              <FloorPlan2D
                block={block}
                floor={floor}
                assets={visibleAssets}
                onPickBlock={handlePickBlock}
                onPickAsset={handlePickAsset}
                onPickZone={handlePickZone}
              />
            )}
            {view === 'list' && (
              <div className="p-4 overflow-auto h-full">
                {block ? (
                  visibleAssets.length > 0 ? (
                    <div className="grid gap-2">
                      {visibleAssets.map(a => (
                        <button
                          key={a.id}
                          className="bg-white border border-[#e0e9e8] rounded-xl p-4 text-left flex justify-between items-center hover:border-[#9db8b4] transition-colors"
                          onClick={() => handlePickAsset(a.id)}
                        >
                          <div>
                            <p className="font-semibold text-sm text-[#183343]">{a.name}</p>
                            <p className="text-xs text-[#80949d] mt-0.5">{a.id} · {a.zone}</p>
                          </div>
                          <span className="text-xs font-medium ml-3" style={{ color: REPAIR_STAGES[a.stage].color }}>
                            {REPAIR_STAGES[a.stage].label} ↗
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-sm text-[#7c959f]">Không có thiết bị phù hợp bộ lọc.</div>
                  )
                ) : (
                  <div className="grid gap-2">
                    {BLOCKS.map(b => (
                      <button
                        key={b.id}
                        className="bg-white border border-[#e0e9e8] rounded-xl p-4 text-left flex justify-between items-center hover:border-[#9db8b4] transition-colors"
                        onClick={() => goBlock(b.id)}
                      >
                        <div>
                          <p className="font-semibold text-sm text-[#183343]">Block {b.id}</p>
                          <p className="text-xs text-[#80949d] mt-0.5">{b.jobs} việc mở · {b.due} lịch bảo trì</p>
                        </div>
                        <span className="text-sm text-[#8fa6ac]">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar (visible when selected or always on desktop) */}
        <div className={`w-[310px] flex-shrink-0 bg-white border border-[#e0e9e9] rounded-2xl overflow-auto transition-all ${selected ? 'block' : 'hidden lg:block'}`}>
          <SpaceSidebar
            block={block}
            floor={floor}
            view={view}
            selected={selected}
            onClearSelection={() => setSelected(null)}
            onNewIncident={() => setModalOpen(true)}
            onGoBlock={goBlock}
            onGoFloor={goFloor}
            onOpenChat={openChat}
            incidents={incidents}
            revision={revision}
          />
        </div>
      </div>

      {/* Incident modal */}
      <IncidentModal
        open={modalOpen}
        locationLabel={locationLabel}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveIncident}
      />

      {/* AI Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-6 right-6 w-[340px] max-h-[80dvh] bg-white border border-[#d6e5df] shadow-2xl rounded-2xl z-20 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-[#183343]">👩🏻 An Nhi</h3>
              <p className="text-[11px] text-[#8a9c94]">Trợ lý mô phỏng · Dựa trên dữ liệu demo</p>
            </div>
            <button className="text-xl text-[#719099] hover:text-[#446070]" onClick={() => setChatOpen(false)} aria-label="Đóng">×</button>
          </div>
          <div className="bg-[#edf6f1] text-[#3b6156] rounded-xl p-3 text-sm leading-relaxed">{chatMessage}</div>
          <div className="flex gap-2 flex-wrap">
            {['ưu tiên', 'bảo trì', 'nguồn'].map(q => (
              <button
                key={q}
                className="text-[11px] bg-[#f3f7f5] text-[#2a7664] px-3 py-1.5 rounded-full hover:bg-[#e4f1ec]"
                onClick={() => setChatMessage(generateAiMessage(q))}
              >
                {q === 'ưu tiên' ? 'Việc cần ưu tiên' : q === 'bảo trì' ? 'Lịch bảo trì' : 'Xem căn cứ'}
              </button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const inp = e.currentTarget.querySelector('input') as HTMLInputElement; setChatMessage(generateAiMessage(inp.value)); inp.value = ''; }}>
            <input className="flex-1 border border-[#d9e6e0] rounded-lg px-3 py-2 text-xs min-w-0" placeholder="Hỏi về khu vực đang xem..." />
            <button type="submit" className="bg-[#087f70] text-white rounded-lg px-3 py-2 text-xs">↑</button>
          </form>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-[11px] text-[#8ca0a7] shrink-0">
        <span>Sơ đồ mẫu · Trạng thái từ hồ sơ demo, không phải dữ liệu cảm biến</span>
        <button
          className="text-[11px] text-[#7c959f] hover:text-[#4a7080]"
          onClick={() => {
            if (confirm('Xóa các sự cố bạn đã tạo trong bản demo?')) {
              resetRepairDemo();
              setIncidents([]);
              setRevision(r => r + 1);
              toast.success('Đã khôi phục dữ liệu demo');
            }
          }}
        >
          Khôi phục demo
        </button>
      </div>
    </div>
  );
}
