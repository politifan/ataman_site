import { useEffect, useMemo, useState } from "react";
import { adminBulkUpdateSettings, adminDeleteSetting, adminListSettings } from "../api";

function sortSettings(rows) {
  return [...rows].sort((a, b) => a.key.localeCompare(b.key, "ru"));
}

export default function AdminSettingsPage() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [newItem, setNewItem] = useState({ key: "", value: "", is_public: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await adminListSettings();
      setRows(sortSettings(data));
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить настройки.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => {
      return [item.key, item.value].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, query]);

  function upsertRow(nextRow) {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.key === nextRow.key);
      if (index === -1) return sortSettings([...prev, nextRow]);
      const clone = [...prev];
      clone[index] = { ...clone[index], ...nextRow };
      return clone;
    });
  }

  async function removeRow(item) {
    if (item.id > 0) {
      try {
        await adminDeleteSetting(item.key);
        setRows((prev) => prev.filter((row) => row.key !== item.key));
        setMessage(`Ключ ${item.key} удален.`);
      } catch (err) {
        setError(err.message || "Не удалось удалить настройку.");
      }
      return;
    }
    setRows((prev) => prev.filter((row) => row.key !== item.key));
  }

  function addNewItem() {
    const key = newItem.key.trim();
    if (!key) {
      setError("Ключ настройки обязателен.");
      return;
    }
    if (rows.some((item) => item.key === key)) {
      setError("Такой ключ уже существует.");
      return;
    }
    upsertRow({
      id: -Date.now(),
      key,
      value: newItem.value,
      is_public: Boolean(newItem.is_public),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setNewItem({ key: "", value: "", is_public: true });
    setError("");
  }

  async function saveAll() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = rows.map((item) => ({
        key: item.key,
        value: item.value ?? "",
        is_public: Boolean(item.is_public)
      }));
      const updated = await adminBulkUpdateSettings(payload);
      setRows(sortSettings(updated));
      setMessage("Настройки сохранены.");
    } catch (err) {
      setError(err.message || "Не удалось сохранить настройки.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Настройки</h1>
          <p className="muted">Всего ключей: {rows.length}</p>
        </div>
        <button className="btn-main small" type="button" onClick={saveAll} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить все"}
        </button>
      </header>

      <div className="admin-toolbar admin-toolbar-settings">
        <input
          className="admin-filter-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по ключам и значениям"
        />
      </div>

      <div className="page-common-panel admin-settings-create">
        <h2>Добавить ключ</h2>
        <div className="admin-settings-create-grid">
          <input
            value={newItem.key}
            onChange={(event) => setNewItem((prev) => ({ ...prev, key: event.target.value }))}
            placeholder="key"
          />
          <input
            value={newItem.value}
            onChange={(event) => setNewItem((prev) => ({ ...prev, value: event.target.value }))}
            placeholder="value"
          />
          <label className="inline">
            <input
              type="checkbox"
              checked={newItem.is_public}
              onChange={(event) => setNewItem((prev) => ({ ...prev, is_public: event.target.checked }))}
            />
            public
          </label>
          <button type="button" className="admin-ghost-btn" onClick={addNewItem}>Добавить</button>
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}
      {loading ? <p className="muted">Загрузка...</p> : null}

      {!loading ? (
        <div className="admin-table-wrap">
          <table className="admin-table admin-settings-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Public</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.key}>
                  <td>
                    <strong>{item.key}</strong>
                  </td>
                  <td>
                    <textarea
                      rows={item.value && String(item.value).length > 80 ? 4 : 2}
                      value={item.value || ""}
                      onChange={(event) => upsertRow({ ...item, value: event.target.value })}
                    />
                  </td>
                  <td>
                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={Boolean(item.is_public)}
                        onChange={(event) => upsertRow({ ...item, is_public: event.target.checked })}
                      />
                      yes
                    </label>
                  </td>
                  <td className="admin-actions-inline">
                    <button type="button" className="danger" onClick={() => removeRow(item)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
