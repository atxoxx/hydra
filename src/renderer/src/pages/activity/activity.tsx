import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserDetails } from "@renderer/hooks";
import type { GameShop } from "@types";
import type {
  DailyPlaytimeEntry,
  PlaytimeSummary,
  FriendPlaytimeStats,
  SessionWithGame,
} from "../../declaration";
import { DateRangeFilter, type DateRange } from "./date-range-filter";
import {
  ActivityToolbar,
  type AggregationMode,
  type ChartType,
} from "./activity-toolbar";
import { ActivityStatsBar } from "./activity-stats-bar";
import { ActivityGameSidebar } from "./activity-game-sidebar";
import { WeeklyHeatmap, type HeatmapDay } from "./weekly-heatmap";
import { FriendsComparison } from "./friends-comparison";
import { ActivityMainChart } from "./activity-main-chart";
import { PlatformBreakdown } from "./platform-breakdown";
import { GenreBreakdown } from "./genre-breakdown";
import { GlobalSessionList } from "./global-session-list";
import { PerformanceInsights } from "./performance-insights";
import { ActivityGanttChart } from "./activity-gantt-chart";
import {
  LayoutDashboard,
  History,
  BarChart3,
  GanttChart,
  Camera,
  Download,
  Filter,
} from "lucide-react";
import "./activity.scss";

const DATE_RANGE_PRESETS: Record<
  DateRange,
  { label: string; getRange: () => { startDate: string; endDate: string } }
> = {
  "7d": {
    label: "last_7_days",
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { startDate: fmt(start), endDate: fmt(end) };
    },
  },
  "30d": {
    label: "last_30_days",
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { startDate: fmt(start), endDate: fmt(end) };
    },
  },
  "90d": {
    label: "last_90_days",
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { startDate: fmt(start), endDate: fmt(end) };
    },
  },
  all: {
    label: "all_time",
    getRange: () => {
      const end = new Date();
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { startDate: "2000-01-01", endDate: fmt(end) };
    },
  },
};

type ActiveTab = "dashboard" | "sessions" | "performance" | "gantt";

