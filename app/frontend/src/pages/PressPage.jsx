import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPressVideos, toMediaUrl } from "../api";

function isExternal(value = "") {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isDirectVideo(value = "") {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(String(value || "").trim());
}

function getPlayableVideo(item) {
  const videoSrc = item.video_path ? toMediaUrl(item.video_path) : "";
  const hasExternal = isExternal(item.external_url);
  const externalVideoSrc = hasExternal && isDirectVideo(item.external_url) ? item.external_url : "";

  return {
    src: videoSrc || externalVideoSrc,
    poster: item.poster_path ? toMediaUrl(item.poster_path) : "",
    hasExternal
  };
}

function PressVideoBlock({ item, featured = false }) {
  const video = getPlayableVideo(item);

  return (
    <div className={featured ? "press-video-frame press-video-frame-featured" : "press-video-frame"}>
      {video.src ? (
        <video controls preload="metadata" poster={video.poster || undefined}>
          <source src={video.src} />
        </video>
      ) : video.hasExternal ? (
        <a href={item.external_url} target="_blank" rel="noreferrer" className="press-external-link">
          Открыть видео
        </a>
      ) : (
        <div className="press-video-placeholder">Материал скоро появится</div>
      )}
    </div>
  );
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

  const featuredItem = items[0] || null;
  const latestItems = items.slice(0, 3);

  return (
    <div className="page-common page-press">
      <div className="container">
        <header className="press-hero">
          <div className="press-hero-copy">
            <Link className="press-back-link" to="/">
              На главную
            </Link>
            <p className="press-kicker">Студия Атман в кадре</p>
            <h1>О нас в СМИ</h1>
            <span>
              Репортажи, интервью, сюжеты с городских мероприятий и видео о практиках, которые проходят в
              студии.
            </span>
            <div className="press-hero-stats" aria-label="Разделы страницы">
              <div>
                <strong>{items.length || 0}</strong>
                <span>материалов</span>
              </div>
              <div>
                <strong>ТВ</strong>
                <span>репортажи</span>
              </div>
              <div>
                <strong>18+</strong>
                <span>бережные практики</span>
              </div>
            </div>
          </div>

          <div className="press-hero-media">
            {featuredItem ? (
              <>
                <PressVideoBlock item={featuredItem} featured />
                <div className="press-feature-caption">
                  <p>{featuredItem.source_name || "Студия Атман"}</p>
                  <h2>{featuredItem.title}</h2>
                </div>
              </>
            ) : (
              <div className="press-feature-empty">
                <p>Видео готовятся к публикации</p>
              </div>
            )}
          </div>
        </header>

        <section className="press-intro">
          <article>
            <span>01</span>
            <h2>Репортажи и сюжеты</h2>
            <p>Материалы телеканалов, городских медиа и онлайн-площадок о студии и её направлениях.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Видео с мероприятий</h2>
            <p>Фрагменты открытых практик, атмосферные записи, встречи и события с участием студии.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Интервью и экспертность</h2>
            <p>Разговоры о звукотерапии, телесных практиках, психологической поддержке и восстановлении.</p>
          </article>
        </section>

        {items.length === 0 ? (
          <div className="press-empty">
            <h2>Видео пока не добавлены</h2>
            <p>Сюда можно добавить ТВ-сюжеты, интервью, записи мероприятий и ссылки на внешние видео.</p>
          </div>
        ) : (
          <section className="press-library" aria-label="Видеоматериалы о студии">
            <div className="press-section-head">
              <p>Видеоархив</p>
              <h2>Материалы о студии</h2>
            </div>
            {latestItems.length ? (
              <div className="press-latest-strip">
                {latestItems.map((item) => (
                  <a key={`latest-${item.id}`} href={`#press-video-${item.id}`}>
                    <span>{item.source_name || "Видео"}</span>
                    <strong>{item.title}</strong>
                  </a>
                ))}
              </div>
            ) : null}
            <div className="press-grid">
              {items.map((item) => {
                const hasExternal = isExternal(item.external_url);

                return (
                  <article key={item.id} id={`press-video-${item.id}`} className="press-card">
                    <PressVideoBlock item={item} />
                    <div className="press-copy">
                      <div className="press-card-meta">
                        <span>{item.source_name || "Студия Атман"}</span>
                        <span>Видео</span>
                      </div>
                      <h2>{item.title}</h2>
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
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
