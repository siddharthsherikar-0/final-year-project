import { useRef, useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorWorkingScene } from '@/editor/editorRuntime';
import {
  inspectMaterials,
  populatedTextureLabels,
  type InspectedMaterialSlot,
} from '@/editor/materialInspection';
import {
  assignMaterialAction,
  clearTextureAction,
  createMaterialAction,
  duplicateMaterialAction,
  importTextureAction,
  renameMaterialAction,
  resetMaterialAction,
  resolveLibraryMaterial,
  setMaterialColorAction,
  setMaterialEmissiveColorAction,
  setMaterialEmissiveIntensityAction,
  setMaterialMetalnessAction,
  setMaterialOpacityAction,
  setMaterialRoughnessAction,
  setMaterialTransparencyAction,
} from '@/editor/editorCommands';
import { MAX_EMISSIVE_INTENSITY, type TextureSlotKey } from '@/editor/materials';
import { sceneMaterialNames } from '@/editor/materialOperations';
import { TEXTURE_ACCEPT_ATTRIBUTE } from '@/editor/textureLibrary';
import type { Mesh } from 'three';
import { EditorSection, ToolbarButton } from './EditorPrimitives';
import { ColorField, MetaRow, ToggleSwitch, UnitSliderField } from './MaterialPrimitives';

/**
 * Contextual Material section.
 *
 * Values are DERIVED from the live three.js material on every render, keyed on
 * `materialEpoch` (bumped by every material command). There is no mirrored copy
 * in state, so a committed edit cannot leave the panel showing a stale value -
 * the same derivation discipline `TransformInspector` uses for transforms.
 *
 * Writes go through the command layer, which owns copy-on-write: with the
 * default "Edit Selected" posture, changing a colour on a mesh whose material
 * is shared clones the material for that slot and leaves every other user
 * untouched. The "Shared" toggle makes that deliberate instead of implicit.
 */

