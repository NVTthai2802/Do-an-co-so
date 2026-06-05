"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../../lib/api";
import { speakVietnamese } from "../../../lib/speech";
import styles from "./Document.module.css";

const FILE_TYPES = {
  ".pdf": { icon: "📄", label: "PDF" },
  ".docx": { icon: "📝", label: "Word" },
  ".doc": { icon: "📝", label: "Word" },
  ".pptx": { icon: "📊", label: "PowerPoint" },
  ".ppt": { icon: "📊", label: "PowerPoint" },
  ".jpg": { icon: "🖼️", label: "Ảnh JPG" },
  ".jpeg": { icon: "🖼️", label: "Ảnh JPEG" },
  ".png": { icon: "🖼️", label: "Ảnh PNG" },
};

function getFileExt(filename) {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.substring(idx).toLowerCase() : "";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function DocumentScanner() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const fileInputRef = useRef(null);

  const fileInfo = file
    ? {
        ext: getFileExt(file.name),
        ...FILE_TYPES[getFileExt(file.name)],
        name: file.name,
        size: formatFileSize(file.size),
      }
    : null;

  const isImage = fileInfo && [".jpg", ".jpeg", ".png"].includes(fileInfo.ext);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) selectFile(selectedFile);
  };

  const selectFile = (selectedFile) => {
    setFile(selectedFile);
    setExtractedText("");
    setMetadata(null);
    const ext = getFileExt(selectedFile.name);
    if ([".jpg", ".jpeg", ".png"].includes(ext)) {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) selectFile(droppedFile);
  };

  const handleExtractText = async () => {
    if (!file) return;
    setLoading(true);
    setLoadingMsg("Đang tải file lên máy chủ...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setLoadingMsg("AI đang phân tích tài liệu...");

      const response = await fetch(`${API_URL}/document/extract-text`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setExtractedText(data.text || "");
        setMetadata({
          fileType: data.file_type,
          pages: data.pages,
        });
      } else {
        alert("Lỗi: " + (data.detail || "Không thể trích xuất."));
      }
    } catch (error) {
      alert("Không thể kết nối đến máy chủ.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(extractedText);
      utterance.lang = "vi-VN";
      utterance.rate = 0.85;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([extractedText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted_text.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dành cho Phụ huynh</span>
            <h1>📖 Đọc Tài Liệu Học Tập</h1>
            <p>
              Tải ảnh, PDF, Word, PowerPoint để AI trích xuất văn bản
            </p>
          </div>
          <button
            className="btn secondary"
            onClick={() => router.push("/dashboard")}
          >
            ← Quay lại
          </button>
        </div>

        <div className={styles.layout}>
          {/* LEFT: Upload */}
          <div className={styles.uploadCol}>
            {/* Upload Zone */}
            <div
              className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneActive : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/jpg, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {!file ? (
                <div className={styles.uploadPlaceholder}>
                  <span className={styles.uploadIcon}>📁</span>
                  <span className={styles.uploadText}>
                    Kéo thả file vào đây
                  </span>
                  <span className={styles.uploadHint}>
                    hoặc nhấn để chọn file
                  </span>
                  <span className={styles.uploadFormats}>
                    PDF · Word · PowerPoint · JPG · PNG
                  </span>
                </div>
              ) : (
                <div
                  className={styles.fileInfo}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isImage && preview ? (
                    <img
                      src={preview}
                      alt="Xem trước"
                      className={styles.previewImage}
                    />
                  ) : (
                    <span className={styles.fileIcon}>
                      {fileInfo?.icon || "📄"}
                    </span>
                  )}
                  <div className={styles.fileDetails}>
                    <span className={styles.fileName}>{fileInfo?.name}</span>
                    <span className={styles.fileMeta}>
                      {fileInfo?.label} · {fileInfo?.size}
                    </span>
                  </div>
                  <button
                    className={styles.changeFileBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Đổi file
                  </button>
                </div>
              )}
            </div>

            {/* Extract Button */}
            {file && (
              <button
                className="btn primary"
                style={{ width: "100%", marginTop: "16px" }}
                onClick={handleExtractText}
                disabled={loading}
              >
                {loading
                  ? `⏳ ${loadingMsg || "Đang xử lý..."}`
                  : "✨ Trích xuất văn bản"}
              </button>
            )}
          </div>

          {/* RIGHT: Result */}
          <div className={styles.resultCol}>
            <div className={styles.resultHeader}>
              <h3 className={styles.resultTitle}>📝 Văn bản trích xuất</h3>
              {metadata && (
                <div className={styles.metadataRow}>
                  <span className={styles.metaBadge}>
                    {FILE_TYPES["." + metadata.fileType]?.icon || "📄"}{" "}
                    {metadata.fileType?.toUpperCase()}
                  </span>
                  {metadata.pages > 1 && (
                    <span className={styles.metaBadge}>
                      📃 {metadata.pages} trang
                    </span>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p>{loadingMsg || "Đang xử lý..."}</p>
              </div>
            ) : extractedText ? (
              <>
                <textarea
                  className={styles.extractedText}
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                />
                <div className={styles.actionButtons}>
                  <button
                    className={`${styles.actionBtn} ${styles.speakBtn}`}
                    onClick={handleSpeak}
                  >
                    {isSpeaking ? "⏹️ Dừng đọc" : "🔊 Đọc văn bản"}
                  </button>
                  <button className={styles.actionBtn} onClick={handleCopy}>
                    {copied ? "✅ Đã sao chép!" : "📋 Sao chép"}
                  </button>
                  <button className={styles.actionBtn} onClick={handleDownload}>
                    💾 Tải xuống
                  </button>
                  <a
                    href="/dashboard/tts"
                    className={`${styles.actionBtn} ${styles.ttsLink}`}
                  >
                    🔊 Mở AI Đọc Cho Bé →
                  </a>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📃</span>
                <p>Chưa có dữ liệu. Vui lòng tải file lên để AI đọc.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}