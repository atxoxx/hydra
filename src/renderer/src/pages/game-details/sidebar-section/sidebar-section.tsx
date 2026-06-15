import { ChevronDownIcon } from "@primer/octicons-react";
import { LinkExternalIcon } from "@primer/octicons-react";
import { useEffect, useRef, useState } from "react";
import "./sidebar-section.scss";

export interface SidebarSectionProps {
  title: string;
  subtitle?: string;
  subtitleHref?: string;
  children: React.ReactNode;
  /** Unique key for persisting collapse state. If omitted, no persistence. */
  collapseStorageKey?: string;
}

function getCollapsedSet(): Set<string> {
  try {
    const raw = localStorage.getItem("hydra_sidebar_collapsed");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // nothing
  }
  return new Set();
}

function saveCollapsedSet(set: Set<string>) {
  try {
    localStorage.setItem("hydra_sidebar_collapsed", JSON.stringify([...set]));
  } catch {
    // nothing
  }
}

export function SidebarSection({
  title,
  subtitle,
  subtitleHref,
  children,
  collapseStorageKey,
}: SidebarSectionProps) {
  const content = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(() => {
    if (collapseStorageKey) {
      return !getCollapsedSet().has(collapseStorageKey);
    }
    return true;
  });

  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (content.current && content.current.scrollHeight !== height) {
      setHeight(isOpen ? content.current.scrollHeight : 0);
    } else if (!isOpen) {
      setHeight(0);
    }
  }, [isOpen, children, height]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (collapseStorageKey) {
      const set = getCollapsedSet();
      if (next) {
        set.delete(collapseStorageKey);
      } else {
        set.add(collapseStorageKey);
      }
      saveCollapsedSet(set);
    }
  };

  return (
    <div className="sidebar-section">
      <div className="sidebar-section__header">
        <button
          type="button"
          onClick={handleToggle}
          className="sidebar-section__button"
        >
          <ChevronDownIcon
            className={`sidebar-section__chevron ${
              isOpen ? "sidebar-section__chevron--open" : ""
            }`}
          />
          <span>{title}</span>
        </button>

        {subtitle && subtitleHref && (
          <a
            href={subtitleHref}
            className="sidebar-section__subtitle"
            target="_blank"
            rel="noreferrer"
          >
            {subtitle}
            <LinkExternalIcon size={12} />
          </a>
        )}
      </div>

      <div
        ref={content}
        className="sidebar-section__content"
        style={{
          maxHeight: `${height}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
