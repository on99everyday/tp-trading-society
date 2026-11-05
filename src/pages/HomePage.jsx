import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AREAS } from "../course";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";

export function HomePage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login");
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <Home profile={profile} />;
}

const AREA_PATH = {
  videos: "/videos",
  quiz: "/quiz",
  vip: "/vip",
};

function Home({ profile }) {
  return (
    <Shell profile={profile}>
      <section className="mb-6">
        <p className="text-sm text-gold">課程首頁</p>
        <h1 className="mt-1 text-3xl font-semibold">
          {profile ? `${profile.displayName}，繼續學習` : "課程中心"}
        </h1>
      </section>
      <div className="grid gap-3 md:grid-cols-3">
        {AREAS.map((area, index) => (
          <Link
            key={area.id}
            to={AREA_PATH[area.id]}
            className="rounded-xl border border-line bg-surface px-4 py-4 text-left"
          >
            <p className="text-xs font-medium text-gold">0{index + 1}</p>
            <p className="mt-1 text-lg font-semibold">{area.label}</p>
            <p className="mt-1 text-sm text-muted">{area.detail}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
