import { useRef, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "@primer/octicons-react";
import cn from "classnames";

import "./chip-input.scss";

export interface ChipInputProps {
  /** Current chip/tag values. */
  value: string[];
  /** Called when chips change (add or remove). */
  onChange: (values: string[]) => void;
  /** Suggestions to show in the dropdown. Filtered by the component. */
  suggestions: string[];
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Disable the input. */
  disabled?: boolean;
}

/**
 * Reusable chip/tag input field with suggestion dropdown.
 *
 * Used for genres, developers, publishers, and tags in the metadata editor.
 *
 * - Type to filter suggestions
 * - Press Enter/Tab/Comma to add the chip
 * - Click X to remove a chip
 * - Backspace on empty input removes the last chip
 * - Dropdown closes on blur or selection
 */
export function ChipInput({
  value,
  onChange,
  suggestions,
  placeholder,
  disabled,
}: Readonly<ChipInputProps>) {
  const { t } = useTranslation("game_details");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const availableSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.some((v) => v.toLowerCase() === s.toLowerCase())
  );

  const hasMatchingSuggestions =
    inputValue.trim().length > 0 && availableSuggestions.length > 0;

  const addChip = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
        setInputValue("");
        setShowSuggestions(false);
        return;
      }
      onChange([...value, trimmed]);
      setInputValue("");
      setShowSuggestions(false);
      setActiveIndex(-1);
    },
    [value, onChange]
  );

  const removeChip = useCallback(
    (index: number) => {
      const next = value.filter((_, i) => i !== index);
      onChange(next);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();

      if (showSuggestions && activeIndex >= 0) {
        const selected = availableSuggestions[activeIndex];
        if (selected) {
          addChip(selected);
          return;
        }
      }

      addChip(inputValue);
      return;
    }

    if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeChip(value.length - 1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showSuggestions && hasMatchingSuggestions) {
        setShowSuggestions(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) =>
          prev < availableSuggestions.length - 1 ? prev + 1 : 0
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : availableSuggestions.length - 1
      );
      return;
    }

    if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.trim().length > 0) {
      setShowSuggestions(true);
      setActiveIndex(-1);
    } else {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!showSuggestions) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  return (
    <div
      ref={containerRef}
      className={cn("chip-input", {
        "chip-input--disabled": disabled,
        "chip-input--focused": showSuggestions,
      })}
    >
      <div className="chip-input__chips">
        {value.map((chip, index) => (
          <span key={`${chip}-${index}`} className="chip-input__chip">
            <span className="chip-input__chip-text">{chip}</span>
            <button
              type="button"
              className="chip-input__chip-remove"
              onClick={() => removeChip(index)}
              disabled={disabled}
              aria-label={`Remove ${chip}`}
            >
              <XIcon size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="chip-input__input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim().length > 0) setShowSuggestions(true);
          }}
          onBlur={() => {
            // Delay to allow suggestion click to fire
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          disabled={disabled}
        />
      </div>

      {showSuggestions && hasMatchingSuggestions && (
        <div className="chip-input__suggestions">
          {availableSuggestions.slice(0, 12).map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              className={cn("chip-input__suggestion", {
                "chip-input__suggestion--active": index === activeIndex,
              })}
              onMouseDown={(e) => {
                e.preventDefault();
                addChip(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
          {availableSuggestions.length === 0 && (
            <div className="chip-input__suggestion--empty">
              {t("chip_input_no_suggestions", "No suggestions")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
