"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearSession, getToken, saveSession } from "../../../lib/auth";
import { request } from "../../../lib/api";
import {
  READING_PASSAGES,
  getTodayPassage,
  setTodayPassage,
} from "../../../lib/readingPassages";
import ParentNav from "../../../components/ParentNav";
import DocumentScanner from "./DocumentScanner";
import TextToSpeech from "./TextToSpeech";

const TABS = [
  { id: "reading", label: "Bài đọc hôm nay" },
  { id: "document", label: "Đọc tài liệu" },
  { id: "tts", label: "AI đọc cho bé" },
];

export default function ParentToolsPage() {
  return (
    <Suspense
      fallback={
        <main className="dashboard-shell">
          <section className="dashboard-card">Đang mở công cụ...</section>
        </main>
      }
    >
      <ParentToolsContent />
    </Suspense>
  );
}

function ParentToolsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() =>
    TABS.some((item) => item.id === requestedTab) ? requestedTab : "reading"
  );
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    request("/auth/me", { token })
      .then((data) => {
        setUser(data.user);
        saveSession(token, data.user);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router, token]);

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">Đang mở công cụ...</section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Khu vực quản lý</span>
            <h1>Công cụ cho bé</h1>
            <p>
              Chọn bài đọc cho bé, trích xuất văn bản từ tài liệu và nghe AI đọc thử.
            </p>
          </div>
          <div className="dashboard-actions">
            <ParentNav />
            <Link href="/dashboard" className="btn secondary">
              Về trang quản lý
            </Link>
          </div>
        </div>

        <div className="mode-tabs secondary-tabs" role="tablist" aria-label="Công cụ">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`mode-tab ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "reading" ? <ReadingPicker /> : null}
        {tab === "document" ? <DocumentScanner /> : null}
        {tab === "tts" ? <TextToSpeech /> : null}
      </section>
    </main>
  );
}

/**
 * Chọn "bài đọc hôm nay" cho mục "Bé luyện đọc" (Mục 5.2).
 * Hai cách: chọn từ kho mẫu, hoặc tự dán / soạn (kể cả dán kết quả từ
 * tab "Đọc tài liệu"). Lưu tạm bằng localStorage, khoá kl_reading_today.
 */
function ReadingPicker() {
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setCurrent(getTodayPassage());
  }, []);

  function assign(passage) {
    setTodayPassage(passage);
    setCurrent(passage);
    setSaved(`Đã giao cho bé: ${passage.title}`);
  }

  function assignCustom() {
    const text = draft.trim();
    if (!text) return;
    assign({ id: "custom", title: "Bài bố mẹ soạn", text });
    setDraft("");
  }

  return (
    <div className="section-list">
      <article className="section-card">
        <h2>Bài đọc hôm nay</h2>
        {current ? (
          <div className="reading-current">
            <span className="reading-current-title">{current.title}</span>
            <p>{current.text}</p>
          </div>
        ) : (
          <p className="field-hint">Đang tải...</p>
        )}
        {saved ? <div className="info">{saved}</div> : null}
        <p className="field-hint">
          Bé sẽ thấy sẵn đoạn này khi mở &ldquo;Luyện đọc&rdquo;, không phải gõ chữ.
        </p>
      </article>

      <article className="section-card">
        <h2>Chọn từ kho bài mẫu</h2>
        <div className="passage-grid">
          {READING_PASSAGES.map((passage) => {
            const active = current?.id === passage.id;
            return (
              <button
                key={passage.id}
                type="button"
                className={`passage-card ${active ? "active" : ""}`}
                onClick={() => assign(passage)}
                aria-pressed={active}
              >
                <strong>{passage.title}</strong>
                <span>{passage.text}</span>
              </button>
            );
          })}
        </div>
      </article>

      <article className="section-card">
        <h2>Tự soạn hoặc dán văn bản</h2>
        <p className="field-hint">
          Có thể dán kết quả từ tab &ldquo;Đọc tài liệu&rdquo;. Nên giữ 1–3 câu ngắn.
        </p>
        <div className="field">
          <label htmlFor="custom-passage">Đoạn văn cho bé</label>
          <textarea
            id="custom-passage"
            className="passage-input"
            rows={4}
            value={draft}
            placeholder="Ví dụ: Mèo con nằm ngủ bên cửa sổ."
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={assignCustom}
          disabled={!draft.trim()}
        >
          Giao cho bé
        </button>
      </article>
    </div>
  );
}
