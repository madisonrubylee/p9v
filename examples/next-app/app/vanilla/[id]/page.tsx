import { apiGet, type Posts, type Stats, type User } from "../../lib/api";
import { Card, Page } from "../../components/ui";

/**
 * Vanilla version: the classic "nested component waterfall". Each async section
 * awaits its own data before rendering the next section, so the three requests
 * run strictly one after another. This is the footgun the TanStack docs warn
 * about — and what p9v makes structurally impossible.
 */
export default async function VanillaUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Page heading="Vanilla — nested waterfall">
      <UserSection id={id} />
    </Page>
  );
}

async function UserSection({ id }: { id: string }) {
  const user = await apiGet<User>(`/api/user/${id}`);
  return (
    <>
      <Card title="Profile">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.avatarUrl}
            alt=""
            width={56}
            height={56}
            style={{ borderRadius: "50%" }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{user.name}</div>
            <div style={{ opacity: 0.6, fontSize: 13 }}>#{user.id}</div>
          </div>
        </div>
      </Card>
      {/* child only renders after the parent's await resolves */}
      <StatsSection id={id} />
    </>
  );
}

async function StatsSection({ id }: { id: string }) {
  const stats = await apiGet<Stats>(`/api/stats/${id}`);
  return (
    <>
      <Card title="Stats">
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {stats.followers.toLocaleString()}
            </div>
            <div style={{ opacity: 0.6, fontSize: 12 }}>Followers</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {stats.contributions.toLocaleString()}
            </div>
            <div style={{ opacity: 0.6, fontSize: 12 }}>Contributions</div>
          </div>
        </div>
      </Card>
      <PostsSection id={id} />
    </>
  );
}

async function PostsSection({ id }: { id: string }) {
  const posts = await apiGet<Posts>(`/api/posts/${id}`);
  return (
    <Card title="Recent posts">
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
        {posts.items.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </Card>
  );
}
