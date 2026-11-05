import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pending, PowerTable, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

export function PowersPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();
  const { db, setPower } = useStore();
  const [error, setError] = useState("");

  useEffect(() => {
    if (pending) return;
    if (!profile) navigate("/login");
    else if (!profile.powers.includes("powers")) navigate("/");
  }, [pending, profile, navigate]);

  if (pending || !profile || !profile.powers.includes("powers")) return <Pending />;

  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">角色權力</p>
      <h1 className="mt-1 text-3xl font-semibold">各角色可以使用的功能</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        管理員可以開關學員、工作人員和管理員的權力。人員本身的角色，在後台的權限設定裡調換。
      </p>
      <Link to="/staff" className="mt-4 inline-block text-sm font-medium text-gold">
        返回後台
      </Link>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-6">
        <PowerTable
          rows={db.powers}
          onChange={(role, permission, enabled) => {
            try {
              setError("");
              setPower(role, permission, enabled);
            } catch (err) {
              setError(err instanceof Error ? err.message : "更新失敗");
            }
          }}
        />
      </div>
    </Shell>
  );
}
