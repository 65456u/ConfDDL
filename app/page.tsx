"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type Conference,
  conferences,
  areaOrder,
  type ConferenceDeadline,
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

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const INITIAL_SORT_REFERENCE = new Date("1970-01-01T00:00:00.000Z");

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getDeadlineDate(deadline: ConferenceDeadline): Date {
  return new Date(
    `${deadline.year}-${pad(deadline.month)}-${pad(deadline.day)}T${pad(deadline.hour)}:${pad(deadline.minute)}:00${deadline.offset}`,
  );
}

function deadlineDateFor(conf: Conference): Date | null {
  if (!conf.deadline || conf.isRolling) return null;
  return getDeadlineDate(conf.deadline);
}

function formatDeadlineLabel(deadline: ConferenceDeadline): string {
  const timezone =
    deadline.offset === "-12:00"
      ? "AoE"
      : deadline.offset === "+00:00"
        ? "UTC"
        : `UTC${deadline.offset}`;
  return `${MONTH_LABELS[deadline.month - 1]} ${deadline.day}, ${deadline.year}, ${pad(deadline.hour)}:${pad(deadline.minute)} (${timezone})`;
}

function formatCountdown(target: Date, now: Date, estimated = false): string {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return estimated ? "Estimate passed" : "Closed";
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

function deadlineRank(date: Date | null, now: Date): number {
  if (!date) return 2;
  return date.getTime() > now.getTime() ? 0 : 1;
}

function compareByDeadline(
  a: Conference,
  b: Conference,
  now: Date,
  direction: SortDirection = "asc",
): number {
  const dateA = deadlineDateFor(a);
  const dateB = deadlineDateFor(b);
  const rankA = deadlineRank(dateA, now);
  const rankB = deadlineRank(dateB, now);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  if (!dateA || !dateB) {
    return direction === "asc"
      ? a.acronym.localeCompare(b.acronym)
      : b.acronym.localeCompare(a.acronym);
  }

  const timeDifference =
    rankA === 0
      ? dateA.getTime() - dateB.getTime()
      : dateB.getTime() - dateA.getTime();
  if (timeDifference !== 0) {
    return direction === "asc" ? timeDifference : -timeDifference;
  }

  return direction === "asc"
    ? a.acronym.localeCompare(b.acronym)
    : b.acronym.localeCompare(a.acronym);
}

function defaultCompare(a: Conference, b: Conference, now: Date): number {
  return compareByDeadline(a, b, now);
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
      return compareByDeadline(a, b, now, sort.direction);
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
  const [now, setNow] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [sort, setSort] = useState<SortState>({
    key: "default",
    direction: "asc",
  });
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const updateNow = () => {
      setNow(new Date());
    };

    updateNow();
    const timer = setInterval(updateNow, 1000);
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
  const sortReference = now ?? INITIAL_SORT_REFERENCE;

  const sortedByArea = useMemo(() => {
    const clone: Grouped = {};
    for (const area of areaKeys) {
      const entries = grouped[area] ?? [];
      clone[area] = [...entries].sort((a, b) =>
        compareConferences(a, b, sort, sortReference),
      );
    }
    return clone;
  }, [grouped, areaKeys, sort, sortReference]);

  const combinedRows = useMemo(
    () =>
      conferences
        .map((conf) => ({ conf, area: areaLabelFor(conf) }))
        .sort((a, b) =>
          compareConferences(a.conf, b.conf, sort, sortReference),
        ),
    [sort, sortReference],
  );

  const upcoming = useMemo(() => {
    if (!now) return [];

    const entries: Array<{ conf: Conference; date: Date }> = [];

    for (const conf of conferences) {
      const date = deadlineDateFor(conf);
      if (date && date.getTime() > now.getTime()) {
        entries.push({ conf, date });
      }
    }

    return entries
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
    const deadlineDate = deadlineDateFor(conf);
    const countdown =
      deadlineDate && conf.deadline && now
        ? formatCountdown(deadlineDate, now, conf.deadline.estimated)
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
                {formatDeadlineLabel(conf.deadline)}
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
          {conf.isRolling
            ? "Always open"
            : conf.deadline
              ? countdown ?? "Loading…"
              : "TBA"}
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
              venues. Official dates are shown where published; estimates are
              labeled—always confirm details on the conference website.
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
            {!now ? (
              <p className="text-sm text-slate-500">Loading countdowns…</p>
            ) : upcoming.length > 0 ? (
              <ul className="space-y-3">
                {upcoming.map(({ conf, date }) => (
                  <li
                    key={conf.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">
                        {conf.acronym}
                      </span>
                      {conf.deadline && (
                        <span className="text-xs text-slate-500">
                          {formatDeadlineLabel(conf.deadline)}
                          {conf.deadline.estimated ? " · est." : ""}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">
                      {formatCountdown(date, now, conf.deadline?.estimated)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No upcoming deadlines.</p>
            )}
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
