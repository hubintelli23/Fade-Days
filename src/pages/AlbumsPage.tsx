import { AlbumCover } from '../components/AlbumCover';
import { LinkIcon, LockIcon, PlusIcon, UsersIcon } from '../components/icons';
import { Badge, Button, EmptyState, PageTitle } from '../components/ui';
import { ROLE_LABEL } from '../lib/permissions';
import { useData } from '../store/DataContext';
import type { ID } from '../types/models';

export function AlbumsPage({
  onOpenAlbum,
  onCreateAlbum,
  onJoin,
}: {
  onOpenAlbum: (id: ID) => void;
  onCreateAlbum: () => void;
  onJoin: () => void;
}) {
  const data = useData();

  return (
    <>
      <PageTitle eyebrow="Collect your moments" title="앨범" sub="기억하고 싶은 순간을 주제별로 모으고, 소중한 사람과 함께 채워요." />
      <div className="mb-5 flex gap-2">
        <Button onClick={onCreateAlbum}>
          <PlusIcon size={16} /> 새 앨범
        </Button>
        <Button variant="secondary" onClick={onJoin}>
          <LinkIcon size={16} /> 초대 코드로 참여
        </Button>
      </div>

      {data.albums.length === 0 ? (
        <EmptyState>
          아직 앨범이 없어요.
          <br />
          여행, 일상, 가족처럼 주제별로 앨범을 만들어 보세요.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.albums.map((album) => {
            const memories = data.memoriesByAlbum.get(album.id) ?? [];
            const memberCount = data.membersByAlbum.get(album.id)?.length ?? 1;
            const role = data.roleByAlbum.get(album.id);
            return (
              <button
                key={album.id}
                type="button"
                onClick={() => onOpenAlbum(album.id)}
                className="rounded-2xl border border-line bg-paper p-4 text-left transition-shadow hover:shadow-[0_6px_24px_#40332214]"
              >
                <AlbumCover albumId={album.id} memories={memories} className="aspect-[16/9]" />
                <div className="mt-3.5 flex items-center justify-between gap-2">
                  <strong className="truncate text-[15px] font-semibold">{album.title}</strong>
                  {memberCount > 1 ? (
                    <Badge tone="accent">
                      <UsersIcon size={12} /> {memberCount}명
                    </Badge>
                  ) : (
                    <Badge>
                      <LockIcon size={11} /> 나만 보기
                    </Badge>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  기록 {memories.length}개{role && role !== 'owner' && ` · ${ROLE_LABEL[role]}`}
                  {album.description && ` · ${album.description}`}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
