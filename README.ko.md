# p9v

[English](./README.md) | 한국어

**Prefetch → View.** REST와 [TanStack Query](https://tanstack.com/query)를 위한 Relay 스타일 데이터 레이어로, 요청 워터폴(Waterfall)을 나중에 탐지하는 데 그치지 않고 **구조적으로 일어날 수 없게** 만듭니다.

컴포넌트는 필요한 필드를 스스로 선언합니다. 그러면 타입 시스템이 해당 요구사항을 라우트 단에서 프리페치(Prefetch)하도록 강제합니다. 만약 컴포넌트가 렌더링될 때 필요한 데이터가 없다면, 그게 바로 워터폴입니다. p9v는 이를 조용히 클라이언트 페칭으로 넘기는 대신 **명확한 에러**로 드러냅니다.

```tsx
// 1. Define a resource once
export const userResource = defineResource({
  name: "user",
  key: (id: string) => ["user", id] as const,
  fetch: (id) => api.get<User>(`/users/${id}`),
});

// 2. A component declares exactly what it needs (colocated)
const UserCard_user = fragment(userResource, ["id", "name", "avatarUrl"]);

function UserCard({ userId }: { userId: string }) {
  const user = useFragment(UserCard_user, userId);
  //    ^? { id: string; name: string; avatarUrl: string }
  return <div>{user.name}</div>; // reading user.email is a type error
}
UserCard.fragments = [UserCard_user] as const;

// 3. The route prefetches everything in parallel
export const userPageQuery = defineRouteQuery({
  name: "user-page",
  root: (p: { id: string }) => [userResource(p.id), statsResource(p.id)],
  includes: [UserCard, StatsPanel],
});

// app/users/[id]/page.tsx
export default async function Page({ params }) {
  const { id } = await params;
  return (
    <Prefetch id params="{{" query="{userPageQuery}" }}>
      <UserCard userId="{id}"/>
      <StatsPanel userId="{id}"/>
    </Prefetch>
  );
}
