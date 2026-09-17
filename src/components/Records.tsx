"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  api,
  numberText,
  type Profile,
  type Entry,
  type Point,
} from "@/lib/ui";
import { RangeFilter } from "./RangeFilter";
import { EntryTable } from "./EntryTable";
import { TrendChart } from "./TrendChart";
import { PageHeading, ErrorMessage, Modal } from "./Ui";
import { GlucoseEntryForm } from "./GlucoseEntryForm";
import { APP_CONFIG } from "@/lib/config";

type Summary = {
  count: number;
  minimumMgDl: number | null;
  maximumMgDl: number | null;
  averageMgDl: number | null;
  points: Point[];
};

export function Records({
  profile,
  history = false,
}: {
  profile: Profile;
  history?: boolean;
}) {
  const [query, setQuery] = useState("period=7"),
    [revision, setRevision] = useState(0),
    [result, setResult] = useState<{
      entries: Entry[];
      query: string;
      revision: number;
      summary?: Summary;
      cursor?: string | null;
    } | null>(null),
    [error, setError] = useState<unknown>(null),
    [loading, setLoading] = useState(false),
    [modal, setModal] = useState(false),
    [busy, setBusy] = useState(false);

  // Listen for FAB click event from bottom navigation bar
  useEffect(() => {
    const onOpenModal = () => setModal(true);
    window.addEventListener("open-glucose-modal", onOpenModal);
    return () => window.removeEventListener("open-glucose-modal", onOpenModal);
  }, []);

  useEffect(() => {
    if (!query) return;
    let ignore = false;
    const reads = [
      api<Entry[]>(
        "/api/glucose-entries?" + query + "&limit=" + (history ? "20" : "5"),
      ),
    ];
    Promise.all([
      reads[0],
      history
        ? Promise.resolve(null)
        : api<Summary>("/api/glucose-summary?" + query),
    ])
      .then(([entries, summary]) => {
        if (!ignore)
          setResult({
            query,
            revision,
            entries: entries.data,
            cursor: entries.meta?.nextCursor,
            summary: summary?.data,
          });
      })
      .catch((e) => {
        if (!ignore) setError(e);
      });
    return () => {
      ignore = true;
    };
  }, [query, revision, history]);

  function refresh() {
    setError(null);
    setRevision(revision + 1);
  }

  async function more() {
    if (!result?.cursor || loading) return;
    setLoading(true);
    try {
      const r = await api<Entry[]>(
        "/api/glucose-entries?" + query + "&cursor=" + result?.cursor,
      );
      setResult((old) =>
        old && old.query === query && old.revision === revision
          ? {
              ...old,
              entries: [...old.entries, ...r.data],
              cursor: r.meta?.nextCursor,
            }
          : old,
      );
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const userInitial = (profile.name?.trim().charAt(0) || "U").toUpperCase();
  const todayFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="stack app-dashboard">
      {!history && (
        <div className="mobile-app-header">
          <div className="mobile-app-greeting">
            <div className="mobile-user-avatar" aria-hidden="true">
              {userInitial}
            </div>
            <div className="mobile-user-text">
              <span className="mobile-greeting-sub">{todayFormatted}</span>
              <h2 className="mobile-greeting-name">
                Halo, {profile.name || "Pengguna"}
              </h2>
            </div>
          </div>
          <button
            className="button primary mobile-quick-add"
            onClick={() => setModal(true)}
          >
            + Catat
          </button>
        </div>
      )}

      <PageHeading
        eyebrow={history ? "Riwayat pribadi" : "Catatan Anda, lebih terarah"}
        title={history ? "Riwayat pengukuran" : "Ringkasan Anda"}
        description={
          history
            ? "Telusuri catatan dan koreksi pengukuran yang keliru."
            : "Selamat datang, " +
              (profile.name ?? "") +
              ". Lihat perjalanan pencatatan Anda."
        }
      >
        <button className="button primary" onClick={() => setModal(true)}>
          + Catat gula darah
        </button>
      </PageHeading>

      <div className="notice mobile-disclaimer-card" role="note">
        <span className="disclaimer-icon" aria-hidden="true">ℹ️</span>
        <p>{APP_CONFIG.disclaimer}</p>
      </div>

      <div className="mobile-filter-wrapper">
        <RangeFilter
          zone={profile.timezone_code ?? "WIB"}
          onChange={(q) => {
            setResult(null);
            setError(null);
            setQuery(q);
            setRevision((r) => r + 1);
          }}
        />
      </div>

      <ErrorMessage error={error} />
      {Boolean(error) && (
        <button className="button" onClick={refresh}>
          Coba lagi
        </button>
      )}
      {!result && !error && (
        <p role="status" className="loading">
          {query ? "Memuat catatan…" : "Pilih tanggal dan tekan Terapkan."}
        </p>
      )}

      {result && (
        <>
          {result.summary && (
            <>
              {/* Responsive Hero Metrics Card */}
              <div className="hero-metric-card">
                <div className="hero-metric-top">
                  <span className="hero-metric-tag">Rata-rata Periode</span>
                  <span className="hero-metric-zone">
                    {profile.timezone_code}
                  </span>
                </div>
                <div className="hero-metric-focal">
                  <span className="hero-metric-num">
                    {numberText(result.summary.averageMgDl)}
                  </span>
                  <span className="hero-metric-unit">mg/dL</span>
                </div>
                <div className="hero-metric-subgrid">
                  <div className="hero-subitem">
                    <span className="hero-sub-label">Terendah</span>
                    <strong className="hero-sub-val">
                      {numberText(result.summary.minimumMgDl)} mg/dL
                    </strong>
                  </div>
                  <div className="hero-subitem">
                    <span className="hero-sub-label">Tertinggi</span>
                    <strong className="hero-sub-val">
                      {numberText(result.summary.maximumMgDl)} mg/dL
                    </strong>
                  </div>
                  <div className="hero-subitem">
                    <span className="hero-sub-label">Total Pengukuran</span>
                    <strong className="hero-sub-val">
                      {result.summary.count} catatan
                    </strong>
                  </div>
                </div>
              </div>

              {/* Keep semantic DL metrics for screen readers and accessibility */}
              <dl className="metrics desktop-metrics-grid">
                {[
                  ["Rata-rata", result.summary.averageMgDl, "mg/dL"],
                  ["Terendah", result.summary.minimumMgDl, "mg/dL"],
                  ["Tertinggi", result.summary.maximumMgDl, "mg/dL"],
                  ["Total pengukuran", result.summary.count, "catatan"],
                ].map(([label, value, unit]) => (
                  <div className="panel metric" key={String(label)}>
                    <dt>{label}</dt>
                    <dd>
                      {numberText(value as number | null)}
                      <span>{unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Trend Chart Card */}
              <section className="panel mobile-card-section">
                <div className="section-heading">
                  <div>
                    <h2>Tren gula darah</h2>
                    <p className="small muted">
                      Hanya catatan aktif · {profile.timezone_code}
                    </p>
                  </div>
                  <Link className="text-button small" href="/reports">
                    Unduh laporan
                  </Link>
                </div>
                <TrendChart
                  key={query + revision}
                  points={result.summary.points}
                  zone={profile.timezone_code!}
                />
              </section>
            </>
          )}

          {/* Activity / Recent Entries Section */}
          <section className="panel mobile-card-section">
            <div className="section-heading">
              <h2>
                {history ? "Semua catatan dalam periode" : "Catatan terbaru"}
              </h2>
              {!history && (
                <Link href="/history" className="small">
                  Lihat riwayat →
                </Link>
              )}
            </div>
            <EntryTable
              entries={result.entries}
              zone={profile.timezone_code!}
              onChanged={refresh}
            />
            {history && result.cursor && (
              <button
                style={{ marginTop: 20 }}
                className="button"
                onClick={more}
                disabled={loading}
              >
                {loading ? "Memuat…" : "Muat catatan berikutnya"}
              </button>
            )}
          </section>
        </>
      )}

      {modal && (
        <Modal
          title="Catat gula darah"
          busy={busy}
          onClose={() => setModal(false)}
        >
          <GlucoseEntryForm
            zone={profile.timezone_code!}
            onBusy={setBusy}
            onSaved={() => {
              setModal(false);
              refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
