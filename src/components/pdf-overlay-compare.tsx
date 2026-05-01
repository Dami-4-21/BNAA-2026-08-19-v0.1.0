"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileDiff, Layers3, RefreshCw } from "lucide-react";

import { StatusBadge, cx } from "@/components/ui";

type PdfComparisonVersion = {
  downloadUrl?: string;
  isCurrent?: boolean;
  publishedAt: string;
  status: string;
  version: string;
};

type PdfComparisonDocument = {
  code: string;
  downloadUrl?: string;
  revision: string;
  versions: PdfComparisonVersion[];
};

type CompareMode = "difference" | "overlay";

async function fetchPdfBytes(url: string) {
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Impossible de charger la revision PDF demandee.");
  }

  return new Uint8Array(await response.arrayBuffer());
}

export function PdfOverlayCompare({
  document: sourceDocument,
  selectedVersion,
  onSelectVersion,
}: {
  document: PdfComparisonDocument;
  onSelectVersion: (version: string) => void;
  selectedVersion: string;
}) {
  const [compareMode, setCompareMode] = useState<CompareMode>("overlay");
  const [overlayOpacity, setOverlayOpacity] = useState(58);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [baseImage, setBaseImage] = useState("");
  const [overlayImage, setOverlayImage] = useState("");

  const availableVersions = useMemo(
    () =>
      sourceDocument.versions.filter(
        (version) => version.version !== sourceDocument.revision && version.downloadUrl,
      ),
    [sourceDocument.revision, sourceDocument.versions],
  );

  const activeCompareVersion =
    availableVersions.find((version) => version.version === selectedVersion) ??
    availableVersions[0] ??
    null;

  useEffect(() => {
    if (!activeCompareVersion && selectedVersion) {
      onSelectVersion("");
    }
  }, [activeCompareVersion, onSelectVersion, selectedVersion]);

  useEffect(() => {
    if (!sourceDocument.downloadUrl || !activeCompareVersion?.downloadUrl) {
      return;
    }

    let cancelled = false;

    async function renderComparison() {
      try {
        const currentUrl = sourceDocument.downloadUrl;
        const compareUrl = activeCompareVersion.downloadUrl;
        if (!currentUrl || !compareUrl) {
          return;
        }

        setLoading(true);
        setError("");
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const [currentBytes, compareBytes] = await Promise.all([
          fetchPdfBytes(currentUrl),
          fetchPdfBytes(compareUrl),
        ]);

        const [currentPdf, comparePdf] = await Promise.all([
          pdfjs.getDocument({ data: currentBytes }).promise,
          pdfjs.getDocument({ data: compareBytes }).promise,
        ]);

        const comparablePageCount = Math.min(currentPdf.numPages, comparePdf.numPages);
        const safePage = Math.min(page, comparablePageCount);

        if (!cancelled) {
          setPageCount(comparablePageCount);
        }

        if (safePage !== page) {
          if (!cancelled) {
            setPage(safePage);
          }
          return;
        }

        const [currentPage, comparePage] = await Promise.all([
          currentPdf.getPage(safePage),
          comparePdf.getPage(safePage),
        ]);

        const currentBaseViewport = currentPage.getViewport({ scale: 1 });
        const compareBaseViewport = comparePage.getViewport({ scale: 1 });
        const targetWidth = Math.max(currentBaseViewport.width, compareBaseViewport.width) * 1.35;
        const currentScale = targetWidth / currentBaseViewport.width;
        const compareScale = targetWidth / compareBaseViewport.width;
        const currentViewport = currentPage.getViewport({ scale: currentScale });
        const compareViewport = comparePage.getViewport({ scale: compareScale });
        const canvasWidth = Math.round(Math.max(currentViewport.width, compareViewport.width));
        const canvasHeight = Math.round(Math.max(currentViewport.height, compareViewport.height));

        async function renderPageToDataUrl(
          pageProxy: Awaited<ReturnType<typeof currentPdf.getPage>>,
          viewport: { height: number; width: number },
          scaledViewport: ReturnType<typeof currentPage.getViewport>,
        ) {
          const canvas = window.document.createElement("canvas");
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Canvas indisponible pour la comparaison PDF.");
          }

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

          await pageProxy.render({
            canvasContext: context,
            transform: [
              1,
              0,
              0,
              1,
              Math.round((canvasWidth - viewport.width) / 2),
              Math.round((canvasHeight - viewport.height) / 2),
            ],
            viewport: scaledViewport,
          }).promise;

          return canvas.toDataURL("image/png");
        }

        const [nextBaseImage, nextOverlayImage] = await Promise.all([
          renderPageToDataUrl(currentPage, currentViewport, currentViewport),
          renderPageToDataUrl(comparePage, compareViewport, compareViewport),
        ]);

        if (!cancelled) {
          setBaseImage(nextBaseImage);
          setOverlayImage(nextOverlayImage);
        }

        currentPdf.destroy();
        comparePdf.destroy();
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Comparaison PDF indisponible pour cette revision.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void renderComparison();

    return () => {
      cancelled = true;
    };
  }, [activeCompareVersion?.downloadUrl, page, sourceDocument.downloadUrl]);

  if (!sourceDocument.downloadUrl) {
    return (
      <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-5 text-sm leading-6 text-slate-300">
        Cette revision courante n&apos;a pas encore de PDF stocke dans la plateforme.
      </div>
    );
  }

  if (availableVersions.length === 0 || !activeCompareVersion?.downloadUrl) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/10 bg-white/4 px-4 py-5 text-sm leading-6 text-slate-300">
        La comparaison visuelle sera disponible des qu&apos;au moins deux revisions PDF
        televersees seront conservees dans l&apos;historique de ce plan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Revision de reference
          </span>
          <select
            value={activeCompareVersion.version}
            onChange={(event) => onSelectVersion(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none"
          >
            {availableVersions.map((version) => (
              <option key={version.version} value={version.version}>
                {version.version} - {version.status} - {version.publishedAt}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setCompareMode("overlay")}
            className={cx(
              "flex items-center justify-center gap-2 rounded-[22px] border px-4 py-4 text-sm font-semibold",
              compareMode === "overlay"
                ? "border-sky-400/25 bg-sky-400/12 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
            )}
          >
            <Layers3 className="size-4" />
            Superposition
          </button>
          <button
            onClick={() => setCompareMode("difference")}
            className={cx(
              "flex items-center justify-center gap-2 rounded-[22px] border px-4 py-4 text-sm font-semibold",
              compareMode === "difference"
                ? "border-emerald-400/25 bg-emerald-400/12 text-emerald-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
            )}
          >
            <FileDiff className="size-4" />
            Difference
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="rounded-[22px] border border-white/8 bg-white/4 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Intensite du calque compare
            </span>
            <span className="text-sm font-semibold text-white">{overlayOpacity}%</span>
          </div>
          <input
            type="range"
            min={15}
            max={100}
            value={overlayOpacity}
            onChange={(event) => setOverlayOpacity(Number(event.target.value))}
            className="mt-3 w-full accent-sky-400"
          />
        </label>

        <div className="flex items-center gap-2 rounded-[22px] border border-white/8 bg-white/4 px-4 py-3">
          <button
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            className="rounded-full border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/8"
          >
            -
          </button>
          <div className="min-w-[92px] text-center text-sm text-white">
            Page {page}/{pageCount}
          </div>
          <button
            onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
            className="rounded-full border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/8"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="primary">{sourceDocument.revision}</StatusBadge>
        <StatusBadge tone="warning">{activeCompareVersion.version}</StatusBadge>
        <StatusBadge tone={compareMode === "difference" ? "success" : "primary"}>
          {compareMode === "difference" ? "Mode difference" : "Mode superposition"}
        </StatusBadge>
      </div>

      {error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-white/8 bg-[#0b1322] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Vue comparee
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {sourceDocument.code} - {activeCompareVersion.version} vs {sourceDocument.revision}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Eye className="size-4" />
            Revisions superposees sur la meme page
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[20px] border border-white/8 bg-slate-950/70">
          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-slate-300">
              <RefreshCw className="size-4 animate-spin" />
              Chargement de la comparaison PDF...
            </div>
          ) : baseImage && overlayImage ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${sourceDocument.revision} base`}
                className="h-auto w-full"
                src={baseImage}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${activeCompareVersion.version} compare`}
                className="absolute inset-0 h-full w-full object-contain"
                src={overlayImage}
                style={{
                  mixBlendMode: compareMode === "difference" ? "difference" : "normal",
                  opacity: overlayOpacity / 100,
                }}
              />
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-400">
              Aucune image de comparaison disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
