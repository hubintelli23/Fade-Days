import { useCallback, useEffect, useState } from 'react';
import { AlbumEditor } from './components/AlbumEditor';
import { BottomNav } from './components/BottomNav';
import type { Tab } from './components/BottomNav';
import { CreateMenu } from './components/CreateMenu';
import { JoinAlbum } from './components/JoinAlbum';
import { LogEditor } from './components/LogEditor';
import { MembersSheet } from './components/MembersSheet';
import { MemoryDetail } from './components/MemoryDetail';
import { MemoryEditor } from './components/MemoryEditor';
import { UserIcon } from './components/icons';
import { Button } from './components/ui';
import { todayISO } from './lib/date';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MyPage } from './pages/MyPage';
import { TimelinePage } from './pages/TimelinePage';
import type { TimelineState } from './pages/TimelinePage';
import { useAuth } from './store/AuthContext';
import { DataProvider, useData, useDataStatus, useToast } from './store/DataContext';
import type { ID, ISODate, LogEntry } from './types/models';

/** 화면 위에 뜨는 창은 한 번에 하나만 */
type Overlay =
  | { type: 'create-menu' }
  | { type: 'memory'; id: ID; albumId?: ID }
  | { type: 'memory-editor'; memoryId?: ID; presetAlbumId?: ID; presetDate?: ISODate }
  | { type: 'log-editor'; entry?: LogEntry; date?: ISODate }
  | { type: 'album-editor'; albumId?: ID }
  | { type: 'members'; albumId: ID }
  | { type: 'join'; code?: string };

/** 로그인 상태에 따라 로그인 화면 / 앱을 보여 준다 */
export default function App() {
  const { state } = useAuth();

  if (state.status === 'loading') return <Splash />;
  if (state.status === 'error') return <ErrorScreen message={state.error} />;
  if (state.status === 'signed-out') return <LoginPage />;

  const key = state.status === 'signed-in' ? state.user.uid : 'local';
  return (
    <DataProvider key={key} repository={state.repository}>
      <DataGate />
    </DataProvider>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-pulse font-serif text-2xl tracking-wide text-muted">Fade & Days</div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-8 text-center">
      <div>
        <p className="font-serif text-xl">기록을 불러오지 못했어요</p>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Button className="mt-5" onClick={() => window.location.reload()}>
          다시 시도
        </Button>
      </div>
    </div>
  );
}

function DataGate() {
  const status = useDataStatus();
  const { message } = useToast();
  return (
    <>
      {status.status === 'loading' && <Splash />}
      {status.status === 'error' && <ErrorScreen message={status.error} />}
      {status.status === 'ready' && <Shell />}
      {message && (
        <div
          role="status"
          className="animate-fade fixed bottom-24 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-ink/92 px-4 py-2.5 text-[13px] text-white shadow-lg"
        >
          {message}
        </div>
      )}
    </>
  );
}

