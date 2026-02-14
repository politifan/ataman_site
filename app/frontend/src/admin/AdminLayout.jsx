import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { adminLogin, adminLogout, adminMe, getAdminAuth } from "../api";

export default function AdminLayout() {
  const location = useLocation();
  const [session, setSession] = useState(() => getAdminAuth());
  const [loadingSession, setLoadingSession] = useState(() => Boolean(getAdminAuth()));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session?.access_token) {
      setLoadingSession(false);
      return;
    }

    let cancelled = false;
    setLoadingSession(true);
    adminMe()
      .then((payload) => {
        if (cancelled) return;
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            user: payload.user,
            auth_type: payload.auth_type
          };
        });
      })
      .catch(() => {
        if (cancelled) return;
        adminLogout();
        setSession(null);
        setError("Сессия истекла. Выполните вход снова.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const currentPage = useMemo(() => {
    if (location.pathname.includes("/admin/dashboard")) {
      return {
        title: "Сводка и контроль",
        description: "Оперативные показатели сайта, новые заявки и сообщения."
      };
    }
    if (location.pathname.includes("/admin/bookings")) {
      return {
        title: "Управление бронированиями",
        description: "Фильтруйте заявки, меняйте статусы и контролируйте занятость практик."
      };
    }
    if (location.pathname.includes("/admin/contacts")) {
      return {
        title: "Управление сообщениями",
        description: "Отрабатывайте входящие обращения и фиксируйте статус коммуникации."
      };
    }
    if (location.pathname.includes("/admin/settings")) {
      return {
        title: "Системные настройки",
        description: "Редактируйте контентные и технические ключи без правок кода."
      };
    }
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

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = await adminLogin(username.trim(), password);
      setSession(payload);
      setPassword("");
    } catch (err) {
      setError(err?.message || "Ошибка входа.");
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    adminLogout();
    setSession(null);
    setPassword("");
  }

  if (loadingSession) {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-card">
          <h1>Atman Admin</h1>
          <p className="muted">Проверяем сессию администратора...</p>
        </div>
      </div>
    );
  }

  if (!session?.access_token) {
    return (
      <div className="admin-auth-screen">
        <form className="admin-auth-card" onSubmit={handleLogin}>
          <h1>Atman Admin</h1>
          <p className="muted">Вход в панель управления</p>

          <label htmlFor="admin-login">Логин</label>
          <input
            id="admin-login"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="admin"
            required
          />

          <label htmlFor="admin-password">Пароль</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Введите пароль"
            required
          />

          {error ? <p className="err">{error}</p> : null}

          <button className="btn-main" type="submit" disabled={busy}>
            {busy ? "Входим..." : "Войти"}
          </button>
          <Link className="back-link" to="/">
            ← На сайт
          </Link>
        </form>
      </div>
    );
  }

  const user = session.user || {};

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <h2>Atman Admin</h2>
        <p className="muted">
          {user.username || "admin"} • {user.role || "admin"}
        </p>

        <nav className="admin-nav">
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/services">Услуги</NavLink>
          <NavLink to="/admin/schedule">Расписание</NavLink>
          <NavLink to="/admin/gallery">Галерея</NavLink>
          <NavLink to="/admin/bookings">Записи</NavLink>
          <NavLink to="/admin/contacts">Сообщения</NavLink>
          <NavLink to="/admin/settings">Настройки</NavLink>
        </nav>

        <div className="admin-side-note">
          <p>Рабочий режим</p>
          <strong>Авторизован</strong>
        </div>

        <button className="btn-main small" type="button" onClick={handleLogout}>
          Выйти
        </button>

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
