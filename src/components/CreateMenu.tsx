import { CameraIcon, ClockIcon } from './icons';
import { Modal } from './ui';

export function CreateMenu({ onClose, onMemory, onLog }: { onClose: () => void; onMemory: () => void; onLog: () => void }) {
  const options = [
    { title: '추억 기록', desc: '사진과 메모로 하루의 순간을 남겨요', Icon: CameraIcon, onClick: onMemory },
    { title: '시간 로그', desc: '지금 뭘 하고 있는지 한 줄로 남겨요', Icon: ClockIcon, onClick: onLog },
  ];
  return (
    <Modal title="무엇을 남길까요?" onClose={onClose}>
      <div className="mt-2 grid gap-2.5 pb-2">
        {options.map(({ title, desc, Icon, onClick }) => (
          <button
            key={title}
            type="button"
            onClick={onClick}
            className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 text-left hover:bg-soft/40"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-soft text-accent">
              <Icon size={21} />
            </span>
            <span>
              <strong className="block text-[15px] font-semibold">{title}</strong>
              <span className="text-xs text-muted">{desc}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
