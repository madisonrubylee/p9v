<p align="center">
<img src="./assets/logo.png" alt="p9v logo" width="640" />
</p>

# p9v — TanStack Query Prefetch Integrity

[English](./README.md) | 한국어

**TanStack Query는 prefetch하는 법을 알고, p9v는 빠뜨리지 않았는지 보장합니다.**

p9v는 TanStack Query 애플리케이션을 위한 correctness layer입니다. 컴포넌트
가까이에 query 요구사항을 두고, 라우트가 정확한 query를 시작했는지 검증하며,
예상하지 못한 브라우저 cache miss를 개발 오류와 CI 실패로 바꿉니다. fetch, cache,
Suspense, dehydration과 hydration은 계속 TanStack Query가 담당합니다.

- 기존 `queryOptions`, `useQuery`, `useSuspenseQuery`를 그대로 사용
- 계약 이름 누락은 타입으로, 정확한 query key 누락은 런타임으로 검증
- Next.js App Router에서 blocking과 streaming query를 동시에 시작
- prefetched, 의도적 deferred, 예상 밖 waterfall을 Devtools에서 구분
- `p9v analyze`로 route 성능 예산을 CI에서 강제
- 기존 Resource와 fragment API도 0.4에서 호환 유지

## Why p9v?

### Prefetch 선언과 데이터 소비는 서로 다른 곳에서 관리됩니다

컴포넌트 수준 TanStack Query에서는 컴포넌트가 어떤 데이터를 읽을지 결정하고,
route가 어떤 데이터를 미리 시작할지 결정합니다. TanStack Query는 훌륭한
prefetch primitive를 제공하지만, 기본적으로 이 두 선언의 일치까지 보장하지는
않습니다.

처음에는 route가 `userQuery`를 올바르게 prefetch했다고 가정해 보겠습니다. 이후
`UserCard`가 `teamQuery`를 추가하거나 `userQuery("u1")`을
`userQuery("u2")`로 변경합니다.

```text
route                        component tree
prefetch user:u1             UserCard
                               ├─ read user:u1
                               └─ read team:t1   ← 리팩터링 중 추가
```

TanStack Query가 브라우저에서 누락된 데이터를 안전하게 가져오기 때문에 화면은
계속 정상 동작합니다. 기능 테스트도 통과하지만, 페이지에는 네트워크 왕복이 하나
더 생깁니다. 안정성을 위한 fallback이 성능 회귀를 숨기게 됩니다.

### p9v는 조용한 성능 회귀를 명확한 실패로 바꿉니다

p9v는 route 선언과 실제 소비자를 연결하고 세 지점에서 검증합니다.

1. **타입 검사:** 컴포넌트가 선언한 query가 route contract에서 빠지면
   TypeScript가 실패합니다.
2. **개발 런타임:** 잘못됐거나 누락된 정확한 query key는 숨은 브라우저
   waterfall이 되기 전에 `P9vWaterfallError`를 발생시킵니다.
3. **CI:** 기록된 `unexpected-waterfall`, depth, critical-path budget을 기준으로
   배포 전 PR을 실패시킬 수 있습니다.

| 자식 query가 변경된 이후 | 수동 TanStack prefetch | p9v contract |
| --- | --- | --- |
| 화면이 계속 동작하는가 | 예 | 프로덕션에서는 예 |
| 개발 중 정확한 key 누락이 보이는가 | 직접 확인해야 함 | 즉시 오류 |
| route와 component의 계약을 타입 검사하는가 | 아니요 | 예 |
| 회귀를 CI에서 차단할 수 있는가 | 별도 도구 필요 | 기본 제공 |

### p9v는 더 빠른 cache를 만들지 않고 기존 속도를 지킵니다

p9v는 TanStack Query 자체 primitive를 실행합니다. 따라서 올바른 수동 prefetch와
p9v의 실행 성능이 같은 것이 정상입니다.

```text
중첩된 순차 요청               1,202 ms
수동 TanStack 병렬 prefetch      401 ms
p9v 병렬 prefetch                401 ms
```

p9v의 가치는 컴포넌트가 이동하고 query가 변경된 뒤에도 마지막 401ms를 유지하는
것입니다. 공용 컴포넌트가 많거나, route tree가 크거나, 여러 팀이 함께 개발하거나,
성능 budget을 강제하는 코드베이스에서 가장 유용합니다.

페이지마다 명확한 query가 한두 개뿐인 작은 애플리케이션이라면 수동 TanStack
prefetch가 더 단순하며 p9v가 필요하지 않을 수 있습니다.

## 설치

```bash
npm install @p9v/core @tanstack/react-query
```

React 18 또는 19와 TanStack Query 5를 지원합니다.

## 빠르게 시작하기

### 1. 기존 TanStack options에 계약을 추가합니다

