"use client";

import { ReactNode, useRef } from "react";

type EditableTextElement = HTMLInputElement | HTMLTextAreaElement;
type FormattedPlayerTextTag = "span" | "p" | "small" | "h2" | "h3";

function renderPlainText(text: string, keyPrefix: string): ReactNode[] {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => (
    index === 0
      ? [line]
      : [<br key={`${keyPrefix}-br-${index}`} />, line]
  ));
}

function renderFormattedSegments(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let plainStart = 0;
  let keyIndex = 0;

  while (cursor < text.length) {
    if (text.startsWith("**", cursor)) {
      const end = text.indexOf("**", cursor + 2);
      if (end !== -1) {
        if (plainStart < cursor) {
          nodes.push(...renderPlainText(text.slice(plainStart, cursor), `${keyPrefix}-plain-${keyIndex}`));
          keyIndex += 1;
        }
        nodes.push(
          <strong key={`${keyPrefix}-bold-${keyIndex}`}>
            {renderFormattedSegments(text.slice(cursor + 2, end), `${keyPrefix}-bold-${keyIndex}`)}
          </strong>,
        );
        keyIndex += 1;
        cursor = end + 2;
        plainStart = cursor;
        continue;
      }
    }

    if (text[cursor] === "*" && text[cursor + 1] !== "*") {
      let end = cursor + 1;
      while (end < text.length) {
        if (text[end] === "*" && text[end + 1] !== "*") break;
        end += 1;
      }
      if (end < text.length) {
        if (plainStart < cursor) {
          nodes.push(...renderPlainText(text.slice(plainStart, cursor), `${keyPrefix}-plain-${keyIndex}`));
          keyIndex += 1;
        }
        nodes.push(
          <em key={`${keyPrefix}-italic-${keyIndex}`}>
            {renderFormattedSegments(text.slice(cursor + 1, end), `${keyPrefix}-italic-${keyIndex}`)}
          </em>,
        );
        keyIndex += 1;
        cursor = end + 1;
        plainStart = cursor;
        continue;
      }
    }

    cursor += 1;
  }

  if (plainStart < text.length) {
    nodes.push(...renderPlainText(text.slice(plainStart), `${keyPrefix}-plain-${keyIndex}`));
  }

  return nodes;
}

export function formatPlayerText(text: string): ReactNode {
  return renderFormattedSegments(text, "player-text");
}

function applyMarkerToSelection(
  element: EditableTextElement | null,
  marker: "*" | "**",
  onChange: (value: string) => void,
) {
  if (!element) return;

  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? element.value.length;
  const selectedText = element.value.slice(start, end);
  const before = element.value.slice(0, start);
  const after = element.value.slice(end);
  const nextValue = `${before}${marker}${selectedText}${marker}${after}`;

  onChange(nextValue);

  requestAnimationFrame(() => {
    const cursorStart = start + marker.length;
    const cursorEnd = cursorStart + selectedText.length;
    element.focus();
    element.setSelectionRange(cursorStart, cursorEnd);
  });
}

interface PlayerTextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  list?: string;
  children?: ReactNode;
}

export function PlayerTextInput({
  label,
  value,
  onChange,
  disabled = false,
  multiline = false,
  rows = 3,
  placeholder,
  list,
  children,
}: PlayerTextInputProps) {
  const inputRef = useRef<EditableTextElement | null>(null);

  return (
    <label>
      <div className="section-title-row" style={{ marginBottom: 6 }}>
        <span>{label}</span>
        <div className="row-inline" style={{ gap: 6 }}>
          <button
            type="button"
            className="button-secondary button-small"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyMarkerToSelection(inputRef.current, "**", onChange)}
            disabled={disabled}
            title="Mettre en gras"
          >
            B
          </button>
          <button
            type="button"
            className="button-secondary button-small"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyMarkerToSelection(inputRef.current, "*", onChange)}
            disabled={disabled}
            title="Mettre en italique"
          >
            I
          </button>
        </div>
      </div>
      {multiline ? (
        <textarea
          ref={(element) => {
            inputRef.current = element;
          }}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      ) : (
        <input
          ref={(element) => {
            inputRef.current = element;
          }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          list={list}
        />
      )}
      {children}
    </label>
  );
}

interface FormattedPlayerTextProps {
  text: string;
  className?: string;
  as?: FormattedPlayerTextTag;
}

export function FormattedPlayerText({
  text,
  className,
  as = "span",
}: FormattedPlayerTextProps) {
  const Tag = as;
  return <Tag className={className}>{formatPlayerText(text)}</Tag>;
}
