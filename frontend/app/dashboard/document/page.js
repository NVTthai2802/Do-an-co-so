"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "../../../lib/auth";
import {API_URL} from "../../../lib/api";

export default function DocumentScanner() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");

  const goBack = () => router.back();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setExtractedText(""); // Xóa text cũ
    }
  };

  const handleExtractText = async () => {
    if (!file) return;
    setLoading(true);
    
    try {
      // Dùng FormData để gửi file thay vì JSON
      const formData = new FormData();
      formData.append("file", file);

      const token = getToken();
      
      const response = await fetch(`${API_URL}/document/extract-text`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
          // Lưu ý: KHÔNG set Content-Type là application/json khi gửi FormData
        },
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        setExtractedText(data.text);
      } else {
        alert("Lỗi: " + data.detail);
      }
    } catch (error) {
      alert("Không thể kết nối đến máy chủ AI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-header">
          <div>
            <span className="badge">Dành cho Phụ huynh</span>
            <h1>Quét tài liệu học tập (OCR)</h1>
            <p>Tải ảnh sách giáo khoa hoặc bài tập để AI chuyển thành văn bản.</p>
          </div>
          <button className="btn secondary" onClick={goBack}>← Quay lại</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
          
          {/* CỘT 1: UPLOAD ẢNH */}
          <div style={{ border: "2px dashed #ccc", padding: "24px", borderRadius: "12px", textAlign: "center" }}>
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/jpg" 
              onChange={handleFileChange} 
              id="file-upload"
              style={{ display: "none" }}
            />
            <label htmlFor="file-upload" className="btn secondary" style={{ cursor: "pointer", display: "inline-block", marginBottom: "16px" }}>
              📁 Chọn ảnh tài liệu
            </label>
            
            {preview && (
              <div style={{ marginTop: "16px" }}>
                <img src={preview} alt="Bản xem trước" style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "8px" }} />
              </div>
            )}

            {file && (
              <button 
                className="btn primary" 
                style={{ width: "100%", marginTop: "16px" }} 
                onClick={handleExtractText}
                disabled={loading}
              >
                {loading ? "⏳ AI đang đọc chữ..." : "✨ Trích xuất văn bản"}
              </button>
            )}
          </div>

          {/* CỘT 2: KẾT QUẢ VĂN BẢN */}
          <div style={{ backgroundColor: "#f8f9fa", padding: "24px", borderRadius: "12px" }}>
            <h3>Văn bản trích xuất</h3>
            {loading ? (
              <p style={{ color: "#868e96", fontStyle: "italic" }}>Hệ thống đang phân tích bố cục và nhận diện ký tự...</p>
            ) : extractedText ? (
              <textarea 
                value={extractedText} 
                onChange={(e) => setExtractedText(e.target.value)}
                style={{ width: "100%", height: "300px", padding: "12px", borderRadius: "8px", border: "1px solid #dee2e6", fontSize: "16px", resize: "vertical" }}
              />
            ) : (
              <p style={{ color: "#868e96" }}>Chưa có dữ liệu. Vui lòng tải ảnh lên để AI đọc.</p>
            )}
          </div>

        </div>
      </section>
    </main>
  );
}