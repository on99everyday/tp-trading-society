import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { youtubeId } from "../course";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

export function WatchPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login");
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <Watch profile={profile} />;
}

function Watch({ profile }) {
  const { videoId } = useParams();
  const id = Number(videoId);
  const { db, recordWatch } = useStore();
  const video =
    profile.videos && profile.powers.includes("watch")
      ? db.videos.find((item) => item.id === id) ?? null
      : null;
  const missingEntitlement = profile && !profile.videos;
  const embed = video ? youtubeId(video.sourceUrl) : null;

  useEffect(() => {
    if (!video) return;
    recordWatch(video.id, "open");
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") recordWatch(video.id, "tick");
    }, 15000);
    return () => window.clearInterval(timer);
  }, [video?.id]);

  return (
    <Shell profile={profile}>
      <Link to="/" className="text-sm text-gold">
        返回課程
      </Link>
      {video == null && !missingEntitlement ? <p className="mt-6">找不到這支短片。</p> : null}
      {missingEntitlement ? (
        <p className="mt-6">
          瀏覽視頻要付費後才開啟。基礎會員一次性付費 1499，永久有效。VIP 會員每月付費 1500，亦可瀏覽視頻。
          <Link to="/join" className="ml-2 text-gold">
            前往收費頁
          </Link>
        </p>
      ) : null}
      {video ? (
        <article className="mt-4">
          <p className="text-xs font-medium text-gold">{video.moduleCode}</p>
          <h1 className="mt-1 text-2xl font-semibold">{video.title}</h1>
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-black">
            {embed ? (
              <iframe
                className="aspect-video w-full"
                src={`https://www.youtube.com/embed/${embed}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video className="aspect-video w-full" controls src={video.sourceUrl} />
            )}
          </div>
          {video.description ? (
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">{video.description}</p>
          ) : null}
        </article>
      ) : null}
    </Shell>
  );
}
