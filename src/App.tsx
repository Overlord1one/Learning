import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AppShell } from './components/layout/AppShell';
import { BackgroundServices } from './components/BackgroundServices';
import { CelebrationOverlay } from './components/overlays/CelebrationOverlay';
import { Toaster } from './components/overlays/Toaster';
import { useAppStore } from './store/appStore';
import { DashboardPage } from './pages/DashboardPage';
import { StudyPage } from './pages/StudyPage';
import { ShopPage } from './pages/ShopPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SettingsPage } from './pages/SettingsPage';

// Charts (Recharts) are only loaded when the analytics page is opened.
const ProgressPage = lazy(() => import('./pages/ProgressPage').then((m) => ({ default: m.ProgressPage })));

export function App() {
  const motion = useAppStore((s) => s.data.settings.motion);
  return (
    <MotionConfig reducedMotion={motion === 'reduced' ? 'always' : motion === 'full' ? 'never' : 'user'}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="lernen" element={<StudyPage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route
              path="fortschritt"
              element={
                <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-3xl bg-card/60" aria-label="Lädt …" />}>
                  <ProgressPage />
                </Suspense>
              }
            />
            <Route path="erfolge" element={<AchievementsPage />} />
            <Route path="einstellungen" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <CelebrationOverlay />
        <Toaster />
        <BackgroundServices />
      </BrowserRouter>
    </MotionConfig>
  );
}
