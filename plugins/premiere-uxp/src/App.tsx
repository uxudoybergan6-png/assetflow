import React, { useState, useEffect, useCallback } from "react";
import {
  checkSubscription,
  listAssets,
  downloadAsset,
  type AssetItem,
} from "./api";
import "./styles.css";

const TOKEN_KEY = "creativetools_plugin_token";

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [tokenInput, setTokenInput] = useState(token);
  const [subActive, setSubActive] = useState(false);
  const [subStatus, setSubStatus] = useState("");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AssetItem | null>(null);

  const saveToken = useCallback(() => {
    localStorage.setItem(TOKEN_KEY, tokenInput);
    setToken(tokenInput);
  }, [tokenInput]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [sub, list] = await Promise.all([
        checkSubscription(token),
        listAssets(token, { search, category: category || undefined }),
      ]);
      setSubActive(sub.active);
      setSubStatus(sub.status ?? "NONE");
      setAssets(list.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [token, search, category]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  async function handleDownload(asset: AssetItem) {
    if (!subActive) {
      setError("Active subscription required");
      return;
    }
    try {
      const { downloadUrl } = await downloadAsset(token, asset.id);
      setError(`Download ready: open in browser or import manually`);
      // UXP: open external URL for download
      if (typeof window !== "undefined") {
        window.open(downloadUrl, "_blank");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  if (!token) {
    return (
      <div className="panel">
        <h1>CreativeTools</h1>
        <p className="hint">
          Get your plugin token from the web dashboard → Adobe Plugin Token
        </p>
        <input
          type="password"
          placeholder="Paste plugin token"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
        />
        <button onClick={saveToken}>Connect</button>
      </div>
    );
  }

  return (
    <div className="panel">
      <header className="header">
        <h1>CreativeTools</h1>
        <span className={subActive ? "badge ok" : "badge warn"}>
          {subStatus}
        </span>
      </header>

      <input
        type="search"
        placeholder="Search assets..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && refresh()}
      />
      <input
        placeholder="Category filter"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <button onClick={refresh} disabled={loading}>
        {loading ? "Loading..." : "Refresh"}
      </button>

      {error && <p className="error">{error}</p>}

      <div className="grid">
        {assets.map((a) => (
          <div
            key={a.id}
            className={`card ${selected?.id === a.id ? "selected" : ""}`}
            onClick={() => setSelected(a)}
          >
            <div className="thumb">
              {a.thumbnailUrl ? (
                <img src={a.thumbnailUrl} alt="" />
              ) : (
                <span>{a.type.slice(0, 3)}</span>
              )}
            </div>
            <p className="title">{a.title}</p>
            <p className="meta">{a.category}</p>
          </div>
        ))}
      </div>

      {selected && (
        <footer className="footer">
          <p>{selected.title}</p>
          <p className="meta">{selected.description}</p>
          <button
            onClick={() => handleDownload(selected)}
            disabled={!subActive}
          >
            Download to Project
          </button>
        </footer>
      )}
    </div>
  );
}
