# Fade & Days

사진과 기록으로 소중한 순간을 보관하고, 필요할 때 소중한 사람과 함께 나누는 개인 추억 아카이브.

React · TypeScript · Vite · Tailwind CSS · Firebase(Auth · Firestore) · IndexedDB · PWA

> 현재 목표는 **웹앱(PWA)** 입니다. 휴대폰 브라우저에서 열고 "홈 화면에 추가"하면 앱처럼 쓸 수 있습니다. Android 패키징(Capacitor)은 나중 단계입니다.

## 실행

Node.js 20.19 이상(또는 22.12 이상)이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:5173
```

같은 와이파이에 연결된 휴대폰에서는 터미널에 표시되는 `Network: http://192.168.x.x:5173` 주소로 접속합니다.

```bash
npm run typecheck  # 타입 검사만
npm run build      # dist/ 에 배포용 파일 생성
npm run preview    # 빌드 결과 미리보기 (서비스 워커·오프라인 동작 확인용)
```

### 두 가지 모드

| 모드 | 조건 | 저장 위치 | 로그인 | 공유 |
|---|---|---|---|---|
| **로컬 모드** | `.env.local` 없음 | 이 브라우저(IndexedDB) | 없음 | 같은 기기 안에서만 |
| **Firebase 모드** | `.env.local`에 Firebase 설정 | 계정(Firestore) · 실시간 동기화 | 이메일 · Google | 초대 코드로 다른 사람과 |

처음에는 설정 없이 바로 로컬 모드로 써 볼 수 있고, 아래 순서대로 Firebase를 연결하면 로그인 화면이 나타납니다.

## Firebase 연결

