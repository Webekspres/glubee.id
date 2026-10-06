"use client";
import { Icon } from "./Icons";
import { TransitionLink as Link } from "./TransitionLink";
import { useEffect, useState } from "react";
import {
  api,
  mgDlText,
  type Profile,
  type Entry,
  type Point,
} from "@/lib/ui";
import { RangeFilter } from "./RangeFilter";
import { EntryTable } from "./EntryTable";
import { TrendChart } from "./TrendChart";
import { PageHeading, ErrorMessage, Loading, Modal } from "./Ui";
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
    <div className={"stack app-dashboard" + (history ? " is-history" : "")}>
      {!history && (
        <div className="mobile-app-header">
          <div className="mobile-app-greeting">
            <div className="mobile-user-avatar" aria-hidden="true">
              {userInitial}
            </div>
            <div className="mobile-user-text">
              <span className="mobile-greeting-sub">{todayFormatted}</span>
              <h1 className="mobile-greeting-name">
                Halo, {profile.name || "Pengguna"}
              </h1>
            </div>
          </div>
        </div>
      )}

      <PageHeading
        title={history ? "Riwayat pengukuran" : "Ringkasan Anda"}
        description={
          history
            ? "Telusuri catatan dan koreksi pengukuran yang keliru."
            : "Selamat datang, " +
              (profile.name ?? "") +
              ". Lihat perjalanan pencatatan Anda."
        }
      >
        <div className="page-heading-aside">
          {/* Tanpa maskot: data adalah fokus di sini. Maskot muncul di empty state grafik. */}
          {history && (
            <Link className="button" href="/reports">
              Unduh laporan
            </Link>
          )}
          <button className="button primary" onClick={() => setModal(true)}>
            + Catat gula darah
          </button>
        </div>
      </PageHeading>

      <div className="notice mobile-disclaimer-card" role="note">
        <Icon name="info" className="disclaimer-icon" />
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
      {!result && !error &&
        (query ? (
          <Loading label="Memuat catatan…" />
        ) : (
          <p className="muted">Pilih tanggal dan tekan Terapkan.</p>
        ))}

      {result && (
        <div className="stack reveal">
          {result.summary && (
            <>
              {/* Responsive Hero Metrics Card */}
              <div className="hero-metric-card">
                <div className="hero-metric-top">
                  <span className="hero-metric-tag">Rata-rata periode</span>
                  <span className="hero-metric-zone">
                    {profile.timezone_code}
                  </span>
                </div>
                <div className="hero-metric-focal">
                  <span className="hero-metric-num">
                    {mgDlText(result.summary.averageMgDl)}
                  </span>
                  <span className="hero-metric-unit">mg/dL</span>
                </div>
                <div className="hero-metric-subgrid">
                  <div className="hero-subitem">
                    <span className="hero-sub-label">Terendah</span>
                    <strong className="hero-sub-val">
                      {mgDlText(result.summary.minimumMgDl)} mg/dL
                    </strong>
                  </div>
                  <div className="hero-subitem">
                    <span className="hero-sub-label">Tertinggi</span>
                    <strong className="hero-sub-val">
                      {mgDlText(result.summary.maximumMgDl)} mg/dL
                    </strong>
                  </div>
                  <div className="hero-subitem">
                    <span className="hero-sub-label">Total pengukuran</span>
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
                      {label === "Total pengukuran" ? String(value) : mgDlText(value as number | null)}
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
                  Lihat semua riwayat
                </Link>
              )}
            </div>
            <EntryTable
              entries={result.entries}
              zone={profile.timezone_code!}
              onChanged={refresh}
              emptyMascot={history}
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
        </div>
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