export default function Activity() {
  const { t } = useTranslation("activity");
  const { userDetails } = useUserDetails();
  const contentRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PlaytimeSummary | null>(null);
  const [dailyEntries, setDailyEntries] = useState<DailyPlaytimeEntry[]>([]);
  const [friendsStats, setFriendsStats] = useState<FriendPlaytimeStats[]>([]);
  const [allSessions, setAllSessions] = useState<SessionWithGame[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [aggregation, setAggregation] = useState<AggregationMode>("day");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedGame, setSelectedGame] = useState<{
    objectId: string;
    shop: string;
    title: string;
  } | null>(null);

  const { startDate, endDate } = useMemo(
    () => DATE_RANGE_PRESETS[dateRange].getRange(),
    [dateRange]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResult, friendsResult, sessionsResult] = await Promise.all([
        window.electron.getPlaytimeSummary(startDate, endDate),
        userDetails ? window.electron.getFriendsStats() : Promise.resolve([]),
        window.electron.getAllSessions(),
      ]);
      setSummary(summaryResult);
      setFriendsStats(friendsResult);
      setAllSessions(sessionsResult);
    } catch {
      setSummary(null);
      setFriendsStats([]);
      setAllSessions([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, userDetails]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedGame) return;

    const fetchGameData = async () => {
      try {
        const entries = await window.electron.getDailyPlaytime(
          selectedGame.shop as GameShop,
          selectedGame.objectId,
          startDate,
          endDate
        );
        setDailyEntries(entries);
      } catch {
        setDailyEntries([]);
      }
    };

    fetchGameData();
  }, [selectedGame, startDate, endDate]);

  // Derive unique sources from top games
  const availableSources = useMemo(() => {
    if (!summary?.topGames) return [];
    const sources = new Set<string>();
    for (const g of summary.topGames) {
      if (g.shop) sources.add(g.shop);
    }
    return Array.from(sources).sort();
  }, [summary]);

  // Filter top games by source
  const filteredTopGames = useMemo(() => {
    if (!summary?.topGames) return [];
    if (sourceFilter === "all") return summary.topGames;
    return summary.topGames.filter((g) => g.shop === sourceFilter);
  }, [summary, sourceFilter]);

  const heatmapDays: HeatmapDay[] = useMemo(() => {
    if (!summary || !summary.dailyPlaytimes) return [];

    const dayMap = new Map<string, number>();
    for (const entry of summary.dailyPlaytimes) {
      dayMap.set(
        entry.date,
        (dayMap.get(entry.date) ?? 0) + entry.totalMilliseconds
      );
    }

    const days: HeatmapDay[] = [];
    const end = new Date(endDate + "T00:00:00");
    const start = new Date(startDate + "T00:00:00");
    const cursor = new Date(start);

    while (cursor <= end) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      days.push({
        date: dateStr,
        hours: (dayMap.get(dateStr) ?? 0) / 3_600_000,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [summary, startDate, endDate]);

  // Filter sessions by date range for Gantt view
  const ganttSessions = useMemo(() => {
    return allSessions.filter((s) => {
      const d = s.startTime.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [allSessions, startDate, endDate]);

  const handleGameSelect = (objectId: string, shop: string, title: string) => {
    if (!objectId) {
      setSelectedGame(null);
      return;
    }
    setSelectedGame((prev) =>
      prev?.objectId === objectId ? null : { objectId, shop, title }
    );
  };

  const handleScreenshot = useCallback(async () => {
    if (!contentRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: "#121212",
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `activity-overview-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (err) {
      console.error("Screenshot failed:", err);
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!allSessions.length) return;
    const header = "Game,Start Time,End Time,Duration (min),Shop\n";
    const rows = allSessions
      .map((s) => {
        const durationMin = Math.round(s.durationMs / 60_000);
        return `"${s.gameTitle}","${s.startTime}","${s.endTime}",${durationMin},"${s.shop}"`;
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allSessions]);

  return (
    <section className="activity__container">
      <div className="activity__content" ref={contentRef}>
        <header className="activity__header">
          <div className="activity__header-left">
            <h2 className="activity__title">{t("activity")}</h2>
            <div className="activity__tabs">
              <button
                type="button"
                className={`activity__tab-btn ${activeTab === "dashboard" ? "activity__tab-btn--active" : ""}`}
                onClick={() => setActiveTab("dashboard")}
              >
                <LayoutDashboard size={14} />
                {t("dashboard") || "Dashboard"}
              </button>
              <button
                type="button"
                className={`activity__tab-btn ${activeTab === "gantt" ? "activity__tab-btn--active" : ""}`}
                onClick={() => setActiveTab("gantt")}
              >
                <GanttChart size={14} />
                {t("timeline") || "Timeline"}
              </button>
              <button
                type="button"
                className={`activity__tab-btn ${activeTab === "sessions" ? "activity__tab-btn--active" : ""}`}
                onClick={() => setActiveTab("sessions")}
              >
                <History size={14} />
                {t("sessions") || "Sessions Log"}
              </button>
              <button
                type="button"
                className={`activity__tab-btn ${activeTab === "performance" ? "activity__tab-btn--active" : ""}`}
                onClick={() => setActiveTab("performance")}
              >
                <BarChart3 size={14} />
                {t("performance") || "Performance"}
              </button>
            </div>
          </div>

          <div className="activity__header-right">
            {/* Date range filter for non-dashboard tabs */}
            {activeTab === "gantt" && (
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
            )}

            {/* Source filter for gantt tab (toolbar handles dashboard) */}
            {activeTab === "gantt" && availableSources.length > 1 && (
              <div className="activity__source-filter">
                <Filter size={12} />
                <select
                  className="activity__source-select"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="all">{t("all_sources") || "All Sources"}</option>
                  {availableSources.map((src) => (
                    <option key={src} value={src}>
                      {src.charAt(0).toUpperCase() + src.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Export buttons */}
            <div className="activity__export-actions">
              <button
                type="button"
                className="activity__icon-btn"
                onClick={handleScreenshot}
                title={t("export_screenshot") || "Save Screenshot"}
              >
                <Camera size={14} />
              </button>
              <button
                type="button"
                className="activity__icon-btn"
                onClick={handleExportCSV}
                title={t("export_csv") || "Export CSV"}
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <>
            <ActivityToolbar
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              aggregation={aggregation}
              onAggregationChange={setAggregation}
              chartType={chartType}
              onChartTypeChange={setChartType}
              sources={availableSources}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
            />

            <ActivityStatsBar
              summary={summary}
              selectedGame={selectedGame}
              dailyEntries={dailyEntries}
              loading={loading}
            />

            <div className="activity__dashboard-layout">
              <ActivityGameSidebar
                games={filteredTopGames}
                loading={loading}
                onGameSelect={handleGameSelect}
                selectedGameId={selectedGame?.objectId ?? null}
              />

              <div className="activity__dashboard-main">
                <ActivityMainChart
                  dailyPlaytimes={summary?.dailyPlaytimes ?? null}
                  selectedGame={selectedGame}
                  dailyEntries={dailyEntries}
                  aggregation={aggregation}
                  chartType={chartType}
                  loading={loading}
                  startDate={startDate}
                  endDate={endDate}
                />

                {!selectedGame && (
                  <>
                    <div className="activity__two-column">
                      <PlatformBreakdown
                        platformBreakdown={summary?.platformBreakdown}
                        loading={loading}
                      />
                      <GenreBreakdown
                        genreBreakdown={summary?.genreBreakdown}
                        loading={loading}
                      />
                    </div>

                    <WeeklyHeatmap days={heatmapDays} loading={loading} />

                    <FriendsComparison
                      friendsStats={friendsStats}
                      isSignedIn={!!userDetails}
                      loading={loading}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "gantt" && (
          <ActivityGanttChart
            sessions={ganttSessions}
            loading={loading}
            dateRange={{ startDate, endDate }}
          />
        )}

        {activeTab === "sessions" && <GlobalSessionList />}

        {activeTab === "performance" && <PerformanceInsights />}
      </div>
    </section>
  );
}
