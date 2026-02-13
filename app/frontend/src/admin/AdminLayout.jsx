import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { getAdminToken, setAdminToken } from "../api";

export default function AdminLayout() {
  const [token, setToken] = useState(getAdminToken());
  const [saved, setSaved] = useState(false);
  const location = useLocation();

  const currentPage = useMemo(() => {
    if (location.pathname.includes("/admin/schedule")) {
      return {
        title: "Управление расписанием",
        description: "Создавайте события, контролируйте занятость и публикуйте актуальные даты."
      };
    }
    if (location.pathname.includes("/admin/gallery")) {
      return {
        title: "Управление галереей",
        description: "Добавляйте визуальный контент, сортируйте категории и управляйте отображением."
      };
    }
    return {
      title: "Управление услугами",
      description: "Редактируйте карточки практик, описание, формат и медиа-контент."
    };
  }, [location.pathname]);

  const masked = useMemo(() => {
    if (!token) return "not set";
    if (token.length < 8) return "short token";
    return `${token.slice(0, 4)}...${token.slice(-2)}`;
  }, [token]);

  function saveToken() {
    setAdminToken(token.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <h2>Atman Admin</h2>
        <p className="muted">Token: {masked}</p>
        <nav className="admin-nav">
          <NavLink to="/admin/services">Услуги</NavLink>
          <NavLink to="/admin/schedule">Расписание</NavLink>
          <NavLink to="/admin/gallery">Галерея</NavLink>
        </nav>
        <div className="admin-side-note">
          <p>Рабочий режим</p>
          <strong>{token ? "Token активен" : "Нужен token"}</strong>
        </div>
        <div className="admin-token">
          <label htmlFor="admin-token">X-Admin-Token</label>
          <input
            id="admin-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Введите token"
          />
          <button className="btn-main small" type="button" onClick={saveToken}>
            Сохранить token
          </button>
          {saved ? <p className="ok">Сохранено</p> : null}
        </div>
        <Link className="back-link" to="/">
          ← На сайт
        </Link>
      </aside>
      <main className="admin-main">
        <header className="admin-main-headline">
          <p>Панель управления</p>
          <h1>{currentPage.title}</h1>
          <span>{currentPage.description}</span>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
