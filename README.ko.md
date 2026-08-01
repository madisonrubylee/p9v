# p9v — React Query 요청 워터폴 방지

[English](./README.md) | 한국어

**TanStack Query와 Next.js App Router를 위한 prefetch correctness layer입니다.**

TanStack Query는 이미 prefetch와 Suspense streaming을 잘 지원합니다. p9v는
새로운 fetch 방식을 만드는 대신, 라우트의 prefetch와 실제 컴포넌트 소비자를
연결합니다. 빠진 prefetch는 숨어 있는 클라이언트 요청이 아니라 개발 환경의
명확한 오류가 됩니다.

- `defineResource`, `useResource`, `<Prefetch>`만으로 간단하게 시작
- RSC 환경에서 pending query를 React Suspense로 streaming
- 정확한 query key의 cache miss를 감지해 waterfall 회귀 방지
- 필요할 때만 fragment masking과 컴파일타임 route 검증 적용
- GraphQL, 코드 생성, 빌드 플러그인 불필요

```text
중첩된 순차 요청               1,202 ms
수동 TanStack 병렬 prefetch      401 ms
p9v 병렬 prefetch                401 ms

올바른 수동 prefetch와 p9v의 실행 성능은 같습니다.
p9v는 재사용 가능한 계약과 누락 검증을 더합니다.
```

## 설치

```bash
npm install @p9v/core @tanstack/react-query
```

React 18 또는 19와 TanStack Query 5를 지원합니다.

## 빠르게 시작하기

### 1. 리소스를 한 번 정의합니다

```ts
import { defineResource } from "@p9v/core";

export const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: (id) => api.get<User>(`/users/${id}`),
});
```

리소스 이름은 애플리케이션 안에서 고유해야 합니다.

### 2. 컴포넌트에서 읽습니다

```tsx
import { useResource } from "@p9v/core/react";

export function UserCard({ userId }: { userId: string }) {
  const user = useResource(userResource, userId);
  return <span>{user.name}</span>;
}
```

`useResource`는 hydrated cache의 전체 데이터를 반응형으로 읽습니다. 개발
환경에서 실제 cache miss가 발생하면 조용히 요청을 시작하는 대신 정확한 query
key와 문제를 일으킨 컴포넌트가 담긴 `P9vWaterfallError`를 던집니다.

### 3. 라우트에서 함께 시작합니다

```tsx
import { Prefetch } from "@p9v/core/server";

export default async function Page({ params }) {
  const { id } = await params;
  return (
    <Prefetch
      resources={[userResource(id), statsResource(id)]}
      name="user-page"
    >
      <UserCard userId={id} />
      <StatsPanel userId={id} />
    </Prefetch>
  );
}
```

기본 `mode="blocking"`은 모든 리소스를 병렬로 시작하고 완료를 기다립니다.

### Suspense streaming

```tsx
<Prefetch resources={[userResource(id)]} mode="streaming">
  <Suspense fallback={<UserCardSkeleton />}>
    <UserCard userId={id} />
  </Suspense>
</Prefetch>
```

`streaming`은 요청 완료를 기다리지 않고 pending query와 Promise를 클라이언트로
전달합니다. `useResource`와 `useFragment`는 기존 Promise를 재사용해 suspend하며
중복 요청을 만들지 않습니다. 이 모드는 Next.js App Router처럼 RSC Promise
직렬화를 지원하는 환경에서 사용합니다. 그 외 환경에서는 기본 blocking 모드를
사용합니다.

## 더 강한 계약이 필요할 때

기본 API에는 field masking이나 컴파일타임 route completeness가 없습니다. 큰
화면이나 공용 컴포넌트에서 더 강한 계약이 필요할 때 fragment 모드를 선택합니다.

```tsx
import { defineRouteQuery, fragment, withFragments } from "@p9v/core";
import { useFragment } from "@p9v/core/react";

const UserCard_user = fragment(userResource, ["id", "name", "avatarUrl"]);

export const UserCard = withFragments(
  [UserCard_user],
  function UserCard({ userId }: { userId: string }) {
    const user = useFragment(UserCard_user, userId);
    return <span>{user.name}</span>;
  },
);

export const userPageQuery = defineRouteQuery({
  name: "user-page",
  root: ({ id }: { id: string }) => [userResource(id)],
  includes: [UserCard],
});
```

`includes`가 요구하는 리소스가 `root`에 없으면 TypeScript와 개발 환경 검증이
실패합니다. `useFragment`는 선언한 필드만 노출하고 개발 환경에서는 `Proxy`로
미선언 필드 접근도 막습니다. 기존 문법도 계속 지원합니다.