function MaterialSection() {
  const primaryId = useEditorStore((s) => s.selectedIds[0] ?? null);
  const activeSlot = useEditorStore((s) => s.activeMaterialSlot);
  const setActiveSlot = useEditorStore((s) => s.setActiveMaterialSlot);
  const sharedEditing = useEditorStore((s) => s.sharedMaterialEditing);
  const setSharedEditing = useEditorStore((s) => s.setSharedMaterialEditing);
  // Signals that a material changed outside React, and must gate the read.
  const materialEpoch = useEditorStore((s) => s.materialEpoch);

  const snapshot = (() => {
    const working = getEditorWorkingScene();
    const mesh = working?.resolve(primaryId) as Mesh | null | undefined;
    return inspectMaterials(working, mesh, activeSlot);
  })();
  void materialEpoch;

  if (!primaryId || !snapshot || snapshot.slotCount === 0) return null;

  const slot = snapshot.slots.find((entry) => entry.index === snapshot.activeSlot) ?? null;
  if (!slot) return null;

  const capabilities = slot.capabilities;
  const sharedUsers = Math.max(slot.userCount - 1, 0);
  const textureLabels = populatedTextureLabels(slot);

  return (
    <div data-testid="material-section">
      {snapshot.multiMaterial ? (
        <SlotPicker
          slots={snapshot.slots}
          activeSlot={snapshot.activeSlot}
          onSelect={setActiveSlot}
        />
      ) : null}

      <EditorSection title="Material">
        {!capabilities.editable ? (
          <p className="text-[11px] leading-relaxed text-ink-faint" data-testid="material-unsupported">
            {capabilities.reason ?? 'This material cannot be edited.'}
          </p>
        ) : null}

        <div className="mt-2 space-y-0.5" data-testid="material-meta">
          <MetaRow label="Name">{slot.name || 'Unnamed material'}</MetaRow>
          <MetaRow label="Type">{capabilities.type}</MetaRow>
          <MetaRow label="Slots">
            {snapshot.multiMaterial ? `${slot.index + 1} of ${snapshot.slotCount}` : 'Single'}
          </MetaRow>
          <MetaRow label="Textures">
            {textureLabels.length === 0 ? 'None' : textureLabels.join(', ')}
          </MetaRow>
          <MetaRow label="Ownership">
            {slot.editorOwned ? 'Editor-owned' : 'Shared from source'}
          </MetaRow>
        </div>

        {capabilities.editable ? (
          <SharedToggle
            shared={sharedEditing}
            sharedUsers={sharedUsers}
            onChange={setSharedEditing}
          />
        ) : null}
      </EditorSection>

      {capabilities.editable && capabilities.color ? (
        <EditorSection title="Base Color">
          <div className="flex flex-wrap gap-2">
            <ColorField
              key={`color-${slot.index}`}
              label="Color"
              value={slot.color}
              testId="material-color"
              onCommit={(hex) => setMaterialColorAction(primaryId, slot.index, hex)}
            />
          </div>
        </EditorSection>
      ) : null}

      {capabilities.editable && (capabilities.roughness || capabilities.metalness) ? (
        <EditorSection title="Surface">
          <div className="flex flex-wrap gap-3">
            {capabilities.roughness ? (
              <UnitSliderField
                label="Roughness"
                value={slot.roughness}
                testId="material-roughness"
                onCommit={(next) => setMaterialRoughnessAction(primaryId, slot.index, next)}
              />
            ) : null}
            {capabilities.metalness ? (
              <UnitSliderField
                label="Metalness"
                value={slot.metalness}
                testId="material-metalness"
                onCommit={(next) => setMaterialMetalnessAction(primaryId, slot.index, next)}
              />
            ) : null}
          </div>
        </EditorSection>
      ) : null}

      {capabilities.editable && capabilities.opacity ? (
        <EditorSection title="Transparency">
          <div className="flex flex-wrap items-center gap-3">
            <UnitSliderField
              label="Opacity"
              value={slot.opacity}
              testId="material-opacity"
              onCommit={(next) => setMaterialOpacityAction(primaryId, slot.index, next)}
            />
            <ToggleSwitch
              label="Transparent"
              checked={slot.transparent}
              testId="material-transparent"
              onChange={(next) => setMaterialTransparencyAction(primaryId, slot.index, next)}
            />
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
            {slot.transparent
              ? 'Blending is on. Depth writing is disabled so the surface does not z-fight.'
              : 'Opaque. Lower the opacity to blend; three.js ignores opacity until transparency is on.'}
          </p>
        </EditorSection>
      ) : null}

      {capabilities.editable && capabilities.emissive ? (
        <EditorSection title="Emissive">
          <div className="flex flex-wrap gap-2">
            <ColorField
              key={`emissive-${slot.index}`}
              label="Emissive"
              value={slot.emissive}
              testId="material-emissive"
              onCommit={(hex) => setMaterialEmissiveColorAction(primaryId, slot.index, hex)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <UnitSliderField
              label="Intensity"
              value={slot.emissiveIntensity}
              max={MAX_EMISSIVE_INTENSITY}
              step={0.05}
              testId="material-emissive-intensity"
              format={(value) => String(Math.round(value * 100) / 100)}
              onCommit={(next) =>
                setMaterialEmissiveIntensityAction(primaryId, slot.index, next)
              }
            />
          </div>
        </EditorSection>
      ) : null}

      {capabilities.editable && capabilities.textures ? (
        <TextureSlots
          slot={slot}
          objectId={primaryId}
          disabledReason={undefined}
        />
      ) : null}

      {capabilities.editable ? (
        <MaterialLibrary
          slot={slot}
          objectId={primaryId}
          currentName={slot.name}
        />
      ) : null}
    </div>
  );
}

/**
 * Material library: rename, create, and assign.
 *
 * The assign picker lists DISTINCT materials by name rather than every slot, so a
 * model built from shared materials does not present the same entry a dozen
 * times. Selection is an index into that list, and the command resolves it back
 * to a live material by identity, so a stale index after a scene change is a
 * safe miss rather than the wrong material.
 */
function MaterialLibrary({
  slot,
  objectId,
  currentName,
}: {
  slot: InspectedMaterialSlot;
  objectId: string;
  currentName: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [libraryIndex, setLibraryIndex] = useState('');

  const names: string[] = sceneMaterialNames(getEditorWorkingScene()!);

  return (
    <EditorSection title="Material Library">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-ink-faint">
          Material Name
        </span>
        <input
          type="text"
          value={draft ?? currentName}
          data-testid="material-rename"
          aria-label="Material name"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft === null) return;
            const next = draft;
            setDraft(null);
            if (next.trim() === currentName) return;
            renameMaterialAction(objectId, slot.index, next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
          className="min-w-0 rounded-md border border-control bg-canvas px-1.5 py-1 text-xs text-ink outline-none transition-colors focus:border-accent/60"
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ToolbarButton
          label="New Material"
          testId="material-new"
          title="Create an editor-owned PBR material and assign it to this slot"
          onClick={() => createMaterialAction(objectId, slot.index)}
        />
        <ToolbarButton
          label="Duplicate Mat"
          testId="material-duplicate"
          title="Copy this material so it can be edited independently"
          onClick={() => duplicateMaterialAction(objectId, slot.index)}
        />
        <ToolbarButton
          label="Reset"
          title="Restore this material to the values it started with"
          onClick={() => resetMaterialAction(objectId, slot.index)}
        />
      </div>

      {names.length > 0 ? (
        <div className="mt-2 flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-ink-faint">
            Assign Existing
          </span>
          <select
            value={libraryIndex}
            data-testid="material-assign"
            aria-label="Assign an existing material"
            onChange={(event) => {
              const index = Number(event.target.value);
              setLibraryIndex(event.target.value);
              if (!Number.isInteger(index) || index < 0) return;
              const material = resolveLibraryMaterial(index);
              if (material) assignMaterialAction(objectId, slot.index, material as Mesh['material']);
            }}
            className="min-w-0 rounded-md border border-control bg-canvas px-1.5 py-1 text-xs text-ink outline-none transition-colors focus:border-accent/60"
          >
            <option value="">Choose a material…</option>
            {names.map((name, index) => (
              <option key={`${name}-${index}`} value={String(index)}>
                {name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </EditorSection>
  );
}

/**
 * Slot picker for multi-material meshes.
 *
 * Rendered as a wrapping row of small buttons rather than a `<select>`: a select
 * popup cannot be styled to the studio palette reliably across platforms, and on
 * a 320px viewport a native dropdown overflows the inspector.
 */
function SlotPicker({
  slots,
  activeSlot,
  onSelect,
}: {
  slots: InspectedMaterialSlot[];
  activeSlot: number;
  onSelect: (slot: number) => void;
}) {
  return (
    <div data-testid="material-slots">
      <EditorSection title="Material Slots">
        <div className="flex flex-wrap gap-1.5">
          {slots.map((entry) => {
            const active = entry.index === activeSlot;
            return (
              <button
                key={entry.index}
                type="button"
                aria-pressed={active}
                aria-label={`Edit ${entry.label}`}
                title={entry.label}
                data-testid={`material-slot-${entry.index}`}
                onClick={() => onSelect(entry.index)}
                className={`inline-flex min-h-[26px] max-w-[9rem] items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors focus-ring ${
                  active
                    ? 'border-accent/60 bg-accent-subtle text-accent'
                    : 'border-control bg-elevated text-ink-muted hover:bg-interactive hover:text-ink'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-sm border border-line"
                  style={{ backgroundColor: entry.color ?? 'transparent' }}
                />
                <span className="min-w-0 truncate">{entry.label}</span>
              </button>
            );
          })}
        </div>
      </EditorSection>
    </div>
  );
}

/**
 * Copy-on-write posture switch.
 *
 * Only offered when the material genuinely is shared. With a single user the
 * two modes are identical, so showing a choice would imply a distinction that
 * does not exist.
 */
function SharedToggle({
  shared,
  sharedUsers,
  onChange,
}: {
  shared: boolean;
  sharedUsers: number;
  onChange: (next: boolean) => void;
}) {
  if (sharedUsers === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-line bg-canvas px-2 py-1.5">
      <ToggleSwitch
        label="Edit shared"
        checked={shared}
        testId="material-shared-toggle"
        disabledReason="This material is only used by the selected object"
        onChange={onChange}
      />
      <p className="mt-1 text-[10px] leading-relaxed text-ink-faint">
        {shared
          ? `Editing this material also affects ${sharedUsers} other slot${sharedUsers === 1 ? '' : 's'}.`
          : `This material is shared with ${sharedUsers} other slot${sharedUsers === 1 ? '' : 's'}. Edits copy it for this object only.`}
      </p>
    </div>
  );
}

/**
 * The six supported texture slots.
 *
 * Each row shows whether it is populated, the source file name, and the
 * dimensions when known - then offers Replace / Clear. Filenames are truncated
 * with a title attribute rather than allowed to overflow the inspector at 320px.
 *
 * The file input is visually hidden and driven by its own button so the picker
 * uses the OS dialog: the editor never assumes Electron or a filesystem path.
 */
function TextureSlots({
  slot,
  objectId,
  disabledReason,
}: {
  slot: InspectedMaterialSlot;
  objectId: string;
  disabledReason?: string;
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div data-testid="material-textures">
      <EditorSection title="Textures">
        <div className="space-y-1.5">
          {slot.textures.map((texture) => (
            <TextureSlotRow
              key={texture.key}
              objectId={objectId}
              slotIndex={slot.index}
              textureKey={texture.key}
              label={texture.label}
              hint={texture.hint}
              populated={texture.populated}
              fileName={texture.fileName}
              width={texture.width}
              height={texture.height}
              editorOwned={texture.editorOwned}
              colorSpace={texture.colorSpace}
              disabledReason={disabledReason}
              inputRef={(element) => {
                inputRefs.current[texture.key] = element;
              }}
              onBrowse={() => inputRefs.current[texture.key]?.click()}
            />
          ))}
        </div>
      </EditorSection>
    </div>
  );
}

function TextureSlotRow({
  objectId,
  slotIndex,
  textureKey,
  label,
  hint,
  populated,
  fileName,
  width,
  height,
  editorOwned,
  colorSpace,
  disabledReason,
  inputRef,
  onBrowse,
}: {
  objectId: string;
  slotIndex: number;
  textureKey: TextureSlotKey;
  label: string;
  hint: string;
  populated: boolean;
  fileName: string | null;
  width: number | null;
  height: number | null;
  editorOwned: boolean;
  colorSpace: 'srgb' | 'data';
  disabledReason?: string;
  inputRef: (element: HTMLInputElement | null) => void;
  onBrowse: () => void;
}) {
  const disabled = Boolean(disabledReason);

  return (
    <div
      className="rounded-md border border-line bg-canvas px-2 py-1.5"
      data-testid={`texture-row-${textureKey}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {label}
        </span>
        <span
          className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] ${
            populated ? 'text-success' : 'text-ink-faint'
          }`}
          data-testid={`texture-state-${textureKey}`}
        >
          {populated ? 'Set' : 'Empty'}
        </span>
      </div>

      {populated ? (
        <p
          className="mt-0.5 truncate text-[11px] text-ink-muted"
          title={fileName ?? undefined}
          data-testid={`texture-name-${textureKey}`}
        >
          {fileName ?? 'Embedded image'}
          {width && height ? (
            <span className="font-mono text-ink-faint">
              {' '}
              · {width}x{height}
            </span>
          ) : null}
          <span className="font-mono text-ink-faint">
            {' · '}
            {colorSpace === 'srgb' ? 'sRGB' : 'data'}
            {editorOwned ? ' · editor' : ''}
          </span>
        </p>
      ) : (
        <p className="mt-0.5 text-[10px] leading-relaxed text-ink-faint" title={hint}>
          {hint}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <ToolbarButton
          label={populated ? 'Replace' : 'Load'}
          disabled={disabled}
          title={disabledReason ?? `${populated ? 'Replace' : 'Load'} the ${label.toLowerCase()} texture`}
          onClick={onBrowse}
        />
        {populated ? (
          <ToolbarButton
            label="Clear"
            disabled={disabled}
            title={`Remove the ${label.toLowerCase()} texture`}
            onClick={() => clearTextureAction(objectId, slotIndex, textureKey)}
          />
        ) : null}
      </div>

      {/* Kept mounted and visually hidden: resetting `value` after each pick is
          what makes selecting the SAME file twice still fire a change event. */}
      <input
        ref={inputRef}
        type="file"
        accept={TEXTURE_ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={`texture-input-${textureKey}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset immediately so picking the same file again still fires.
          event.target.value = '';
          if (!file) return;
          // Async: the image is decoded before the material is touched. The
          // promise is intentionally not awaited in the handler - the command
          // reports through the status bar when it settles.
          void importTextureAction(objectId, slotIndex, textureKey, file);
        }}
      />
    </div>
  );
}

export { MaterialSection };