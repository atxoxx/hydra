import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export function GameDetailsSkeleton() {
  return (
    <div className="game-details__wrapper game-details__skeleton">
      <section className="game-details__container">
        {/* Hero skeleton */}
        <div className="game-details__hero">
          <Skeleton
            height={280}
            style={{
              borderRadius: "0px 0px 8px 8px",
              position: "absolute",
              width: "100%",
              zIndex: 0,
            }}
          />

          <div className="game-details__hero-logo-backdrop">
            <div className="game-details__hero-content">
              <div className="game-details__game-logo" />
              <div className="game-details__hero-buttons game-details__hero-buttons--right" />
            </div>
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="tab-bar" style={{ pointerEvents: "none" }}>
          <div className="tab-bar__tab tab-bar__tab--active">
            <Skeleton height={14} width={14} />
            <Skeleton height={14} width={60} />
          </div>
          <div className="tab-bar__tab">
            <Skeleton height={14} width={14} />
            <Skeleton height={14} width={50} />
          </div>
          <div className="tab-bar__tab">
            <Skeleton height={14} width={14} />
            <Skeleton height={14} width={55} />
          </div>
        </div>

        {/* Content area */}
        <div className="game-details__description-container">
          <div className="game-details__description-content">
            <div className="overview-tab">
              <div className="overview-tab__dashboard-grid">
                {/* Play/Status card */}
                <div className="dashboard-card">
                  <div className="dashboard-card__header">
                    <Skeleton height={16} width={16} />
                    <Skeleton height={14} width={80} />
                  </div>
                  <div className="dashboard-card__body">
                    <Skeleton height={18} width={150} />
                    <Skeleton
                      height={14}
                      width={100}
                      style={{ marginTop: 4 }}
                    />
                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      <Skeleton
                        height={36}
                        width={80}
                        style={{ borderRadius: 8 }}
                      />
                      <Skeleton
                        height={36}
                        width={36}
                        style={{ borderRadius: 8 }}
                      />
                      <Skeleton
                        height={36}
                        width={36}
                        style={{ borderRadius: 8 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Stats card */}
                <div className="dashboard-card">
                  <div className="dashboard-card__header">
                    <Skeleton height={16} width={16} />
                    <Skeleton height={14} width={50} />
                  </div>
                  <div className="dashboard-card__body">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 12,
                        }}
                      >
                        <Skeleton height={14} width={80} />
                        <Skeleton height={14} width={40} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* HLTB card */}
                <div className="dashboard-card">
                  <div className="dashboard-card__header">
                    <Skeleton height={16} width={16} />
                    <Skeleton height={14} width={100} />
                  </div>
                  <div className="dashboard-card__body">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        height={52}
                        style={{ marginBottom: 8, borderRadius: 4 }}
                      />
                    ))}
                  </div>
                </div>

                {/* Description card (full width) */}
                <div
                  className="dashboard-card"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <div className="dashboard-card__header">
                    <Skeleton height={16} width={16} />
                    <Skeleton height={14} width={100} />
                  </div>
                  <div className="dashboard-card__body">
                    <Skeleton
                      count={6}
                      height={22}
                      style={{ marginBottom: 4 }}
                    />
                  </div>
                </div>

                {/* Gallery card (full width) */}
                <div
                  className="dashboard-card"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <div className="dashboard-card__body" style={{ padding: 8 }}>
                    <Skeleton height={250} width="100%" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar skeleton */}
          <aside className="content-sidebar">
            <div className="sidebar-section">
              <div className="sidebar-section__header">
                <div
                  className="sidebar-section__button"
                  style={{ pointerEvents: "none" }}
                >
                  <Skeleton height={18} width={18} />
                  <Skeleton height={18} width={88} />
                </div>
              </div>
              <div className="sidebar-section__content">
                <div className="stats__section">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="stats__category">
                      <div className="stats__category-title">
                        <Skeleton height={14} width={14} />
                        <Skeleton height={14} width={70} />
                      </div>
                      <Skeleton height={14} width={35} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section__header">
                <div
                  className="sidebar-section__button"
                  style={{ pointerEvents: "none" }}
                >
                  <Skeleton height={18} width={18} />
                  <Skeleton height={18} width={136} />
                </div>
              </div>
              <div className="sidebar-section__content">
                <ul className="list">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <li key={index}>
                      <div
                        className="list__item"
                        style={{ pointerEvents: "none" }}
                      >
                        <Skeleton
                          height={54}
                          width={54}
                          style={{ borderRadius: 4 }}
                        />
                        <div>
                          <Skeleton
                            height={14}
                            width={100}
                            style={{ marginBottom: 4 }}
                          />
                          <Skeleton height={12} width={60} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
