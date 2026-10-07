import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { ViewerPage } from '@/pages/ViewerPage';
import { ModelDetailPage } from '@/pages/ModelDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { UploadPage } from '@/pages/UploadPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MyModelsPage } from '@/pages/MyModelsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="viewer/:id" element={<ViewerPage />} />
          <Route path="model/:id" element={<ModelDetailPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="my-models" element={<MyModelsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
