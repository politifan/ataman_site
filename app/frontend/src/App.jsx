import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import ServicePage from "./pages/ServicePage";
import SchedulePage from "./pages/SchedulePage";
import GalleryPage from "./pages/GalleryPage";
import ContactsPage from "./pages/ContactsPage";
import LegalPage from "./pages/LegalPage";
import PaymentStatePage from "./pages/PaymentStatePage";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboardPage from "./admin/AdminDashboardPage";
import AdminServicesPage from "./admin/AdminServicesPage";
import AdminSchedulePage from "./admin/AdminSchedulePage";
import AdminGalleryPage from "./admin/AdminGalleryPage";
import AdminBookingsPage from "./admin/AdminBookingsPage";
import AdminContactsPage from "./admin/AdminContactsPage";
import AdminSettingsPage from "./admin/AdminSettingsPage";
import { getSite } from "./api";

function LegacyRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search || ""}`} replace />;
}

function LegacyServiceRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  if (slug) {
    return <Navigate to={`/services/${encodeURIComponent(slug)}`} replace />;
  }
  return <Navigate to={`/services${location.search || ""}`} replace />;
}

function AnalyticsBootstrap() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const site = await getSite();
        const metrikaId = String(site?.analytics?.metrika_id || "").trim();
        if (!metrikaId || loaded || window.ym) return;

        window.ym = window.ym || function ymShim() {
          (window.ym.a = window.ym.a || []).push(arguments);
        };
        window.ym.l = Number(new Date());

        const script = document.createElement("script");
        script.async = true;
        script.src = "https://mc.yandex.ru/metrika/tag.js";
        document.head.appendChild(script);

        window.ym(Number(metrikaId), "init", {
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
          webvisor: true
        });
        setLoaded(true);
      } catch (_) {
        // Non-blocking: analytics should never break app rendering.
      }
    }
    init();
  }, [loaded]);

  return null;
}

export default function App() {
  return (
    <>
      <AnalyticsBootstrap />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:slug" element={<ServicePage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/legal" element={<Navigate to="/legal/privacy" replace />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/payment/:state" element={<PaymentStatePage />} />

        <Route path="/privacy.php" element={<LegacyRedirect to="/legal/privacy" />} />
        <Route path="/personal-data.php" element={<LegacyRedirect to="/legal/personal-data" />} />
        <Route path="/terms.php" element={<LegacyRedirect to="/legal/terms" />} />
        <Route path="/offer.php" element={<LegacyRedirect to="/legal/offer" />} />
        <Route path="/marketing.php" element={<LegacyRedirect to="/legal/marketing" />} />
        <Route path="/services.php" element={<LegacyServiceRedirect />} />
        <Route path="/service.php" element={<LegacyServiceRedirect />} />
        <Route path="/schedule.php" element={<LegacyRedirect to="/schedule" />} />
        <Route path="/gallery.php" element={<LegacyRedirect to="/gallery" />} />
        <Route path="/contacts.php" element={<LegacyRedirect to="/contacts" />} />
        <Route path="/contact.php" element={<LegacyRedirect to="/contacts" />} />
        <Route path="/booking.php" element={<LegacyRedirect to="/schedule" />} />
        <Route path="/payment-callback.php" element={<LegacyRedirect to="/payment/waiting" />} />
        <Route path="/booking-success.php" element={<LegacyRedirect to="/payment/success" />} />
        <Route path="/booking-waiting.php" element={<LegacyRedirect to="/payment/waiting" />} />
        <Route path="/booking-failed.php" element={<LegacyRedirect to="/payment/failed" />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="schedule" element={<AdminSchedulePage />} />
          <Route path="gallery" element={<AdminGalleryPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
