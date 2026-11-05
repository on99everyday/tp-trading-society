import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../icons";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

export function VideosPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login");
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <Videos profile={profile} />;
}

function Videos({ profile }) {
  const { db } = useStore();
  const videos = db.videos;
  const modules = db.modules;

  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">教學短片區</p>
      <h1 className="mt-1 text-3xl font-semibold">已上傳的教學短片</h1>
      <Link to="/" className="mt-3 inline-block text-sm font-medium text-gold">
        返回課程首頁
      </Link>
      {!profile.videos ? (
        <p className="mt-6 text-muted">
          瀏覽視頻要付費後才開啟。基礎會員一次性付費 1499，永久有效。VIP 會員每月付費 1500，亦可瀏覽視頻。
          <Link to="/join" className="ml-2 text-gold">
            前往收費頁
          </Link>
        </p>
      ) : !profile.powers.includes("watch") ? (
        <p className="mt-6 text-muted">你的角色目前沒有觀看短片的權力。</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {modules.map((module) => {
            const clips = videos.filter((video) => video.moduleCode === module.code);
            return (
              <article key={module.code} className="rounded-xl border border-line bg-surface p-5">
                <p className="text-xs font-medium tracking-wide text-gold">{module.code}</p>
                <h2 className="mt-1 text-lg font-semibold">{module.title}</h2>
                <p className="mt-1 text-sm text-muted">{module.blurb}</p>
                <div className="mt-4 space-y-2">
                  {clips.length === 0 ? (
                    <p className="text-sm text-muted">尚未上架短片</p>
                  ) : (
                    clips.map((video) => (
                      <Link
                        key={video.id}
                        to={`/watch/${video.id}`}
                        className="flex items-center gap-2 rounded-lg bg-bg px-3 py-3 text-sm hover:text-gold"
                      >
                        <Icon name="play" className="size-4 text-gold" />
                        {video.title}
                      </Link>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
