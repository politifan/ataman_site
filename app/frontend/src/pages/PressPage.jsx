import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPressVideos, toMediaUrl } from "../api";

function isExternal(value = "") {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export default function PressPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setItems(await getPressVideos());
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить видео.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="state-page">Загрузка...</div>;
  if (error) return <div className="state-page">Ошибка: {error}</div>;

  return (
    <div className="page-common page-press">
      <div className="container">
        <header className="page-common-head">
          <div>
            <p>Студия Атман</p>
            <h1>О нас в СМИ</h1>
            <span>Репортажи, сюжеты, видео с мероприятий и другие материалы о студии.</span>
          </div>
          <div className="page-common-actions">
            <Link className="back-link" to="/">
              ← На главную
            </Link>
          </div>
        </header>

        {items.length === 0 ? (
          <div className="page-common-panel press-empty">
            <h2>Видео пока не добавлены</h2>
            <p>Материалы появятся здесь сразу после загрузки через админку.</p>
          </div>
        ) : (
          <section className="press-grid">
            {items.map((item) => {
              const videoSrc = item.video_path ? toMediaUrl(item.video_path) : "";
              const posterSrc = item.poster_path ? toMediaUrl(item.poster_path) : "";
              const hasExternal = isExternal(item.external_url);

              return (
                <article key={item.id} className="page-common-panel press-card">
                  <div className="press-player">
                    {videoSrc ? (
                      <video controls preload="metadata" poster={posterSrc || undefined}>
                        <source src={videoSrc} />
                      </video>
                    ) : hasExternal ? (
                      <a href={item.external_url} target="_blank" rel="noreferrer" className="press-external-link">
                        Открыть видео
                      </a>
                    ) : (
                      <div className="press-video-placeholder">Видео недоступно</div>
                    )}
                  </div>
                  <div className="press-copy">
                    <h2>{item.title}</h2>
                    {item.source_name ? <p className="press-source">{item.source_name}</p> : null}
                    {item.description ? <p>{item.description}</p> : null}
                    {hasExternal ? (
                      <a href={item.external_url} target="_blank" rel="noreferrer" className="press-link-inline">
                        Смотреть на внешнем ресурсе
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
