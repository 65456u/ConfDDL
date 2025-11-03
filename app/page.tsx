"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type Conference,
  conferences,
  areaOrder,
  type RecurringDeadline,
} from "@/data/conferences";

type Grouped = Record<string, Conference[]>;
type SortKey =
  | "default"
  | "area"
  | "acronym"
  | "deadline"
  | "countdown"
  | "location";
type SortDirection = "asc" | "desc";

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

type ViewMode = "combined" | "sectioned";

const viewOptions: Array<{ id: ViewMode; label: string }> = [
  { id: "combined", label: "All conferences" },
  { id: "sectioned", label: "Group by area" },
];

const DEFAULT_AREA_ORDER = ["Other Conferences"];

const areaPriority: Record<string, number> = [...areaOrder, ...DEFAULT_AREA_ORDER].reduce(
  (acc, area, index) => {
    acc[area] = index;
    return acc;
  },
  {} as Record<string, number>,
);

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getNextOccurrence(deadline: RecurringDeadline, pivot: Date): Date {
  const baseYear = pivot.getUTCFullYear();
  const buildDate = (year: number) =>
    new Date(
      `${year}-${pad(deadline.month)}-${pad(deadline.day)}T${pad(deadline.hour)}:${pad(deadline.minute)}:00${deadline.offset}`,
    );

  const candidate = buildDate(baseYear);
  if (candidate.getTime() <= pivot.getTime()) {
    return buildDate(baseYear + 1);
  }
  return candidate;
}

