import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import {
  FiBell, FiBookOpen, FiCheckCircle, FiClock, FiFileText, FiGrid,
  FiMenu, FiMessageCircle, FiPaperclip, FiPlus, FiSearch, FiSend,
  FiTrash2, FiUser, FiUploadCloud, FiX, FiZap, FiDownload,
} from "react-icons/fi";
import api from "./api";

interface UploadedFile { id: string; filename: string; filepath: string; filetype: string; text_length?: number; }
interface Message { id: string; role: "user" | "assistant"; text: string; }
interface HistoryItem { id: string; question: string; answer: string; filename: string; file_id: string; created_at?: string; }

type Page = "dashboard" | "chat" | "history" | "files" | "profile";

const initials = (name = "User") => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
const readableDate = (value?: string) => value ? new Date(value).toLocaleString() : "This session";

const Dashboard = () => {
  const user = useMemo(() => ({ full_name: "Guest User", email: "No account required" }), []);
  const [page, setPage] = useState<Page>("dashboard");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    try { const response = await api.get("/api/files/"); setFiles(response.data); }
    catch (err: any) { setError(err.response?.data?.detail || "Could not load documents."); }
  };
  useEffect(() => { loadFiles(); }, []);

  const chooseFile = (file: UploadedFile) => {
    setSelectedFile(file);
    setMessages([]);
    setQuestion("");
    setError("");
    setPage("chat");
    setMobileOpen(false);
  };

  const upload = async (file: File) => {
    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["pdf", "txt"].includes(extension)) return setError("Please select a PDF or TXT file.");
    setUploading(true); setError("");
    const formData = new FormData(); formData.append("file", file);
    try {
      const response = await api.post("/api/files/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await loadFiles();
      const newFile = { ...response.data.file } as UploadedFile;
      setSelectedFile(newFile);
      setMessages([]);
      setPage("chat");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed.");
    } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) upload(file); };
  const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) upload(file); };

  const ask = async () => {
    if (!selectedFile || !question.trim() || asking) return;

    const text = question.trim();
    setQuestion("");
    setError("");

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    setMessages((current) => [...current, userMessage]);
    setAsking(true);

    try {
      const response = await api.post("/api/chat/", {
        file_id: selectedFile.id,
        question: text,
      });

      const answer = String(response.data.answer || "No answer returned.");

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: answer,
        },
      ]);

      setHistory((current) => [
        {
          id: crypto.randomUUID(),
          question: text,
          answer,
          filename: selectedFile.filename,
          file_id: selectedFile.id,
          created_at: new Date().toISOString(),
        },
        ...current,
      ]);
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        "I could not process that question.";

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: message,
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const downloadConversation = async () => {
    if (!selectedFile || !messages.length || downloading) return;

    setDownloading(true);
    setError("");

    try {
      const response = await api.post(
        "/api/chat/download",
        {
          filename: selectedFile.filename,
          messages,
        },
        { responseType: "blob" },
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${selectedFile.filename.replace(/\.(pdf|txt)$/i, "")}-AskMyPDF-Chat.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Could not download the chat PDF.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const onQuestionKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(); }
  };

  const deleteFile = async (id: string) => {
    if (!window.confirm("Delete this document? Current-session chat history will also disappear.")) return;
    try { await api.delete(`/api/files/${encodeURIComponent(id)}`); if (selectedFile?.id === id) { setSelectedFile(null); setMessages([]); } setHistory((current) => current.filter((item) => item.file_id !== id)); await loadFiles(); }
    catch (err: any) { setError(err.response?.data?.detail || "Could not delete document."); }
  };

  const filteredFiles = files.filter((file) => file.filename.toLowerCase().includes(search.toLowerCase()));
  const filteredHistory = history.filter((item) => `${item.question} ${item.filename}`.toLowerCase().includes(search.toLowerCase()));

  const nav = [
    ["dashboard", "Dashboard", FiGrid], ["chat", "Chat", FiMessageCircle], ["files", "My PDFs", FiFileText], ["history", "Session History", FiClock], ["profile", "Profile", FiUser],
  ] as const;

  const pageTitle: Record<Page, string> = { dashboard: "Welcome to AskMyPDF AI!", chat: "PDF Chat", files: "My PDFs", history: "Session History", profile: "Your Profile" };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="logo-area"><div className="logo-icon"><FiBookOpen /></div><div><div className="logo-title">AskMyPDF AI</div><div className="logo-caption">Read. Ask. Understand.</div></div></div>
        <nav className="nav">{nav.map(([id, label, Icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => { setPage(id); setMobileOpen(false); }}><Icon /> {label}</button>)}</nav>
        <div className="sidebar-bottom"><FiZap /><div>Smart answers from<br />your own documents.</div><span style={{ fontSize: 12, opacity: 0.85 }}>No login required</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <FiX /> : <FiMenu />}</button>
          <div className="search"><FiSearch /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents or session history..." /></div>
          <div className="profile-mini"><FiBell color="#8c6878" /><div className="avatar">{initials(user.full_name)}</div><div><strong>{user.full_name || "User"}</strong><span>Guest Mode</span></div></div>
        </header>

        <section className="content">
          {error && <div className="error-box">{error} <button className="icon-btn" onClick={() => setError("")}><FiX /></button></div>}
          <h1 className="page-title">{pageTitle[page]}</h1>
          <p className="page-subtitle">{page === "dashboard" ? "Upload a PDF and start a conversation with your document." : "Manage your PDFs and current chat session from one place."}</p>

          {page === "dashboard" && <>
            <div className="stats-grid">
              <div className="card stat">
                <div className="stat-icon pdf-stat-icon"><FiFileText /></div>
                <div className="stat-content">
                  <small>Total PDFs</small>
                  <strong>{files.length}</strong>
                  <span>Documents uploaded</span>
                </div>
              </div>
              <div className="card stat">
                <div className="stat-icon question-stat-icon"><FiMessageCircle /></div>
                <div className="stat-content">
                  <small>Questions Asked</small>
                  <strong>{history.length}</strong>
                  <span>Current-session questions</span>
                </div>
              </div>
              <div className="card stat">
                <div className="stat-icon selected-stat-icon"><FiCheckCircle /></div>
                <div className="stat-content">
                  <small>Selected PDF</small>
                  <strong>{selectedFile ? "1" : "0"}</strong>
                  <span>{selectedFile?.filename || "Choose a document"}</span>
                </div>
              </div>
            </div>
            <div className="dashboard-grid">
              <div className="card upload-card">
                <h2>Upload a document</h2>
                <p className="page-subtitle">Supported: PDF and TXT · Maximum 15 MB</p>
                <div className={`upload-drop ${dragging ? "dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                  <div className="upload-icon"><FiUploadCloud /></div><h3>{uploading ? "Uploading document..." : "Drop your PDF here"}</h3><p>or choose a file from your computer</p>
                  <input ref={fileInput} className="file-input" type="file" accept=".pdf,.txt" onChange={onFileInput} />
                  <button className="outline-btn" onClick={() => fileInput.current?.click()} disabled={uploading}><FiPlus /> Choose file</button>
                </div>
                <h3 style={{ marginTop: 24 }}>Recent PDFs</h3>
                <div className="document-list">{filteredFiles.slice(0, 5).map((file) => <DocumentRow key={file.id} file={file} selected={selectedFile?.id === file.id} onSelect={() => chooseFile(file)} onDelete={() => deleteFile(file.id)} />)}{!files.length && <div className="empty">No documents yet. Upload your first PDF.</div>}</div>
              </div>
              <div className="card quick-card"><h3>How to use AskMyPDF</h3><div className="tip"><FiUploadCloud /><span><b>1. Upload</b><br />Choose a PDF from your computer.</span></div><div className="tip"><FiFileText /><span><b>2. Select</b><br />Open any uploaded document.</span></div><div className="tip"><FiMessageCircle /><span><b>3. Ask</b><br />Ask questions in natural language.</span></div><div className="tip"><FiCheckCircle /><span><b>4. Review</b><br />Your questions and answers stay in this browser session.</span></div></div>
            </div>
          </>}

          {page === "chat" && <ChatView selectedFile={selectedFile} files={filteredFiles} messages={messages} question={question} asking={asking} downloading={downloading} setQuestion={setQuestion} ask={ask} downloadConversation={downloadConversation} onKey={onQuestionKey} chooseFile={chooseFile} />}

          {page === "files" && <div className="card section-card"><div className="section-head"><h2>All uploaded PDFs</h2><button className="outline-btn" onClick={() => fileInput.current?.click()}><FiPlus /> Upload</button></div><input ref={fileInput} className="file-input" type="file" accept=".pdf,.txt" onChange={onFileInput} /><div className="document-list">{filteredFiles.map((file) => <DocumentRow key={file.id} file={file} selected={selectedFile?.id === file.id} onSelect={() => chooseFile(file)} onDelete={() => deleteFile(file.id)} />)}{!files.length && <div className="empty">No PDFs uploaded yet.</div>}</div></div>}

          {page === "history" && <div className="card section-card"><div className="section-head"><h2>Current-session questions</h2><span style={{ color: "var(--muted)" }}>{history.length} questions</span></div><div className="history-list">{filteredHistory.map((item) => <div className="history-item" key={item.id}><strong>{item.question}</strong><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}><FiFileText /> {item.filename} · {readableDate(item.created_at)}</div><p>{item.answer}</p></div>)}{!history.length && <div className="empty">No questions in this session yet.</div>}</div></div>}

          {page === "profile" && <div className="card profile-card"><div className="profile-head"><div className="profile-big">{initials(user.full_name)}</div><div><h2>{user.full_name || "User"}</h2><p>{user.email || "No email available"}</p></div></div><div className="profile-details"><div className="detail-box"><small>Full name</small><strong>{user.full_name || "—"}</strong></div><div className="detail-box"><small>Email</small><strong>{user.email || "—"}</strong></div><div className="detail-box"><small>Account type</small><strong>Student</strong></div><div className="detail-box"><small>Documents</small><strong>{files.length} PDFs uploaded</strong></div></div></div>}
        </section>
      </main>
    </div>
  );
};

function DocumentRow({ file, selected, onSelect, onDelete }: { file: UploadedFile; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  return <div className={`document-row ${selected ? "selected" : ""}`} onClick={onSelect}><div className="doc-icon"><FiFileText /></div><div className="doc-info"><strong>{file.filename}</strong><span>{file.filetype?.includes("pdf") ? "PDF" : "TXT"} · Ready to chat</span></div><button className="icon-btn" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}><FiTrash2 /></button></div>;
}

function ChatView({ selectedFile, files, messages, question, asking, downloading, setQuestion, ask, downloadConversation, onKey, chooseFile }: { selectedFile: UploadedFile | null; files: UploadedFile[]; messages: Message[]; question: string; asking: boolean; downloading: boolean; setQuestion: (v: string) => void; ask: () => void; downloadConversation: () => void; onKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void; chooseFile: (f: UploadedFile) => void; }) {
    return <div className="dashboard-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}>
    <div className="card chat-card"><div className="chat-header"><div><h3>{selectedFile?.filename || "No PDF selected"}</h3><p>{selectedFile ? "Ask questions about this document" : "Select a PDF from the right"}</p></div><div className="chat-header-actions">{selectedFile && messages.length > 0 && <button className="download-btn" onClick={downloadConversation} disabled={downloading} title="Download your questions and AI answers as a new PDF"><FiDownload /> {downloading ? "Creating PDF..." : "Download PDF"}</button>}<FiMessageCircle className="chat-header-icon" color="var(--primary)" /></div></div>
      <div className="chat-messages">{!selectedFile ? <div className="chat-empty"><div><FiFileText size={42} /><strong>Select a PDF to start chatting</strong><span>Choose a document from the list on the right.</span></div></div> : !messages.length ? <div className="chat-empty"><div><FiMessageCircle size={42} /><strong>Ask anything about this PDF</strong><span>Try: “Summarize this document” or “What are the main points?”</span></div></div> : messages.map((message) => <div key={message.id} className={`message ${message.role}`}><div className="message-label">{message.role === "user" ? "You" : "AskMyPDF AI"}</div><div className="message-bubble">{message.text}</div></div>)}</div>
      <div className="chat-input"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={onKey} disabled={!selectedFile || asking} placeholder={selectedFile ? "Ask something about this PDF..." : "Select a PDF first"} /><button className="send-btn" onClick={ask} disabled={!selectedFile || !question.trim() || asking}>{asking ? <FiClock /> : <FiSend />}</button></div>
    </div>
    <div className="card section-card"><div className="section-head"><h2 style={{ fontSize: 17 }}>Your PDFs</h2><FiPaperclip /></div><div className="document-list">{files.map((file) => <div className={`document-row ${selectedFile?.id === file.id ? "selected" : ""}`} key={file.id} onClick={() => chooseFile(file)}><div className="doc-icon"><FiFileText /></div><div className="doc-info"><strong>{file.filename}</strong><span>Click to chat</span></div></div>)}{!files.length && <div className="empty">Upload a PDF first.</div>}</div></div>
  </div>;
}

export default Dashboard;
