import type { ComponentType, SVGProps } from 'react';
import { AlbumIcon, HomeIcon, PlusIcon, TimelineIcon, UserIcon } from './icons';

export type Tab = 'home' | 'timeline' | 'albums' | 'my';

const TABS: { id: Tab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }> }[] = [
  { id: 'home', label: '홈', Icon: HomeIcon },
  { id: 'timeline', label: '타임라인', Icon: TimelineIcon },
  { id: 'albums', label: '앨범', Icon: AlbumIcon },
  { id: 'my', label: '마이', Icon: UserIcon },
];

export function BottomNav({ active, onChange, onCreate }: { active: Tab; onChange: (tab: Tab) => void; onCreate: () => void }) {
  const tabButton = ({ id, label, Icon }: (typeof TABS)[number]) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      aria-current={active === id ? 'page' : undefined}
      className={`flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] transition-colors ${
        active === id ? 'text-ink' : 'text-muted'
      }`}
    >
      <Icon size={21} strokeWidth={active === id ? 2 : 1.6} />
      {label}
    </button>
  );

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 z-30 flex w-[calc(100%-28px)] max-w-md -translate-x-1/2 items-center justify-around rounded-full border border-line bg-paper/90 px-2 py-1.5 shadow-[0_8px_30px_#40332214] backdrop-blur-md"
    >
      {TABS.slice(0, 2).map(tabButton)}
      <button
        type="button"
        onClick={onCreate}
        aria-label="새로 기록하기"
        className="grid size-12 place-items-center rounded-full bg-ink text-white shadow-md transition-transform active:scale-95"
      >
        <PlusIcon size={22} strokeWidth={2} />
      </button>
      {TABS.slice(2).map(tabButton)}
    </nav>
  );
}
