import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ServicePage from "./pages/ServicePage";
import AdminLayout from "./admin/AdminLayout";
import AdminServicesPage from "./admin/AdminServicesPage";
import AdminSchedulePage from "./admin/AdminSchedulePage";
import AdminGalleryPage from "./admin/AdminGalleryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/services/:slug" element={<ServicePage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/services" replace />} />
        <Route path="services" element={<AdminServicesPage />} />
        <Route path="schedule" element={<AdminSchedulePage />} />
        <Route path="gallery" element={<AdminGalleryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