function formatCountdown(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return "Closed";
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function defaultCompare(
  a: Conference,
  b: Conference,
  now: Date,
): number {
  const aHasDeadline = Boolean(a.deadline && !a.isRolling);
  const bHasDeadline = Boolean(b.deadline && !b.isRolling);

  if (aHasDeadline && bHasDeadline) {
    const nextA = getNextOccurrence(a.deadline!, now);
    const nextB = getNextOccurrence(b.deadline!, now);
    if (nextA.getTime() !== nextB.getTime()) {
      return nextA.getTime() - nextB.getTime();
    }
    return a.acronym.localeCompare(b.acronym);
  }

  if (aHasDeadline) return -1;
  if (bHasDeadline) return 1;
  return a.acronym.localeCompare(b.acronym);
}

function compareConferences(
  a: Conference,
  b: Conference,
  sort: SortState,
  now: Date,
): number {
  if (sort.key === "default") {
    return defaultCompare(a, b, now);
  }

  const direction = sort.direction === "asc" ? 1 : -1;

  switch (sort.key) {
    case "area": {
      const areaCompare = compareAreaLabels(
        areaLabelFor(a),
        areaLabelFor(b),
      );
      if (areaCompare !== 0) {
        return direction * areaCompare;
      }
      return direction * a.acronym.localeCompare(b.acronym);
    }
    case "acronym": {
      return direction * a.acronym.localeCompare(b.acronym);
    }
    case "location": {
      const result =
        (a.location ?? "").localeCompare(b.location ?? "") ||
        a.acronym.localeCompare(b.acronym);
      return direction * result;
    }
    case "deadline":
    case "countdown": {
      const valueA =
        !a.isRolling && a.deadline
          ? getNextOccurrence(a.deadline, now).getTime()
          : Number.POSITIVE_INFINITY;
      const valueB =
        !b.isRolling && b.deadline
          ? getNextOccurrence(b.deadline, now).getTime()
          : Number.POSITIVE_INFINITY;

      const aFinite = Number.isFinite(valueA);
      const bFinite = Number.isFinite(valueB);

      if (aFinite && bFinite) {
        if (valueA === valueB) {
          return direction * a.acronym.localeCompare(b.acronym);
        }
        return direction * (valueA < valueB ? -1 : 1);
      }

      if (aFinite && !bFinite) return direction * -1;
      if (!aFinite && bFinite) return direction * 1;
      return direction * a.acronym.localeCompare(b.acronym);
    }
    default:
      return defaultCompare(a, b, now);
  }
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="h-3 w-3 text-slate-300"
      >
        <path
          d="M6 2.5L8.75 6H3.25L6 2.5z"
          fill="currentColor"
          opacity="0.8"
        />
        <path
          d="M6 9.5L3.25 6H8.75L6 9.5z"
          fill="currentColor"
          opacity="0.4"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 text-emerald-600 transition-transform duration-150 ${direction === "desc" ? "rotate-180" : ""}`}
    >
      <path d="M6 2.25L8.75 5.75H3.25L6 2.25z" fill="currentColor" />
      <path
        d="M4.25 8.75h3.5c.138 0 .25.112.25.25 0 .139-.112.25-.25.25h-3.5a.25.25 0 01-.25-.25c0-.138.112-.25.25-.25z"
        fill="currentColor"
      />
    </svg>
  );
}

function getLocationHref(location?: string, override?: string): string | undefined {
  if (override) return override;
  if (!location) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location,
  )}`;
}

function resolveAreaOrder(grouped: Grouped): string[] {
  const referenced = new Set<string>(areaOrder);
  const extraAreas = Object.keys(grouped).filter(
    (area) => !referenced.has(area),
  );
  return [...areaOrder, ...extraAreas, ...DEFAULT_AREA_ORDER].filter(
    (area) => grouped[area]?.length,
  );
}

function areaLabelFor(conf: Conference): string {
  return conf.area ?? DEFAULT_AREA_ORDER[0];
}

function compareAreaLabels(a?: string, b?: string): number {
  const rank = (label?: string) => {
    if (!label) return areaOrder.length + 1;
    return areaPriority[label] ?? areaOrder.length + 1;
  };

  const rankA = rank(a);
  const rankB = rank(b);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return (a ?? "").localeCompare(b ?? "");
}

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [sort, setSort] = useState<SortState>({
    key: "default",
    direction: "asc",
  });
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const grouped = useMemo(() => {
    return conferences.reduce<Grouped>((acc, conf) => {
      const key = areaLabelFor(conf);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key]!.push(conf);
      return acc;
    }, {});
  }, []);

  const areaKeys = useMemo(() => resolveAreaOrder(grouped), [grouped]);

  const sortedByArea = useMemo(() => {
    const clone: Grouped = {};
    for (const area of areaKeys) {
      const entries = grouped[area] ?? [];
      clone[area] = [...entries].sort((a, b) =>
        compareConferences(a, b, sort, now),
      );
    }
    return clone;
  }, [grouped, areaKeys, now, sort]);

  const combinedRows = useMemo(
    () =>
      conferences
        .map((conf) => ({ conf, area: areaLabelFor(conf) }))
        .sort((a, b) => compareConferences(a.conf, b.conf, sort, now)),
    [sort, now],
  );

  const upcoming = useMemo(() => {
    return conferences
      .filter((conf) => conf.deadline && !conf.isRolling)
      .map((conf) => ({
        conf,
        date: getNextOccurrence(conf.deadline!, now),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);
  }, [now]);

  const areaMetadata = useMemo(() => {
    if (viewMode !== "sectioned") return [];
    return areaKeys.map((area) => ({ name: area, id: slugify(area) }));
  }, [areaKeys, viewMode]);
  const ariaSortFor = (key: SortKey) =>
    sort.key === key
      ? sort.direction === "asc"
        ? "ascending"
        : "descending"
      : "none";
  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") {
          return { key, direction: "desc" };
        }
        if (prev.direction === "desc") {
          return { key: "default", direction: "asc" };
        }
      }
      return { key, direction: "asc" };
    });
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewChange = (next: ViewMode) => {
    setViewMode(next);
    if (next === "sectioned" && sort.key === "area") {
      setSort({ key: "default", direction: "asc" });
    }
  };

  const renderRow = (conf: Conference, areaLabel?: string) => {
    const nextDeadline =
      conf.deadline && !conf.isRolling
        ? getNextOccurrence(conf.deadline, now)
        : null;
    const countdown =
      nextDeadline && nextDeadline.getTime() > now.getTime()
        ? formatCountdown(nextDeadline, now)
        : null;
    const locationHref = getLocationHref(conf.location, conf.locationUrl);

    const rowKey = areaLabel
      ? `${conf.id}-${slugify(areaLabel)}`
      : conf.id;

    return (
      <tr key={rowKey} className="hover:bg-slate-50/70">
        {areaLabel && (
          <td className="px-6 py-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {areaLabel}
            </span>
          </td>
        )}
        <td className="max-w-[18rem] px-6 py-4">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">
              {conf.acronym}
            </span>
            <span className="text-xs text-slate-500">{conf.name}</span>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link
                href={conf.website}
                className="font-medium text-emerald-600 hover:text-emerald-500"
                target="_blank"
                rel="noreferrer"
              >
                Website
              </Link>
              {conf.submissionLink && (
                <Link
                  href={conf.submissionLink}
                  className="font-medium text-emerald-600 hover:text-emerald-500"
                  target="_blank"
                  rel="noreferrer"
                >
                  Call for papers
                </Link>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-slate-700">
          {conf.isRolling && (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Rolling
            </span>
          )}
          {!conf.isRolling && conf.deadline && (
            <div className="flex flex-col">
              <span className="font-medium text-slate-900">
                {conf.deadline.label}
                {conf.deadline.estimated ? " · est." : ""}
              </span>
              {conf.note && (
                <span className="text-xs text-slate-500">{conf.note}</span>
              )}
            </div>
          )}
          {!conf.isRolling && !conf.deadline && (
            <span className="text-slate-500">TBA</span>
          )}
        </td>
        <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
          {conf.isRolling ? "Always open" : countdown ?? "Closed"}
        </td>
        <td className="px-6 py-4 text-sm text-slate-600">
          {conf.location ? (
            locationHref ? (
              <Link
                href={locationHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 transition hover:text-emerald-500"
              >
                {conf.location}
                <span aria-hidden="true" className="text-xs">
                  ↗
                </span>
              </Link>
            ) : (
              <span>{conf.location}</span>
            )
          ) : (
            "—"
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
              Conference Deadlines
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600 md:text-base">
              Track submission timelines for top AI, ML, robotics, and related
              venues. Dates are based on historical schedules—always confirm
              details on the official conference websites.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 md:max-w-sm md:items-end">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs font-medium text-slate-600 shadow-sm">
              {viewOptions.map((option) => {
                const active = viewMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleViewChange(option.id)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
                      active
                        ? "bg-emerald-500 text-white shadow"
                        : "text-slate-600 hover:text-emerald-600"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {viewMode === "sectioned" && areaMetadata.length > 0 && (
              <nav className="flex flex-wrap gap-2 text-xs font-medium text-slate-600 md:justify-end">
                {areaMetadata.map((entry) => (
                  <a
                    key={entry.id}
                    href={`#${entry.id}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:border-emerald-200 hover:text-emerald-600"
                  >
                    {entry.name}
                  </a>
                ))}
              </nav>
            )}
          </div>
          <div className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:max-w-xs">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Next up
            </span>
            <ul className="space-y-3">
              {upcoming.map(({ conf, date }) => (
                <li key={conf.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900">
                      {conf.acronym}
                    </span>
                    <span className="text-xs text-slate-500">
                      {conf.deadline?.label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">
                    {formatCountdown(date, now)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 flex max-w-6xl flex-col gap-12 px-6">
        {viewMode === "combined" ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  All conferences
                </h2>
                <p className="text-sm text-slate-600">
                  Browse every venue in one list. Sort columns to surface the
                  next deadlines you care about.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th
                      scope="col"
                      className="px-6 py-3"
                      aria-sort={ariaSortFor("area")}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("area")}
                        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "area" ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        Area
                        <SortIndicator
                          active={sort.key === "area"}
                          direction={sort.direction}
                        />
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3"
                      aria-sort={ariaSortFor("acronym")}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("acronym")}
                        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "acronym" ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        Venue
                        <SortIndicator
                          active={sort.key === "acronym"}
                          direction={sort.direction}
                        />
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3"
                      aria-sort={ariaSortFor("deadline")}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("deadline")}
                        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "deadline" ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        Deadline
                        <SortIndicator
                          active={sort.key === "deadline"}
                          direction={sort.direction}
                        />
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3"
                      aria-sort={ariaSortFor("countdown")}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("countdown")}
                        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "countdown" ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        Countdown
                        <SortIndicator
                          active={sort.key === "countdown"}
                          direction={sort.direction}
                        />
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3"
                      aria-sort={ariaSortFor("location")}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("location")}
                        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "location" ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        Location
                        <SortIndicator
                          active={sort.key === "location"}
                          direction={sort.direction}
                        />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {combinedRows.map(({ conf, area }) => renderRow(conf, area))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          areaKeys.map((area) => (
            <section
              key={area}
              id={slugify(area)}
              className="space-y-4 scroll-mt-28"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {area}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Submission countdowns update live — times shown are based on
                    the AoE standard unless noted.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th
                        scope="col"
                        className="px-6 py-3"
                        aria-sort={ariaSortFor("acronym")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("acronym")}
                          className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "acronym" ? "text-emerald-600" : "text-slate-500"}`}
                        >
                          Venue
                          <SortIndicator
                            active={sort.key === "acronym"}
                            direction={sort.direction}
                          />
                        </button>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3"
                        aria-sort={ariaSortFor("deadline")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("deadline")}
                          className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "deadline" ? "text-emerald-600" : "text-slate-500"}`}
                        >
                          Deadline
                          <SortIndicator
                            active={sort.key === "deadline"}
                            direction={sort.direction}
                          />
                        </button>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3"
                        aria-sort={ariaSortFor("countdown")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("countdown")}
                          className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "countdown" ? "text-emerald-600" : "text-slate-500"}`}
                        >
                          Countdown
                          <SortIndicator
                            active={sort.key === "countdown"}
                            direction={sort.direction}
                          />
                        </button>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3"
                        aria-sort={ariaSortFor("location")}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort("location")}
                          className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-emerald-600 ${sort.key === "location" ? "text-emerald-600" : "text-slate-500"}`}
                        >
                          Location
                          <SortIndicator
                            active={sort.key === "location"}
                            direction={sort.direction}
                          />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {sortedByArea[area]?.map((conf) => renderRow(conf))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-sm leading-relaxed text-emerald-900">
          <h3 className="text-base font-semibold text-emerald-900">
            Disclaimer
          </h3>
          <p className="mt-2">
            Deadlines are compiled from recent conference cycles and may shift
            year to year. Always confirm the latest details, including abstract
            deadlines and exact time zones, on the official conference pages
            before submitting your work.
          </p>
        </section>
      </main>
      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-8 right-8 inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl text-slate-600 shadow-lg transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          aria-label="Go to top"
        >
          <span className="leading-none" aria-hidden="true">
            ↑
          </span>
        </button>
      )}
    </div>
  );
}