function Shell() {
  const data = useData();
  const [tab, setTab] = useState<Tab>('home');
  const [albumId, setAlbumId] = useState<ID | null>(null);
  const [timeline, setTimeline] = useState<TimelineState>({ mode: 'all', date: todayISO(), mineOnly: false });
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const close = useCallback(() => setOverlay(null), []);

  // 초대 링크(?invite=CODE)로 들어온 경우
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) {
      setOverlay({ type: 'join', code });
      params.delete('invite');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
  }, []);

  const go = (next: Tab) => {
    setTab(next);
    if (next !== 'albums') setAlbumId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openAlbum = (id: ID) => {
    setTab('albums');
    setAlbumId(id);
    setOverlay(null);
    window.scrollTo({ top: 0 });
  };
  const openTimeline = (patch: Partial<TimelineState>) => {
    setTimeline((t) => ({ ...t, ...patch }));
    go('timeline');
  };
  const openMemory = (id: ID, fromAlbumId?: ID) => setOverlay({ type: 'memory', id, albumId: fromAlbumId });
  const openLog = (entry?: LogEntry, date?: ISODate) => setOverlay({ type: 'log-editor', entry, date });
  const createMemory = (presetAlbumId?: ID, presetDate?: ISODate) => setOverlay({ type: 'memory-editor', presetAlbumId, presetDate });

  return (
    <div className="mx-auto min-h-dvh max-w-[1060px] px-4 pt-5 pb-32 sm:px-7 sm:pt-7">
      <header className="mb-8 flex items-center justify-between">
        <button type="button" onClick={() => go('home')} className="text-left">
          <span className="block font-serif text-[25px] tracking-[0.04em]">Fade & Days</span>
          <small className="mt-1 block text-[10px] tracking-[0.22em] text-muted">EVERY MOMENT LEAVES A LITTLE COLOR</small>
        </button>
        <button
          type="button"
          aria-label="마이 페이지"
          onClick={() => go('my')}
          className="grid size-[42px] place-items-center rounded-full border border-line bg-paper font-serif text-lg text-ink"
        >
          {data.user.displayName ? data.user.displayName.slice(0, 1) : <UserIcon size={18} />}
        </button>
      </header>

      <main className="mx-auto max-w-[850px]">
        {tab === 'home' && (
          <HomePage
            onOpenMemory={(id) => openMemory(id)}
            onCreateMemory={() => createMemory()}
            onOpenLog={(entry) => openLog(entry)}
            onOpenDay={(date) => openTimeline({ mode: 'day', date })}
            onOpenTimeline={() => openTimeline({ mode: 'all', mineOnly: false })}
            onOpenAlbums={() => go('albums')}
            onOpenAlbum={openAlbum}
          />
        )}
        {tab === 'timeline' && (
          <TimelinePage
            state={timeline}
            onChange={(patch) => setTimeline((t) => ({ ...t, ...patch }))}
            onOpenMemory={(id) => openMemory(id)}
            onCreateMemory={(date) => createMemory(undefined, date)}
            onOpenLog={openLog}
          />
        )}
        {tab === 'albums' &&
          (albumId ? (
            <AlbumDetailPage
              albumId={albumId}
              onBack={() => setAlbumId(null)}
              onOpenMemory={(id) => openMemory(id, albumId)}
              onAddMemory={() => createMemory(albumId)}
              onEditAlbum={() => setOverlay({ type: 'album-editor', albumId })}
              onOpenMembers={() => setOverlay({ type: 'members', albumId })}
            />
          ) : (
            <AlbumsPage
              onOpenAlbum={openAlbum}
              onCreateAlbum={() => setOverlay({ type: 'album-editor' })}
              onJoin={() => setOverlay({ type: 'join' })}
            />
          ))}
        {tab === 'my' && (
          <MyPage
            onJoin={() => setOverlay({ type: 'join' })}
            onOpenMemory={(id) => openMemory(id)}
            onOpenAlbum={openAlbum}
            onSeeMyMemories={() => openTimeline({ mode: 'all', mineOnly: true })}
          />
        )}
      </main>

      <footer className="mt-12 text-center text-[10px] tracking-[0.2em] text-[#aaa092]">FADE & DAYS · A PRIVATE SPACE FOR YOUR MEMORIES</footer>

      <BottomNav active={tab} onChange={go} onCreate={() => setOverlay({ type: 'create-menu' })} />

      {overlay?.type === 'create-menu' && (
        <CreateMenu
          onClose={close}
          onMemory={() => createMemory(tab === 'albums' && albumId ? albumId : undefined)}
          onLog={() => openLog()}
        />
      )}
      {overlay?.type === 'memory' && (
        <MemoryDetail
          memoryId={overlay.id}
          fromAlbumId={overlay.albumId}
          onClose={close}
          onEdit={(id) => setOverlay({ type: 'memory-editor', memoryId: id })}
          onOpenAlbum={openAlbum}
        />
      )}
      {overlay?.type === 'memory-editor' && (
        <MemoryEditor
          memory={overlay.memoryId ? data.memories.find((m) => m.id === overlay.memoryId) : undefined}
          presetAlbumId={overlay.presetAlbumId}
          presetDate={overlay.presetDate}
          onClose={close}
          onSaved={(id) => (overlay.memoryId ? setOverlay({ type: 'memory', id }) : undefined)}
        />
      )}
      {overlay?.type === 'log-editor' && <LogEditor entry={overlay.entry} date={overlay.date} onClose={close} />}
      {overlay?.type === 'album-editor' && (
        <AlbumEditor
          album={overlay.albumId ? data.albums.find((a) => a.id === overlay.albumId) : undefined}
          onClose={close}
          onSaved={(id) => !overlay.albumId && openAlbum(id)}
        />
      )}
      {overlay?.type === 'members' && (
        <MembersSheet
          albumId={overlay.albumId}
          onClose={close}
          onLeft={() => {
            close();
            setAlbumId(null);
          }}
        />
      )}
      {overlay?.type === 'join' && <JoinAlbum initialCode={overlay.code} onClose={close} onJoined={openAlbum} />}
    </div>
  );
}
