import { ChangeEvent } from "react";

import { DEFAULT_BUST_CONFIG, BustConfig } from "@/lib/story";

interface AuthorStudioBustEditorProps {
  bust: BustConfig | undefined;
  canEdit: boolean;
  assetPreviewSrcById: Record<string, string>;
  onRegisterAsset: (file: File) => string;
  onEnsureAssetPreviewSrc: (assetId: string) => Promise<string | null>;
  onChange: (bust: BustConfig) => void;
}

export function AuthorStudioBustEditor({
  bust,
  canEdit,
  assetPreviewSrcById,
  onRegisterAsset,
  onEnsureAssetPreviewSrc,
  onChange,
}: AuthorStudioBustEditorProps) {
  const value = bust ?? DEFAULT_BUST_CONFIG;
  const previewSrc = value.assetId ? assetPreviewSrcById[value.assetId] : null;

  const selectAsset = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const assetId = onRegisterAsset(file);
    onChange({ ...value, assetId });
    void onEnsureAssetPreviewSrc(assetId);
  };

  return (
    <div className="subsection bust-editor">
      <div className="section-title-row">
        <strong>Buste</strong>
        <button
          className="button-secondary"
          onClick={() => onChange({ ...value, assetId: null })}
          disabled={!canEdit || !value.assetId}
        >
          Retirer
        </button>
      </div>
      <label>
        Image du buste
        <input type="file" accept="image/*" onChange={selectAsset} disabled={!canEdit} />
      </label>
      {previewSrc && (
        <div
          className="bust-editor-preview"
          role="img"
          aria-label="Apercu du buste"
          style={{ backgroundImage: `url("${previewSrc}")` }}
        />
      )}
      <div className="grid-two">
        <label>
          Cote
          <select
            value={value.side}
            onChange={(event) => onChange({ ...value, side: event.target.value === "right" ? "right" : "left" })}
            disabled={!canEdit}
          >
            <option value="left">Gauche</option>
            <option value="right">Droite</option>
          </select>
        </label>
        <label>
          Largeur ({value.width}%)
          <input
            type="range"
            min={20}
            max={70}
            value={value.width}
            onChange={(event) => onChange({ ...value, width: Number(event.target.value) })}
            disabled={!canEdit}
          />
        </label>
      </div>
      <small>Le bas du buste restera automatiquement colle au-dessus de la barre de texte.</small>
    </div>
  );
}
