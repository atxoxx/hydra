import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Color from "color";
import cn from "classnames";

import "./accent-color-picker.scss";

const PRESET_COLORS = [
  "#4a9eff", // Hydra Blue (default)
  "#ef4444", // Crimson Red
  "#f97316", // Amber Orange
  "#eab308", // Gold Yellow
  "#22c55e", // Emerald Green
  "#14b8a6", // Teal
  "#8b5cf6", // Violet
  "#ec4899", // Rose Pink
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
  "#78716c", // Warm Gray
  "#f43f5e", // Rose Red
];

const DEFAULT_ACCENT_COLOR = "#4a9eff";

function isValidHex(text: string): boolean {
  return /^#[\da-f]{6}$/i.test(text.trim());
}

function isValidRgb(text: string): boolean {
  const trimmed = text.trim();
  return /^rgb\s*\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(trimmed);
}

function normalizeColorInput(text: string): string {
  const trimmed = text.trim();
  if (isValidRgb(trimmed)) {
    try {
      const rgb = trimmed.match(/\d+/g);
      if (rgb && rgb.length === 3) {
        return `#${rgb
          .map((v) =>
            Math.min(255, Math.max(0, parseInt(v, 10)))
              .toString(16)
              .padStart(2, "0")
          )
          .join("")}`;
      }
    } catch {
      /* fall through */
    }
  }
  return trimmed;
}

export interface AccentColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

export function AccentColorPicker({
  value,
  onChange,
}: Readonly<AccentColorPickerProps>) {
  const { t } = useTranslation("settings");

  const [inputValue, setInputValue] = useState("");
  const [hasError, setHasError] = useState(false);

  const activeColor = value || DEFAULT_ACCENT_COLOR;

  // Sync input when value changes externally
  useEffect(() => {
    setInputValue(activeColor);
    setHasError(false);
  }, [activeColor]);

  const handlePresetClick = useCallback(
    (color: string) => {
      setInputValue(color);
      setHasError(false);
      onChange(color === DEFAULT_ACCENT_COLOR ? null : color);
    },
    [onChange]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setInputValue(nextValue);
      setHasError(false);
    },
    []
  );

  const handleInputBlur = useCallback(() => {
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setInputValue(DEFAULT_ACCENT_COLOR);
      setHasError(false);
      onChange(null);
      return;
    }

    if (isValidHex(trimmed) || isValidRgb(trimmed)) {
      const normalized = normalizeColorInput(trimmed);
      setInputValue(normalized);
      setHasError(false);
      onChange(normalized === DEFAULT_ACCENT_COLOR ? null : normalized);
    } else {
      setHasError(true);
    }
  }, [inputValue, onChange]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        (event.target as HTMLInputElement).blur();
      }
    },
    []
  );

  const handleReset = useCallback(() => {
    setInputValue(DEFAULT_ACCENT_COLOR);
    setHasError(false);
    onChange(null);
  }, [onChange]);

  const isPresetSelected = (color: string) => {
    if (!value && color === DEFAULT_ACCENT_COLOR) return true;
    try {
      return new Color(color).hex() === new Color(activeColor).hex();
    } catch {
      return false;
    }
  };

  return (
    <div className="accent-color-picker">
      <div className="accent-color-picker__header">
        <span className="accent-color-picker__label">{t("accent_color")}</span>
        {value && (
          <button
            type="button"
            className="accent-color-picker__reset"
            onClick={handleReset}
          >
            {t("accent_color_reset")}
          </button>
        )}
      </div>

      <p className="accent-color-picker__description">
        {t("accent_color_description")}
      </p>

      <div className="accent-color-picker__presets">
        <small className="accent-color-picker__presets-label">
          {t("accent_color_presets")}
        </small>
        <div className="accent-color-picker__presets-grid">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn("accent-color-picker__preset", {
                "accent-color-picker__preset--selected":
                  isPresetSelected(color),
              })}
              style={{ backgroundColor: color }}
              onClick={() => handlePresetClick(color)}
              aria-label={color}
              disabled={isPresetSelected(color)}
            />
          ))}
        </div>
      </div>

      <div className="accent-color-picker__custom">
        <small className="accent-color-picker__custom-label">
          {t("accent_color_custom")}
        </small>
        <div className="accent-color-picker__custom-input-wrapper">
          <div
            className="accent-color-picker__custom-swatch"
            style={{
              backgroundColor: hasError ? DEFAULT_ACCENT_COLOR : activeColor,
            }}
          />
          <input
            type="text"
            className={cn("accent-color-picker__custom-input", {
              "accent-color-picker__custom-input--error": hasError,
            })}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder={t("accent_color_custom_placeholder")}
            spellCheck={false}
          />
        </div>
        {hasError && (
          <span className="accent-color-picker__error">
            {t("accent_color_invalid")}
          </span>
        )}
      </div>

      <div className="accent-color-picker__preview">
        <small className="accent-color-picker__preview-label">Preview</small>
        <div className="accent-color-picker__preview-row">
          <div
            className="accent-color-picker__preview-button"
            style={{ backgroundColor: activeColor }}
          >
            Button
          </div>
          <span
            className="accent-color-picker__preview-link"
            style={{ color: activeColor }}
          >
            Link example
          </span>
          <div
            className="accent-color-picker__preview-badge"
            style={{
              backgroundColor: activeColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}
