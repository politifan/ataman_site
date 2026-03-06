import { useEffect, useMemo, useState } from "react";
import {
  adminCreateService,
  adminDeleteService,
  adminListServices,
  adminUploadFile,
  adminUpdateService,
  toMediaUrl
} from "../api";
import AdminSelect from "./AdminSelect";

const basePayload = {
  slug: "",
  title: "",
  category: "",
  category_label: "",
  format_mode: "group_and_individual",
  teaser: "",
  duration: "",
  pricing: {},
  about: [],
  suitable_for: [],
  host: {},
  important: [],
  dress_code: [],
  contraindications: [],
  media: [],
  age_restriction: "",
  is_draft: false,
  is_active: true
};

const SERVICE_WIZARD_STEPS = [
  {
    id: "base",
    title: "Основа",
    description: "Название, адрес и формат услуги."
  },
  {
    id: "description",
    title: "Описание",
    description: "Коротко о практике и базовые параметры."
  },
  {
    id: "pricing",
    title: "Стоимость",
    description: "Цены заполняются готовыми полями."
  },
  {
    id: "content",
    title: "Контент",
    description: "Пункты для блоков страницы услуги."
  },
  {
    id: "media",
    title: "Медиа и публикация",
    description: "Превью, загрузка и замена файлов."
  }
];

const CYRILLIC_TO_LATIN = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
};