```tsx
UserCard.fragments = [UserCard_user] as const;
```

기존 route query는 그대로 `<Prefetch>`에 전달할 수 있고 streaming도 선택할 수
있습니다.

```tsx
<Prefetch query={userPageQuery} params={{ id }} mode="streaming">
  <UserCard userId={id} />
</Prefetch>
```

## p9v가 추가하는 것

| 방식 | 데이터 요구사항 위치 | 병렬 요청 | 누락 방지 |
| --- | :---: | :---: | :---: |
| 컴포넌트 내부 fetch | 컴포넌트 | 아니요 | 아니요 |
| 수동 TanStack prefetch | 라우트 | 예 | 아니요 |
| 탐지 전용 도구 | 컴포넌트 | 아니요 | 사후 경고 |
| **p9v** | 컴포넌트 + 라우트 계약 | 예 | **개발 오류/타입 오류** |

핵심은 “TanStack Query는 prefetch할 수 있게 하고, p9v는 prefetch를 빼먹지
못하게 한다”입니다. 올바르게 작성한 수동 TanStack Query prefetch보다 p9v가 더
빠르다고 주장하지 않습니다. p9v는 동일한 실행 방식 위에 누락 검증, 반복 코드
축소, Devtools를 추가합니다.

## Strict 동작

cache reader는 다음 순서로 상태를 처리합니다.

1. 사용할 데이터가 있으면 즉시 반환
2. pending query가 있으면 기존 Promise로 suspend
3. 실패한 query면 원래 fetch 오류를 Error Boundary로 전달
4. query 자체가 없으면 개발 strict 모드에서 `P9vWaterfallError`

프로덕션의 실제 cache miss는 서비스 안정성을 위해 fetch 후 suspend합니다. 개발
환경에서도 의도적인 요청이라면 `useResource(resource, arg, { defer: true })`
또는 `fragment(..., { defer: true })`를 사용합니다.

## Devtools

`QueryClientProvider` 안에 한 번 추가합니다.

```tsx
import { P9vDevtools } from "@p9v/core/devtools/react";

<QueryClientProvider client={queryClient}>
  <P9vDevtools />
  {children}
</QueryClientProvider>;
```

패널은 p9v 서버 prefetch와 브라우저 TanStack Query 요청을 별도 세션으로 표시하고
critical path, query key, 실제 시간과 병렬화 예상 시간을 보여줍니다. streaming
서버 요청은 pending 상태로 전달된 뒤 브라우저에서 완료되면 같은 서버 timing으로
갱신됩니다.

CLI 분석도 사용할 수 있습니다.

```bash
npx p9v analyze
```

워터폴을 찾으면 0이 아닌 exit code를 반환하므로 CI 검증 단계로 사용할 수 있습니다.

## API 요약

| API | 역할 |
| --- | --- |
| `defineResource(...)` | fetcher, query key, cache 옵션 정의 |
| `useResource(resource, arg)` | prefetched 전체 데이터 읽기 |
| `fragment(resource, fields)` | 컴포넌트 필드 계약과 masking 정의 |
| `withFragments(fragments, component)` | 컴포넌트에 fragment metadata 연결 |
| `useFragment(fragment, arg)` | masked cache 데이터 읽기 |
| `defineRouteQuery(...)` | route 리소스와 포함 컴포넌트 계약 정의 |
| `<Prefetch resources>` | 간단한 직접 prefetch |
| `<Prefetch query params>` | 검증 가능한 route prefetch |
| `WaterfallRecorder` / `P9vDevtools` | query timing 분석과 시각화 |

### 진입점

| Import | 환경 | 주요 export |
| --- | --- | --- |
| `@p9v/core` | 서버 안전 | `defineResource`, `fragment`, `withFragments`, `defineRouteQuery` |
| `@p9v/core/react` | 클라이언트 | `useResource`, `useFragment`, `P9vProvider`, `RouteQueryProvider` |
| `@p9v/core/server` | 서버 | `Prefetch`, `getServerQueryClient` |
| `@p9v/core/devtools` | 모든 환경 | recorder와 분석 유틸리티 |
| `@p9v/core/devtools/react` | 클라이언트 | `P9vDevtools` |

## 개발

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Next.js blocking/streaming 예제와 benchmark는
[`examples/next-app/README.md`](./examples/next-app/README.md)를 참고하세요.

## 라이선스

MIT