1. **프로젝트 만들기**: [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만듭니다. (Google 애널리틱스는 꺼도 됩니다)
2. **웹 앱 등록**: 프로젝트 설정 → 일반 → 내 앱 → 웹(`</>`) → 앱 이름 입력. 화면에 나오는 `firebaseConfig` 값을 복사해 둡니다.
3. **로그인 방식 켜기**: Authentication → 시작하기 → 로그인 방법에서 **이메일/비밀번호**와 **Google**을 사용 설정합니다.
4. **Firestore 만들기**: Firestore Database → 데이터베이스 만들기 → 위치 `asia-northeast3 (서울)` → **프로덕션 모드**.
5. **환경 변수**: `.env.example`을 복사해 `.env.local`로 저장하고 2번에서 복사한 값을 채웁니다.
6. **보안 규칙 배포**: 콘솔의 Firestore → 규칙 탭에 `firestore.rules` 내용을 붙여 넣고 게시합니다.
   (Firebase CLI를 쓴다면 `npm i -g firebase-tools` → `firebase login` → `firebase use --add` → `npm run deploy:rules`)
7. `npm run dev`를 다시 실행하면 로그인 화면이 나타납니다.

**배포한 주소에서 로그인하려면** Authentication → 설정 → 승인된 도메인에 그 주소를 추가하세요. (예: `아이디.github.io`. `localhost`는 기본 등록됨)

### 사진 저장 위치

| `VITE_PHOTO_BACKEND` | 사용하는 곳 | 요금제 | 특징 |
|---|---|---|---|
| `firestore` (기본) | Firestore 문서 | 무료(Spark) 가능 | 한 장을 900KB 이하로 자동 압축(WebP). 무료 저장 용량 1GiB |
| `storage` | Cloud Storage | Blaze 필요 | 화질 제한이 적음. `storage.rules`도 배포해야 함 |

Cloud Storage for Firebase는 이제 Blaze(종량제) 요금제에서만 쓸 수 있습니다. 무료 사용량 안에서는 비용이 나오지 않지만 결제 계정을 연결해야 합니다. 그래서 기본값은 결제 등록 없이 쓸 수 있는 `firestore` 방식입니다.

## 웹앱(PWA)

- `manifest.webmanifest`와 아이콘이 있어 휴대폰에서 **홈 화면에 추가**하면 주소창 없이 앱처럼 열립니다. (Android Chrome은 마이 → 앱 설정의 "홈 화면에 앱 추가" 버튼, iPhone은 Safari 공유 버튼 → 홈 화면에 추가)
- `public/sw.js` 서비스 워커가 앱 화면을 캐시해 인터넷이 끊겨도 열립니다. 배포 빌드에서만 등록됩니다.
- Firebase 모드에서는 Firestore 오프라인 캐시 덕분에 인터넷이 없어도 마지막으로 본 기록이 보이고, 작성한 글은 연결되면 올라갑니다. (새 사진 업로드는 연결이 필요)
- 새 버전을 배포할 때는 `public/sw.js`의 `VERSION`을 바꿔 주세요.

### 배포

- **GitHub Pages**: `npm run build` 후 `dist/` 내용을 올리면 됩니다. (`vite.config.ts`의 `base: './'` 덕분에 하위 경로에서도 동작)
- **Firebase Hosting**: `npm run deploy:hosting`. `firebase.json`에 설정이 들어 있습니다.

## 기능 (v0.2.0)

| 화면 | 기능 |
|---|---|
| **홈** | 바로가기(추억 남기기·지금 로그·타임라인·앨범), 오늘의 추억(N년 전 오늘 → 날마다 바뀌는 사진 기록), 오늘의 로그, 최근 기록, 앨범 요약, 최근 활동 |
| **타임라인** | 전체 추억: 연도·월로 묶어 보기, 연도·월 필터, 최신순/오래된순, 내가 쓴 기록만, 날짜로 찾기 · 하루 보기: 그날의 추억 + 시간 로그, 기록이 있는 날 목록 |
| **추억 작성** | 사진 최대 10장(대표 사진 지정·순서 변경), 제목, 날짜, 메모, 앨범 선택, 수정·삭제 |
| **시간 로그** | 셋로그 스타일: 사진(최대 4장, 바로 촬영 가능) + 시간 + 글(선택) + 분류 |
| **앨범** | 만들기·수정·삭제, 앨범 상세, 표지 자동 구성, 앨범에서 빼기 |
| **공유 앨범** | 멤버 목록, 역할(소유자·편집자·보기 전용), 초대 코드(유효 기간·1회용)·링크 공유·취소, 코드로 참여, 나가기·내보내기 |
| **마이페이지** | 프로필(이름 변경), 통계, 내가 작성한 추억, 내 앨범·참여 중인 공유 앨범, 계정 및 공유(저장 방식·이메일·로그아웃), 앱 설정(타임라인 정렬·사진 화질·홈 구성·홈 화면에 추가) |
| **로그인** | 이메일 가입·로그인, Google 로그인, 비밀번호 재설정 메일 |

## 폴더 구조

```
src/
├── main.tsx                     앱 시작점, 서비스 워커 등록
├── App.tsx                      로그인 화면/앱 전환, 탭, 모달(오버레이) 관리, 초대 링크 처리
├── index.css                    Tailwind + 디자인 토큰(색상·글꼴)
├── types/models.ts              데이터 모델
├── db/
│   ├── types.ts                 Repository 인터페이스 (화면은 이것만 사용)
│   ├── localRepository.ts       로컬 모드 구현 (IndexedDB)
│   ├── database.ts              IndexedDB 스키마와 마이그레이션
│   └── firebase/
│       ├── config.ts            .env 값 읽기
│       ├── app.ts               Firebase 초기화 (Firestore 오프라인 캐시)
│       ├── auth.ts              로그인·가입·로그아웃
│       └── firebaseRepository.ts Firebase 모드 구현 (실시간 동기화)
├── store/
│   ├── AuthContext.tsx          로그인 상태, 모드 선택
│   └── DataContext.tsx          데이터 구독, 저장 동작, 토스트
├── lib/                         날짜, 초대 코드, 이미지 압축(WebP), 권한 규칙, 앱 설정, 오류 문구, PWA 설치
├── components/                  카드, 모달, 사진 선택, 편집 화면, 멤버·초대, 최근 활동 등
└── pages/                       홈, 타임라인, 앨범, 앨범 상세, 마이, 로그인
firestore.rules · storage.rules  Firebase 보안 규칙
public/                          manifest, 서비스 워커, 아이콘
```

Firebase SDK는 설정이 있을 때만 동적으로 불러오기 때문에 로컬 모드에서는 내려받지 않습니다.

## 데이터 모델

```
User ──1:N── Memory ── photos[] (0번 = 대표 사진)
  │             │
  │             └──N:M── Album  (AlbumMemory: 추억 하나가 여러 앨범에 들어갈 수 있음)
  │                        │
  └────────N:M─────────────┘    (AlbumMember: role = owner | editor | viewer)
                           │
                           └──1:N── AlbumInvite (8자리 코드, 역할, 만료일, 사용 횟수)
User ──1:N── LogEntry (date + time + photos[] + text + tag)
```

### Firestore 구조

```
users/{uid}                          프로필
users/{uid}/memories/{id}            내 추억 (본인만)
users/{uid}/logs/{id}                내 시간 로그 (본인만)
users/{uid}/photos/{id}              사진 데이터 (firestore 방식)
albums/{albumId}                     앨범 + memberIds[] + members{uid: 역할·이름}
albums/{albumId}/entries/{memoryId}  앨범에 넣은 추억의 사본 (앨범 멤버가 읽음)
invites/{CODE}                       초대 코드
```

- 추억은 항상 **작성자 소유**입니다. 앨범에 넣으면 그 앨범 아래에 **사본(entry)** 이 생기고, 작성자가 추억을 고치면 사본도 같은 일괄 쓰기(batch)로 함께 고쳐집니다. 그래서 보안 규칙은 "앨범 멤버면 entries를 읽을 수 있다"로 단순해집니다.
- 공유 앨범을 나가거나 내보내지면 그 사람이 올린 추억은 앨범에서 빠지고, 각자의 타임라인에는 그대로 남습니다.
- 사진 파일은 로그인한 사용자라면 경로를 알 때 읽을 수 있습니다. 경로는 추측할 수 없는 무작위 id이고 앨범 멤버에게만 보이는 entries 안에만 있습니다. (개인 프로젝트에서 흔히 쓰는 절충안)

## 공유 앨범 권한

| 할 수 있는 일 | 소유자 | 편집자 | 보기 전용 |
|---|:-:|:-:|:-:|
| 앨범 보기 | ✓ | ✓ | ✓ |
| 앨범에 추억 추가 | ✓ | ✓ | |
| 앨범에서 추억 빼기 | ✓ | 본인이 올린 것 | |
| 앨범 이름·설명 수정, 앨범 삭제 | ✓ | | |
| 멤버 초대·역할 변경·내보내기 | ✓ | | |
| 추억 내용 수정·삭제 | 작성자 본인만 | | |

같은 규칙이 세 곳에 있습니다: 화면(`src/lib/permissions.ts`, 버튼 숨김), 저장소(저장 전 검사), 서버(`firestore.rules`).

## 다음 단계

- 백업·복원 (로컬 모드 데이터를 파일로 내보내기, 로컬 → 계정으로 옮기기)
- 추억에 댓글·반응 (공유 앨범)
- 사진 썸네일 따로 저장해 목록 화면 데이터 사용량 줄이기
- Capacitor로 Android 앱 패키징