function slugify(value) {
  const transliterated = String(value || "")
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");

  return transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatModeLabel(value) {
  return value === "individual_only" ? "Только индивидуально" : "Групповой и индивидуальный";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeList(items) {
  return asArray(items)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function parsePrice(value, fieldLabel) {
  const raw = String(value || "").trim().replace(",", ".");
  if (!raw) {
    throw new Error(`Заполните поле «${fieldLabel}».`);
  }

  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`В поле «${fieldLabel}» укажите корректную сумму.`);
  }

  return price;
}

function toEditor(service) {
  const row = service || basePayload;
  const pricing = row.pricing || {};

  const knownPricingKeys = new Set(["group", "individual", "fixed", "extra"]);
  const pricingOther = Object.fromEntries(
    Object.entries(pricing).filter(([key]) => !knownPricingKeys.has(key))
  );

  return {
    ...basePayload,
    ...row,
    about_items: asArray(row.about),
    suitable_for_items: asArray(row.suitable_for),
    important_items: asArray(row.important),
    dress_code_items: asArray(row.dress_code),
    contraindications_items: asArray(row.contraindications),
    media_items: asArray(row.media),
    host_name: row.host?.name || "",
    host_bio: row.host?.bio || "",

    pricing_group_enabled: Boolean(pricing.group),
    pricing_group_label: pricing.group?.label || "Групповая практика",
    pricing_group_price:
      pricing.group?.price_per_person !== undefined && pricing.group?.price_per_person !== null
        ? String(pricing.group.price_per_person)
        : "",
    pricing_group_cta: pricing.group?.cta || "Просмотреть расписание",

    pricing_individual_enabled: Boolean(pricing.individual),
    pricing_individual_label: pricing.individual?.label || "Индивидуальная сессия",
    pricing_individual_price:
      pricing.individual?.price !== undefined && pricing.individual?.price !== null
        ? String(pricing.individual.price)
        : "",
    pricing_individual_cta: pricing.individual?.cta || "Записаться",

    pricing_fixed_enabled: Boolean(pricing.fixed),
    pricing_fixed_label: pricing.fixed?.label || "Фиксированная стоимость",
    pricing_fixed_price:
      pricing.fixed?.price !== undefined && pricing.fixed?.price !== null
        ? String(pricing.fixed.price)
        : "",
    pricing_fixed_cta: pricing.fixed?.cta || "Записаться",

    pricing_extra_enabled: Boolean(pricing.extra),
    pricing_extra_label: pricing.extra?.label || "Дополнительная опция",
    pricing_extra_price:
      pricing.extra?.price !== undefined && pricing.extra?.price !== null
        ? String(pricing.extra.price)
        : "",

    pricing_other: pricingOther
  };
}

function toPayload(editor) {
  const pricing = { ...(editor.pricing_other || {}) };

  if (editor.pricing_group_enabled) {
    pricing.group = {
      label: editor.pricing_group_label.trim() || "Групповая практика",
      price_per_person: parsePrice(editor.pricing_group_price, "Групповая цена"),
      cta: editor.pricing_group_cta.trim() || "Просмотреть расписание"
    };
  }

  if (editor.pricing_individual_enabled) {
    pricing.individual = {
      label: editor.pricing_individual_label.trim() || "Индивидуальная сессия",
      price: parsePrice(editor.pricing_individual_price, "Индивидуальная цена"),
      cta: editor.pricing_individual_cta.trim() || "Записаться"
    };
  }

  if (editor.pricing_fixed_enabled) {
    pricing.fixed = {
      label: editor.pricing_fixed_label.trim() || "Фиксированная стоимость",
      price: parsePrice(editor.pricing_fixed_price, "Фиксированная цена"),
      cta: editor.pricing_fixed_cta.trim() || "Записаться"
    };
  }

  if (editor.pricing_extra_enabled) {
    pricing.extra = {
      label: editor.pricing_extra_label.trim() || "Дополнительная опция",
      price: parsePrice(editor.pricing_extra_price, "Стоимость доп. опции")
    };
  }

  return {
    slug: editor.slug.trim(),
    title: editor.title.trim(),
    category: editor.category.trim() || null,
    category_label: editor.category_label.trim() || null,
    format_mode: editor.format_mode,
    teaser: editor.teaser.trim() || null,
    duration: editor.duration.trim() || null,
    pricing,
    about: normalizeList(editor.about_items),
    suitable_for: normalizeList(editor.suitable_for_items),
    host: {
      name: editor.host_name.trim(),
      bio: editor.host_bio.trim()
    },
    important: normalizeList(editor.important_items),
    dress_code: normalizeList(editor.dress_code_items),
    contraindications: normalizeList(editor.contraindications_items),
    media: normalizeList(editor.media_items),
    age_restriction: editor.age_restriction.trim() || null,
    is_draft: Boolean(editor.is_draft),
    is_active: Boolean(editor.is_active)
  };
}

function ListEditor({ label, value, onChange, placeholder, multiline = false }) {
  const items = asArray(value);

  function updateItem(index, nextValue) {
    const next = [...items];
    next[index] = nextValue;
    onChange(next);
  }

  function removeItem(index) {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(next);
  }

  function addItem() {
    onChange([...items, ""]);
  }

  return (
    <div className="admin-list-editor">
      <p>{label}</p>
      {items.map((item, index) => (
        <div className="admin-list-editor-row" key={`${label}-${index}`}>
          {multiline ? (
            <textarea
              rows={2}
              value={item}
              placeholder={placeholder}
              onChange={(event) => updateItem(index, event.target.value)}
            />
          ) : (
            <input
              value={item}
              placeholder={placeholder}
              onChange={(event) => updateItem(index, event.target.value)}
            />
          )}
          <button type="button" className="danger" onClick={() => removeItem(index)}>
            Удалить
          </button>
        </div>
      ))}
      <button type="button" className="admin-ghost-btn" onClick={addItem}>
        + Добавить пункт
      </button>
    </div>
  );
}

function isVideoPath(path) {
  return /\.(mp4|webm|mov|m4v)$/i.test(String(path || ""));
}

export default function AdminServicesPage() {
  const [items, setItems] = useState([]);
  const [editor, setEditor] = useState(toEditor(null));
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("cards");
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [stepIndex, setStepIndex] = useState(0);
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingReplaceIndex, setUploadingReplaceIndex] = useState(null);
  const [mediaPathDraft, setMediaPathDraft] = useState("");

  const totalSteps = SERVICE_WIZARD_STEPS.length;
  const currentStep = SERVICE_WIZARD_STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  async function load() {
    setLoading(true);
    try {
      const data = await adminListServices();
      setItems(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (formatFilter !== "all" && row.format_mode !== formatFilter) return false;
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      if (!q) return true;
      return [row.title, row.slug, row.category_label, row.category]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(q));
    });
  }, [items, query, formatFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.is_active).length;
    const draft = items.filter((item) => item.is_draft).length;
    const categories = new Set(items.map((item) => item.category || item.category_label).filter(Boolean)).size;
    return {
      total: items.length,
      active,
      draft,
      categories
    };
  }, [items]);

  function resetFilters() {
    setQuery("");
    setFormatFilter("all");
    setStatusFilter("all");
  }

  function openCreate() {
    setEditingId(null);
    setEditor(toEditor(null));
    setStepIndex(0);
    setIsSlugManual(false);
    setMediaPathDraft("");
    setModalOpen(true);
    setMessage("");
    setError("");
  }

  function openEdit(row) {
    setEditingId(row.id);
    setEditor(toEditor(row));
    setStepIndex(0);
    setIsSlugManual(true);
    setMediaPathDraft("");
    setModalOpen(true);
    setMessage("");
    setError("");
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setEditor(toEditor(null));
    setStepIndex(0);
    setIsSlugManual(false);
    setMediaPathDraft("");
  }

  function onTitleChange(nextTitle) {
    setEditor((prev) => {
      const next = { ...prev, title: nextTitle };
      if (!isSlugManual) {
        next.slug = slugify(nextTitle);
      }
      return next;
    });
  }

  function onSlugChange(nextSlug) {
    setIsSlugManual(true);
    setEditor((prev) => ({ ...prev, slug: nextSlug }));
  }

  function generateSlugFromTitle() {
    setIsSlugManual(false);
    setEditor((prev) => ({ ...prev, slug: slugify(prev.title) }));
  }

  function validateWizardStep(index) {
    if (index === 0) {
      if (!editor.title.trim()) {
        throw new Error("Заполните название услуги.");
      }
      if (!editor.slug.trim()) {
        throw new Error("Заполните адрес услуги.");
      }
    }

    if (index === 2) {
      if (
        !editor.pricing_group_enabled &&
        !editor.pricing_individual_enabled &&
        !editor.pricing_fixed_enabled &&
        !editor.pricing_extra_enabled &&
        !Object.keys(editor.pricing_other || {}).length
      ) {
        throw new Error("Добавьте хотя бы один вариант стоимости.");
      }

      if (editor.pricing_group_enabled) parsePrice(editor.pricing_group_price, "Групповая цена");
      if (editor.pricing_individual_enabled) parsePrice(editor.pricing_individual_price, "Индивидуальная цена");
      if (editor.pricing_fixed_enabled) parsePrice(editor.pricing_fixed_price, "Фиксированная цена");
      if (editor.pricing_extra_enabled) parsePrice(editor.pricing_extra_price, "Стоимость доп. опции");
    }
  }

  function goToStep(nextIndex) {
    if (nextIndex < 0 || nextIndex >= totalSteps) return;
    if (nextIndex <= stepIndex) {
      setStepIndex(nextIndex);
      return;
    }

    try {
      for (let index = stepIndex; index < nextIndex; index += 1) {
        validateWizardStep(index);
      }
      setError("");
      setStepIndex(nextIndex);
    } catch (err) {
      setError(err.message || "Проверьте поля текущего шага.");
    }
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = toPayload(editor);
      if (!payload.slug || !payload.title) throw new Error("Название и адрес обязательны.");

      if (editingId) {
        await adminUpdateService(editingId, payload);
        setMessage("Услуга обновлена.");
      } else {
        await adminCreateService(payload);
        setMessage("Услуга создана.");
      }

      await load();
      closeModal();
    } catch (err) {
      setError(err.message || "Ошибка сохранения.");
    }
  }

  async function remove(id) {
    if (!window.confirm("Удалить услугу?")) return;
    try {
      await adminDeleteService(id);
      setMessage("Услуга удалена.");
      await load();
      if (editingId === id) closeModal();
    } catch (err) {
      setError(err.message || "Ошибка удаления.");
    }
  }

  async function uploadMediaFile(file, { replaceIndex = null } = {}) {
    if (!file) return;
    setUploading(true);
    setError("");
    if (replaceIndex !== null) {
      setUploadingReplaceIndex(replaceIndex);
    }

    try {
      const result = await adminUploadFile(file, "services");
      const nextPath = String(result.path || "").trim();
      if (!nextPath) throw new Error("Сервер не вернул путь к файлу.");

      setEditor((prev) => {
        const current = asArray(prev.media_items);
        const next = [...current];
        if (replaceIndex !== null && replaceIndex >= 0 && replaceIndex < next.length) {
          next[replaceIndex] = nextPath;
        } else {
          next.push(nextPath);
        }
        return {
          ...prev,
          media_items: next
        };
      });

      setMessage(replaceIndex !== null ? "Файл заменён." : "Файл загружен и добавлен.");
    } catch (err) {
      setError(err.message || "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
      setUploadingReplaceIndex(null);
    }
  }

  function removeMediaItem(index) {
    setEditor((prev) => ({
      ...prev,
      media_items: asArray(prev.media_items).filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function moveMediaItem(index, direction) {
    setEditor((prev) => {
      const next = [...asArray(prev.media_items)];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return prev;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, media_items: next };
    });
  }

  function addMediaPath() {
    const path = mediaPathDraft.trim();
    if (!path) return;

    setEditor((prev) => ({
      ...prev,
      media_items: [...asArray(prev.media_items), path]
    }));
    setMediaPathDraft("");
  }

  return (
    <section>
      <header className="admin-head">
        <div>
          <h1>Услуги</h1>
          <p className="muted">Показано: {filtered.length} из {items.length}</p>
        </div>
        <button className="btn-main small" type="button" onClick={openCreate}>
          Новая услуга
        </button>
      </header>

      <div className="admin-toolbar">
        <input
          className="admin-filter-input"
          placeholder="Поиск: название / адрес / категория"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <AdminSelect
          value={formatFilter}
          onChange={(nextValue) => setFormatFilter(nextValue)}
          options={[
            { value: "all", label: "Все форматы" },
            { value: "group_and_individual", label: "Групповой и индивидуальный" },
            { value: "individual_only", label: "Только индивидуальный" }
          ]}
        />
        <AdminSelect
          value={statusFilter}
          onChange={(nextValue) => setStatusFilter(nextValue)}
          options={[
            { value: "all", label: "Все статусы" },
            { value: "active", label: "Только активные" },
            { value: "inactive", label: "Только скрытые" }
          ]}
        />
        <div className="admin-view-toggle">
          <button
            type="button"
            className={viewMode === "cards" ? "is-active" : ""}
            onClick={() => setViewMode("cards")}
          >
            Карточки
          </button>
          <button
            type="button"
            className={viewMode === "table" ? "is-active" : ""}
            onClick={() => setViewMode("table")}
          >
            Таблица
          </button>
        </div>
        <button type="button" className="admin-ghost-btn" onClick={resetFilters}>
          Сбросить
        </button>
      </div>

      <div className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <p>Всего услуг</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Активные</p>
          <strong>{stats.active}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Черновики</p>
          <strong>{stats.draft}</strong>
        </article>
        <article className="admin-kpi-card">
          <p>Категории</p>
          <strong>{stats.categories}</strong>
        </article>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      {loading ? <p className="muted">Загрузка...</p> : null}
      {!loading && filtered.length === 0 ? (
        <div className="admin-empty">
          <h3>Ничего не найдено</h3>
          <p>Сбросьте фильтры или измените поисковый запрос.</p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewMode === "table" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Название</th>
                <th>Адрес</th>
                <th>Формат</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.title}</td>
                  <td>{row.slug}</td>
                  <td>{formatModeLabel(row.format_mode)}</td>
                  <td>{row.is_active ? "Активна" : "Скрыта"}</td>
                  <td className="admin-actions-inline">
                    <button type="button" onClick={() => openEdit(row)}>
                      Изм.
                    </button>
                    <button type="button" className="danger" onClick={() => remove(row.id)}>
                      Удал.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && filtered.length > 0 && viewMode === "cards" ? (
        <div className="admin-list">
          {filtered.map((row) => (
            <article key={row.id} className="admin-list-item">
              <div>
                <strong>{row.title}</strong>
                <p>{row.slug}</p>
                <div className="admin-tags">
                  <span>{formatModeLabel(row.format_mode)}</span>
                  <span>{row.category_label || row.category || "Без категории"}</span>
                  <span>{row.is_active ? "Активна" : "Скрыта"}</span>
                </div>
              </div>
              <div className="admin-actions">
                <button type="button" onClick={() => openEdit(row)}>
                  Изм.
                </button>
                <button type="button" className="danger" onClick={() => remove(row.id)}>
                  Удал.
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="admin-modal" onClick={closeModal}>
          <div className="admin-modal-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Закрыть">
              ×
            </button>
            <form className="admin-form admin-services-wizard" onSubmit={save}>
              <h2>{editingId ? `Редактирование #${editingId}` : "Создание услуги"}</h2>

              <div className="admin-services-wizard-head">
                <p>
                  Шаг {stepIndex + 1} из {totalSteps}
                </p>
                <strong>{currentStep.title}</strong>
                <span>{currentStep.description}</span>
              </div>

              <div className="admin-services-stepper" role="tablist" aria-label="Шаги редактирования услуги">
                {SERVICE_WIZARD_STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    className={index === stepIndex ? "is-active" : ""}
                    onClick={() => goToStep(index)}
                  >
                    {index + 1}. {step.title}
                  </button>
                ))}
              </div>

              <div className="admin-services-carousel">
                <div
                  className="admin-services-carousel-track"
                  style={{ transform: `translateX(-${stepIndex * 100}%)` }}
                >
                  <section className="admin-services-step" aria-hidden={stepIndex !== 0}>
                    <h3>Основные параметры</h3>
                    <label>
                      Название услуги
                      <input
                        value={editor.title}
                        onChange={(event) => onTitleChange(event.target.value)}
                        placeholder="Например: Гонг-медитация"
                        required
                      />
                    </label>

                    <label>
                      Адрес услуги
                      <div className="admin-slug-row">
                        <input
                          value={editor.slug}
                          onChange={(event) => onSlugChange(event.target.value)}
                          placeholder="gong-meditatsiya"
                          required
                        />
                        <button type="button" className="admin-ghost-btn" onClick={generateSlugFromTitle}>
                          Сгенерировать
                        </button>
                      </div>
                      <small className="muted">Используется в ссылке на услугу: `/services/{editor.slug || "..."}`</small>
                    </label>

                    <label>
                      Категория (технический код)
                      <input
                        value={editor.category}
                        onChange={(event) => setEditor((prev) => ({ ...prev, category: event.target.value }))}
                        placeholder="zvukoterapiya"
                      />
                    </label>

                    <label>
                      Название категории
                      <input
                        value={editor.category_label}
                        onChange={(event) => setEditor((prev) => ({ ...prev, category_label: event.target.value }))}
                        placeholder="Звукотерапия"
                      />
                    </label>

                    <label>
                      Формат проведения
                      <AdminSelect
                        value={editor.format_mode}
                        onChange={(nextValue) => setEditor((prev) => ({ ...prev, format_mode: nextValue }))}
                        options={[
                          { value: "group_and_individual", label: "Групповой и индивидуальный" },
                          { value: "individual_only", label: "Только индивидуальный" }
                        ]}
                      />
                    </label>
                  </section>

                  <section className="admin-services-step" aria-hidden={stepIndex !== 1}>
                    <h3>Описание услуги</h3>
                    <label>
                      Краткий анонс
                      <textarea
                        rows={4}
                        value={editor.teaser}
                        onChange={(event) => setEditor((prev) => ({ ...prev, teaser: event.target.value }))}
                        placeholder="Короткое описание для карточек и шапки услуги"
                      />
                    </label>

                    <label>
                      Длительность
                      <input
                        value={editor.duration}
                        onChange={(event) => setEditor((prev) => ({ ...prev, duration: event.target.value }))}
                        placeholder="60 минут"
                      />
                    </label>

                    <label>
                      Возрастное ограничение
                      <input
                        value={editor.age_restriction}
                        onChange={(event) => setEditor((prev) => ({ ...prev, age_restriction: event.target.value }))}
                        placeholder="18+"
                      />
                    </label>
                  </section>

                  <section className="admin-services-step" aria-hidden={stepIndex !== 2}>
                    <h3>Стоимость</h3>

                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={editor.pricing_group_enabled}
                        onChange={(event) =>
                          setEditor((prev) => ({ ...prev, pricing_group_enabled: event.target.checked }))
                        }
                      />
                      Включить групповую цену
                    </label>
                    {editor.pricing_group_enabled ? (
                      <div className="admin-pricing-grid">
                        <label>
                          Подпись
                          <input
                            value={editor.pricing_group_label}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_group_label: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Групповая цена (за человека)
                          <input
                            type="number"
                            min={1}
                            value={editor.pricing_group_price}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_group_price: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Текст кнопки
                          <input
                            value={editor.pricing_group_cta}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_group_cta: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={editor.pricing_individual_enabled}
                        onChange={(event) =>
                          setEditor((prev) => ({ ...prev, pricing_individual_enabled: event.target.checked }))
                        }
                      />
                      Включить индивидуальную цену
                    </label>
                    {editor.pricing_individual_enabled ? (
                      <div className="admin-pricing-grid">
                        <label>
                          Подпись
                          <input
                            value={editor.pricing_individual_label}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_individual_label: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Индивидуальная цена
                          <input
                            type="number"
                            min={1}
                            value={editor.pricing_individual_price}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_individual_price: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Текст кнопки
                          <input
                            value={editor.pricing_individual_cta}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_individual_cta: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={editor.pricing_fixed_enabled}
                        onChange={(event) =>
                          setEditor((prev) => ({ ...prev, pricing_fixed_enabled: event.target.checked }))
                        }
                      />
                      Включить фиксированную цену
                    </label>
                    {editor.pricing_fixed_enabled ? (
                      <div className="admin-pricing-grid">
                        <label>
                          Подпись
                          <input
                            value={editor.pricing_fixed_label}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_fixed_label: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Фиксированная цена
                          <input
                            type="number"
                            min={1}
                            value={editor.pricing_fixed_price}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_fixed_price: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Текст кнопки
                          <input
                            value={editor.pricing_fixed_cta}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_fixed_cta: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={editor.pricing_extra_enabled}
                        onChange={(event) =>
                          setEditor((prev) => ({ ...prev, pricing_extra_enabled: event.target.checked }))
                        }
                      />
                      Включить дополнительную опцию
                    </label>
                    {editor.pricing_extra_enabled ? (
                      <div className="admin-pricing-grid">
                        <label>
                          Подпись
                          <input
                            value={editor.pricing_extra_label}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_extra_label: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Стоимость доп. опции
                          <input
                            type="number"
                            min={1}
                            value={editor.pricing_extra_price}
                            onChange={(event) =>
                              setEditor((prev) => ({ ...prev, pricing_extra_price: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </section>

                  <section className="admin-services-step" aria-hidden={stepIndex !== 3}>
                    <h3>Содержимое страницы</h3>

                    <ListEditor
                      label="О практике"
                      value={editor.about_items}
                      onChange={(next) => setEditor((prev) => ({ ...prev, about_items: next }))}
                      placeholder="Текст пункта"
                      multiline
                    />

                    <ListEditor
                      label="Практика подойдёт, если"
                      value={editor.suitable_for_items}
                      onChange={(next) => setEditor((prev) => ({ ...prev, suitable_for_items: next }))}
                      placeholder="Текст пункта"
                    />

                    <ListEditor
                      label="Важно"
                      value={editor.important_items}
                      onChange={(next) => setEditor((prev) => ({ ...prev, important_items: next }))}
                      placeholder="Текст пункта"
                    />

                    <ListEditor
                      label="Форма одежды"
                      value={editor.dress_code_items}
                      onChange={(next) => setEditor((prev) => ({ ...prev, dress_code_items: next }))}
                      placeholder="Текст пункта"
                    />

                    <ListEditor
                      label="Противопоказания"
                      value={editor.contraindications_items}
                      onChange={(next) => setEditor((prev) => ({ ...prev, contraindications_items: next }))}
                      placeholder="Текст пункта"
                    />

                    <label>
                      Ведущий
                      <input
                        value={editor.host_name}
                        onChange={(event) => setEditor((prev) => ({ ...prev, host_name: event.target.value }))}
                        placeholder="Имя и роль"
                      />
                    </label>

                    <label>
                      О ведущем
                      <textarea
                        rows={4}
                        value={editor.host_bio}
                        onChange={(event) => setEditor((prev) => ({ ...prev, host_bio: event.target.value }))}
                        placeholder="Короткое био"
                      />
                    </label>
                  </section>

                  <section className="admin-services-step" aria-hidden={stepIndex !== 4}>
                    <h3>Медиа</h3>

                    <div className="admin-media-add-row">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(event) => uploadMediaFile(event.target.files?.[0])}
                      />
                      <small className="muted">{uploading ? "Загрузка..." : "Можно загружать фото и видео"}</small>
                    </div>

                    <div className="admin-media-path-row">
                      <input
                        value={mediaPathDraft}
                        onChange={(event) => setMediaPathDraft(event.target.value)}
                        placeholder="Или вставьте путь к файлу вручную"
                      />
                      <button type="button" className="admin-ghost-btn" onClick={addMediaPath}>
                        Добавить путь
                      </button>
                    </div>

                    {asArray(editor.media_items).length === 0 ? (
                      <p className="muted">Файлы пока не добавлены.</p>
                    ) : (
                      <div className="admin-services-media-grid">
                        {asArray(editor.media_items).map((path, index) => (
                          <article key={`${path}-${index}`} className="admin-services-media-card">
                            <div className="admin-services-media-preview">
                              {isVideoPath(path) ? (
                                <video src={toMediaUrl(path)} muted loop playsInline controls />
                              ) : (
                                <img src={toMediaUrl(path)} alt={`Медиа ${index + 1}`} loading="lazy" />
                              )}
                            </div>
                            <p>{path}</p>
                            <div className="admin-services-media-actions">
                              <label>
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  onChange={(event) => uploadMediaFile(event.target.files?.[0], { replaceIndex: index })}
                                />
                                <span>
                                  {uploadingReplaceIndex === index && uploading ? "Загрузка..." : "Заменить"}
                                </span>
                              </label>
                              <button type="button" onClick={() => moveMediaItem(index, -1)} disabled={index === 0}>
                                Вверх
                              </button>
                              <button
                                type="button"
                                onClick={() => moveMediaItem(index, 1)}
                                disabled={index === asArray(editor.media_items).length - 1}
                              >
                                Вниз
                              </button>
                              <button type="button" className="danger" onClick={() => removeMediaItem(index)}>
                                Удалить
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={editor.is_draft}
                        onChange={(event) => setEditor((prev) => ({ ...prev, is_draft: event.target.checked }))}
                      />
                      Черновик (не показывать как финальную услугу)
                    </label>

                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={editor.is_active}
                        onChange={(event) => setEditor((prev) => ({ ...prev, is_active: event.target.checked }))}
                      />
                      Показывать на сайте
                    </label>
                  </section>
                </div>
              </div>

              <div className="admin-services-wizard-actions">
                <button
                  type="button"
                  className="admin-ghost-btn"
                  onClick={() => goToStep(stepIndex - 1)}
                  disabled={isFirstStep}
                >
                  Назад
                </button>
                {!isLastStep ? (
                  <button type="button" className="btn-main" onClick={() => goToStep(stepIndex + 1)}>
                    Далее
                  </button>
                ) : (
                  <button className="btn-main" type="submit">
                    Сохранить услугу
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