```ts
import { queryOptions } from "@tanstack/react-query";
import { defineQueryContract } from "@p9v/core";

export const userQuery = defineQueryContract({
  name: "user",
  options: (id: string) =>
    queryOptions({
      queryKey: ["user", id] as const,
      queryFn: () => api.get<User>(`/users/${id}`),
    }),
});
```

반환값은 그대로 TanStack query options입니다. `infiniteQueryOptions`도 지원하며,
p9v가 서버에서 `prefetchInfiniteQuery`를 자동으로 선택합니다.

### 2. 컴포넌트에 요구사항을 둡니다

```tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { withQueryRequirements } from "@p9v/core";

export const UserCard = withQueryRequirements(
  [userQuery],
  function UserCard({ userId }: { userId: string }) {
    const { data } = useSuspenseQuery(userQuery(userId));
    return <span>{data.name}</span>;
  },
);
```

컴포넌트는 TanStack Query를 직접 사용합니다. hydrated cache에 정확한 key가 없으면
개발 환경에서 조용히 브라우저 요청을 시작하지 않고 `P9vWaterfallError`를 던집니다.

### 3. 라우트 계약을 실행합니다

```tsx
import { defineRouteContract } from "@p9v/core";
import { Prefetch } from "@p9v/core/server";

export const userPage = defineRouteContract({
  name: "user-page",
  load: ({ id }: { id: string }) => [
    { query: userQuery(id), policy: "blocking" },
    { query: statsQuery(id), policy: "streaming" },
  ],
  includes: [UserCard, StatsPanel],
});

export default async function Page({ params }) {
  const { id } = await params;
  return (
    <Prefetch contract={userPage} params={{ id }}>
      <UserCard userId={id} />
      <StatsPanel userId={id} />
    </Prefetch>
  );
}
```

모든 query는 함께 시작됩니다. `blocking`만 서버 boundary를 기다리게 하고,
`streaming`은 pending Promise를 dehydrate합니다. `includes`가 요구하지만 `load`에
없는 계약은 TypeScript와 개발 환경 route 검증에서 실패합니다.

라우트가 `userQuery("u1")`을 준비했는데 컴포넌트가 `userQuery("u2")`를 읽는
경우에도 정확한 key의 cache miss가 런타임에서 잡힙니다.

## 의도적인 클라이언트 query

검색이나 사용자 인터랙션처럼 브라우저에서 시작해야 하는 query는 명시합니다.

```ts
const searchQuery = defineQueryContract({
  name: "search",
  defer: true,
  options: (term: string) => queryOptions({ /* ... */ }),
});

useSuspenseQuery(userQuery(id, { defer: true }));
```

프로덕션에서는 안전하게 TanStack fetch로 fallback합니다. 서버 route query는
`prefetched`, 의도적인 요청은 `intentional-deferred`, 예상 밖 cache miss는
`unexpected-waterfall`로 기록됩니다.

## Devtools와 CI budget

`QueryClientProvider` 안에 패널을 추가합니다.

```tsx
import { P9vDevtools } from "@p9v/core/devtools/react";

<QueryClientProvider client={queryClient}>
  <P9vDevtools />
  {children}
</QueryClientProvider>;
```

`WaterfallRecorder.toJSON()`을 `p9v.record.json`으로 저장하고 다음
`p9v.config.json`을 추가할 수 있습니다.

```json
{
  "maxUnexpectedWaterfalls": 0,
  "maxDepth": 1,
  "maxCriticalPathMs": 500,
  "routes": {
    "dashboard": { "maxCriticalPathMs": 400 }
  }
}
```

```bash
npx p9v analyze
npx p9v analyze artifacts/profile.json --config config/p9v.json
```

전역 또는 route budget을 넘으면 0이 아닌 exit code를 반환합니다. 설정 파일이
없으면 기존처럼 추정 waterfall depth가 1보다 클 때 실패합니다.

## 기존 API 호환성

`defineResource`, `useResource`, `fragment`, `useFragment`,
`defineRouteQuery`, `<Prefetch resources>`는 0.4에서도 그대로 지원합니다.
간단한 p9v 전용 모델에는 Resource API를, field masking이 필요할 때는 fragment를
선택하면 됩니다. 기존 사용자는 마이그레이션할 필요가 없습니다. 자세한 내용은
[0.4 도입 가이드](./MIGRATION.md)를 참고하세요.

## 진입점

| Import | 주요 API |
| --- | --- |
| `@p9v/core` | query/component/route contract, 기존 Resource/fragment API |
| `@p9v/core/react` | `RouteContractProvider`, `P9vProvider`, 기존 read hook |
| `@p9v/core/server` | Next.js/RSC `<Prefetch>`, `getServerQueryClient` |
| `@p9v/core/devtools` | recorder, 분석, `evaluateBudgets` |
| `@p9v/core/devtools/react` | 브라우저 `P9vDevtools` |

## 개발

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

blocking, streaming, 브라우저 waterfall 예시는
[`examples/next-app`](./examples/next-app)에 있습니다.

## 라이선스

[MIT](./LICENSE)
