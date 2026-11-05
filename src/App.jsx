import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { JoinPage } from "./pages/JoinPage";
import { LoginPage } from "./pages/LoginPage";
import { PowersPage } from "./pages/PowersPage";
import { StaffPage } from "./pages/StaffPage";
import { VideosPage } from "./pages/VideosPage";
import { VipPage } from "./pages/VipPage";
import { WatchPage } from "./pages/WatchPage";

const ResetPage = lazy(() => import("./pages/ResetPage"));

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/reset"
        element={
          <Suspense fallback={<p className="px-6 py-16 text-center text-muted">正在確認重設連結…</p>}>
            <ResetPage />
          </Suspense>
        }
      />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/videos" element={<VideosPage />} />
      <Route path="/vip" element={<VipPage />} />
      <Route path="/watch/:videoId" element={<WatchPage />} />
      <Route path="/staff" element={<StaffPage />} />
      <Route path="/powers" element={<PowersPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
