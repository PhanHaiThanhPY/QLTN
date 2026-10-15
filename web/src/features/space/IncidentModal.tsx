import { useRef } from 'react';
import type { FormEvent } from 'react';

interface Props {
  open: boolean;
  locationLabel: string;
  onClose: () => void;
  onSave: (data: { title: string; description: string; priority: string }) => void;
}

export function IncidentModal({ open, locationLabel, onClose, onSave }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const priorityRef = useRef<HTMLSelectElement>(null);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = titleRef.current?.value.trim() ?? '';
    const description = descRef.current?.value.trim() ?? '';
    const priority = priorityRef.current?.value ?? 'Trung bình';
    if (!title || !description) return;
    onSave({ title, description, priority });
    if (titleRef.current) titleRef.current.value = '';
    if (descRef.current) descRef.current.value = '';
  }

  return (
    <div
      className="fixed inset-0 bg-[#102f42]/70 flex items-center justify-center z-30 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl p-6 max-w-[430px] w-full max-h-[90dvh] overflow-auto shadow-xl">
        <button
          className="float-right text-xl text-[#719099] hover:text-[#446070]"
          onClick={onClose}
          aria-label="Đóng"
        >
          ×
        </button>
        <h2 className="text-xl font-bold text-[#183343] mb-1">Ghi nhận sự cố</h2>
        <p className="text-sm text-[#73858d] mb-4">Tạo bản ghi mẫu cho khu vực đang chọn.</p>
        <form onSubmit={handleSubmit}>
          <label className="block text-xs text-[#183343] mb-1">Vị trí</label>
          <input
            value={locationLabel}
            readOnly
            className="w-full border border-[#dbe5e5] rounded-lg px-3 py-2 text-sm text-[#183343] bg-[#f6f9f8] mb-3"
          />
          <label className="block text-xs text-[#183343] mb-1" htmlFor="incidentTitle">Tên sự cố</label>
          <input
            id="incidentTitle"
            ref={titleRef}
            required
            maxLength={100}
            placeholder="Ví dụ: Điều hòa không làm mát"
            className="w-full border border-[#dbe5e5] rounded-lg px-3 py-2 text-sm text-[#183343] mb-3 focus:outline-none focus:ring-2 focus:ring-[#51cdb9]"
          />
          <label className="block text-xs text-[#183343] mb-1" htmlFor="incidentDesc">Mô tả hiện trạng</label>
          <textarea
            id="incidentDesc"
            ref={descRef}
            required
            maxLength={1000}
            placeholder="Mô tả vấn đề bạn quan sát được..."
            className="w-full border border-[#dbe5e5] rounded-lg px-3 py-2 text-sm text-[#183343] mb-3 resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-[#51cdb9]"
          />
          <label className="block text-xs text-[#183343] mb-1">Mức ưu tiên</label>
          <select
            ref={priorityRef}
            className="w-full border border-[#dbe5e5] rounded-lg px-3 py-2 text-sm text-[#183343] mb-5 bg-white"
          >
            <option>Trung bình</option>
            <option>Cao</option>
            <option>Thấp</option>
          </select>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 bg-white border border-[#d9e4e5] text-[#345563] rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#087f70] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#076b5e]"
            >
              Lưu sự cố
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
