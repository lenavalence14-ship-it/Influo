import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva'
import useImage from 'use-image'
import {
  ArrowLeft, Type, Image as ImageIcon, Square, Circle as CircleIcon,
  Trash2, Copy, Lock, Unlock, Eye, EyeOff, ChevronUp, ChevronDown, Save,
} from 'lucide-react'

/**
 * TemplateEditor — mode "édition libre" pour l'administrateur.
 *
 * L'admin construit un template à partir d'un canvas vide : il ajoute des
 * calques (texte / image / forme), les positionne, les redimensionne, les
 * fait pivoter, gère l'ordre d'affichage (z-index), et pour chacun définit
 * les règles de personnalisation que l'utilisateur final pourra utiliser
 * (texte modifiable, image remplaçable, déplacement/redimensionnement
 * autorisés, etc.).
 *
 * ÉTAPE ACTUELLE : UI + état local uniquement (données mock). La
 * persistance vers `templates` + `template_layers` (Supabase) est la
 * prochaine étape, une fois cette UI validée.
 *
 * Le canvas de rendu utilise Konva (via react-konva) plutôt que des divs
 * en position absolute : plus proche d'un vrai outil type Canva, meilleure
 * gestion native du drag/resize/rotate/z-index via Transformer.
 */

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1350 // ratio 4:5, cohérent avec les vignettes de TemplateLibrary

let idCounter = 1
const nextId = () => `layer_${idCounter++}`

function makeDefaultLayer(type, overrides = {}) {
  const base = {
    id: nextId(),
    type, // 'texte' | 'photo' | 'forme'
    x: CANVAS_WIDTH / 2 - 150,
    y: CANVAS_HEIGHT / 2 - 40,
    width: 300,
    height: 80,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    ordre: 0,
    // permissions utilisateur final
    user_editable: true,
    user_can_move: false,
    user_can_resize: false,
  }

  if (type === 'texte') {
    return {
      ...base,
      contenu: 'Votre texte ici',
      font_family: 'Inter',
      font_size_base: 32,
      color: '#111111',
      text_align: 'center',
      font_weight: 'normal',
      font_style: 'normal',
      // contraintes texte
      min_length: 0,
      max_length: 120,
      max_lines: 3,
      font_locked: true,
      size_locked: true,
      ...overrides,
    }
  }
  if (type === 'photo') {
    return {
      ...base,
      width: 300,
      height: 300,
      image_url: null,
      // contraintes photo
      min_zoom: 1,
      max_zoom: 3,
      ratio_locked: false,
      ...overrides,
    }
  }
  // forme
  return {
    ...base,
    shape_type: 'rectangle', // 'rectangle' | 'ellipse'
    fill_color: '#3b82f6',
    border_color: 'transparent',
    border_width: 0,
    ...overrides,
  }
}

export default function TemplateEditor() {
  const navigate = useNavigate()
  const [categorie, setCategorie] = useState('bonne-fete-nouvelle-annee')
  const [layers, setLayers] = useState(() => [
    makeDefaultLayer('forme', {
      x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
      fill_color: '#f5e6d3', locked: true, user_editable: false, ordre: 0,
    }),
    makeDefaultLayer('texte', {
      x: 140, y: 120, width: 800, height: 100,
      contenu: 'Bonne Année 2027', font_size_base: 64, text_align: 'center',
      font_weight: 'bold', ordre: 1,
    }),
  ])
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)

  const selectedLayer = layers.find((l) => l.id === selectedId) || null

  const updateLayer = useCallback((id, patch) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  const addLayer = (type) => {
    const maxOrdre = layers.reduce((m, l) => Math.max(m, l.ordre), -1)
    const layer = makeDefaultLayer(type, { ordre: maxOrdre + 1 })
    setLayers((ls) => [...ls, layer])
    setSelectedId(layer.id)
  }

  const deleteLayer = (id) => {
    setLayers((ls) => ls.filter((l) => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const duplicateLayer = (id) => {
    const src = layers.find((l) => l.id === id)
    if (!src) return
    const maxOrdre = layers.reduce((m, l) => Math.max(m, l.ordre), -1)
    const copy = { ...src, id: nextId(), x: src.x + 20, y: src.y + 20, ordre: maxOrdre + 1 }
    setLayers((ls) => [...ls, copy])
    setSelectedId(copy.id)
  }

  const moveLayerZ = (id, direction) => {
    setLayers((ls) => {
      const sorted = [...ls].sort((a, b) => a.ordre - b.ordre)
      const idx = sorted.findIndex((l) => l.id === id)
      const swapIdx = direction === 'up' ? idx + 1 : idx - 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return ls
      const tmp = sorted[idx].ordre
      sorted[idx].ordre = sorted[swapIdx].ordre
      sorted[swapIdx].ordre = tmp
      return [...sorted]
    })
  }

  const handleSave = async () => {
    setSaving(true)
    // TODO (prochaine étape) : upload image de fond si besoin vers Storage,
    // puis insert dans `templates` (id, categorie, image_url thumbnail,
    // ordre) et insert batch dans `template_layers` avec toutes les
    // colonnes de contraintes. Nécessite d'abord la migration DB (voir
    // discussion) pour ajouter rotation/opacity/locked/hidden/permissions.
    console.log('SAVE PAYLOAD', { categorie, layers })
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    alert('Mock : payload loggé dans la console. Pas encore connecté à Supabase.')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <button onClick={() => navigate(-1)} aria-label="Retour" className="w-9 h-9 rounded-full flex items-center justify-center glass">
          <ArrowLeft size={18} />
        </button>
        <input
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          placeholder="slug-categorie"
          className="flex-1 bg-transparent outline-none text-body-medium glass rounded-full px-3 py-1.5"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-body-medium shrink-0"
          style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}
        >
          <Save size={15} />
          {saving ? 'Sauvegarde…' : 'Enregistrer'}
        </button>
      </header>

      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto shrink-0 border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <ToolButton icon={Type} label="Texte" onClick={() => addLayer('texte')} />
        <ToolButton icon={ImageIcon} label="Photo" onClick={() => addLayer('photo')} />
        <ToolButton icon={Square} label="Forme" onClick={() => addLayer('forme')} />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto flex items-start justify-center p-6" style={{ backgroundColor: 'var(--bg-elevated, #1a1a1a)' }}>
          <CanvasArea
            layers={layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={updateLayer}
          />
        </div>

        <aside className="w-72 shrink-0 border-l overflow-y-auto" style={{ borderColor: 'var(--glass-border)' }}>
          <LayersPanel
            layers={layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={deleteLayer}
            onDuplicate={duplicateLayer}
            onMoveZ={moveLayerZ}
            onToggle={(id, field) => updateLayer(id, { [field]: !layers.find((l) => l.id === id)[field] })}
          />
          {selectedLayer && (
            <PropertiesPanel layer={selectedLayer} onChange={(patch) => updateLayer(selectedLayer.id, patch)} />
          )}
        </aside>
      </div>
    </div>
  )
}

function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption glass shrink-0">
      <Icon size={14} />
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------
// Canvas (Konva)
// ---------------------------------------------------------------------

function CanvasArea({ layers, selectedId, onSelect, onChange }) {
  const stageRef = useRef(null)
  const trRef = useRef(null)
  const scale = 0.4 // affichage réduit ; les coordonnées stockées restent en résolution pleine (CANVAS_WIDTH/HEIGHT)

  useEffect(() => {
    if (!trRef.current) return
    const stage = stageRef.current
    if (!selectedId) {
      trRef.current.nodes([])
      trRef.current.getLayer()?.batchDraw()
      return
    }
    const node = stage.findOne(`#${selectedId}`)
    trRef.current.nodes(node ? [node] : [])
    trRef.current.getLayer()?.batchDraw()
  }, [selectedId, layers.length])

  const sorted = [...layers].sort((a, b) => a.ordre - b.ordre)

  return (
    <Stage
      ref={stageRef}
      width={CANVAS_WIDTH * scale}
      height={CANVAS_HEIGHT * scale}
      scaleX={scale}
      scaleY={scale}
      className="rounded-lg shadow-2xl"
      style={{ backgroundColor: '#ffffff' }}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onSelect(null)
      }}
    >
      <Layer>
        {sorted.map((layer) => {
          if (layer.hidden) return null
          return (
            <LayerNode
              key={layer.id}
              layer={layer}
              isSelected={layer.id === selectedId}
              onSelect={() => !layer.locked && onSelect(layer.id)}
              onChange={(patch) => onChange(layer.id, patch)}
            />
          )
        })}
        <Transformer
          ref={trRef}
          rotateEnabled
          borderStroke="#3b82f6"
          anchorStroke="#3b82f6"
          anchorFill="#ffffff"
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
        />
      </Layer>
    </Stage>
  )
}

function LayerNode({ layer, isSelected, onSelect, onChange }) {
  const shapeRef = useRef(null)

  const commonProps = {
    id: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    opacity: layer.opacity,
    draggable: !layer.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: () => {
      const node = shapeRef.current
      if (!node) return
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)
      onChange({
        x: node.x(),
        y: node.y(),
        width: Math.max(10, node.width() * scaleX),
        height: Math.max(10, node.height() * scaleY),
        rotation: node.rotation(),
      })
    },
  }

  if (layer.type === 'texte') {
    return (
      <Text
        ref={shapeRef}
        {...commonProps}
        width={layer.width}
        height={layer.height}
        text={layer.contenu}
        fontSize={layer.font_size_base}
        fontFamily={layer.font_family}
        fill={layer.color}
        align={layer.text_align}
        fontStyle={`${layer.font_style === 'italic' ? 'italic ' : ''}${layer.font_weight === 'bold' ? 'bold' : ''}`.trim() || 'normal'}
      />
    )
  }

  if (layer.type === 'photo') {
    return <PhotoLayerNode ref={shapeRef} layer={layer} commonProps={commonProps} />
  }

  // forme
  return (
    <Rect
      ref={shapeRef}
      {...commonProps}
      width={layer.width}
      height={layer.height}
      fill={layer.fill_color}
      stroke={layer.border_color}
      strokeWidth={layer.border_width}
      cornerRadius={layer.shape_type === 'ellipse' ? Math.min(layer.width, layer.height) / 2 : 0}
    />
  )
}

function PhotoLayerNode({ layer, commonProps, ref }) {
  const [img] = useImage(layer.image_url || undefined, 'anonymous')
  if (img) {
    return <KonvaImage ref={ref} {...commonProps} width={layer.width} height={layer.height} image={img} />
  }
  // placeholder tant qu'aucune image n'est assignée
  return (
    <Rect
      ref={ref}
      {...commonProps}
      width={layer.width}
      height={layer.height}
      fill="#d4d4d8"
      stroke="#a1a1aa"
      strokeWidth={2}
      dash={[10, 6]}
    />
  )
}

// ---------------------------------------------------------------------
// Panneau des calques
// ---------------------------------------------------------------------

function LayersPanel({ layers, selectedId, onSelect, onDelete, onDuplicate, onMoveZ, onToggle }) {
  const sorted = [...layers].sort((a, b) => b.ordre - a.ordre) // plus haut ordre = plus haut dans la liste (au-dessus visuellement)

  return (
    <div className="p-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
      <p className="text-caption mb-2" style={{ color: 'var(--text-secondary)' }}>Calques ({layers.length})</p>
      <div className="space-y-1.5">
        {sorted.map((layer) => (
          <div
            key={layer.id}
            onClick={() => onSelect(layer.id)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer text-caption"
            style={{
              backgroundColor: layer.id === selectedId ? 'var(--glass-bg)' : 'transparent',
              border: layer.id === selectedId ? '1px solid var(--glass-border)' : '1px solid transparent',
              opacity: layer.hidden ? 0.4 : 1,
            }}
          >
            <span className="flex-1 truncate">
              {layer.type === 'texte' ? '📝' : layer.type === 'photo' ? '🖼️' : '⬜'} {layer.type}
              {layer.type === 'texte' && layer.contenu ? ` — ${layer.contenu.slice(0, 12)}` : ''}
            </span>
            <IconBtn icon={ChevronUp} onClick={(e) => { e.stopPropagation(); onMoveZ(layer.id, 'up') }} />
            <IconBtn icon={ChevronDown} onClick={(e) => { e.stopPropagation(); onMoveZ(layer.id, 'down') }} />
            <IconBtn icon={layer.locked ? Lock : Unlock} onClick={(e) => { e.stopPropagation(); onToggle(layer.id, 'locked') }} />
            <IconBtn icon={layer.hidden ? EyeOff : Eye} onClick={(e) => { e.stopPropagation(); onToggle(layer.id, 'hidden') }} />
            <IconBtn icon={Copy} onClick={(e) => { e.stopPropagation(); onDuplicate(layer.id) }} />
            <IconBtn icon={Trash2} onClick={(e) => { e.stopPropagation(); onDelete(layer.id) }} />
          </div>
        ))}
        {layers.length === 0 && (
          <p className="text-caption text-center py-4" style={{ color: 'var(--text-secondary)' }}>
            Aucun calque. Ajoutez-en un ci-dessus.
          </p>
        )}
      </div>
    </div>
  )
}

function IconBtn({ icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className="w-6 h-6 rounded flex items-center justify-center shrink-0 hover:bg-white/10">
      <Icon size={12} />
    </button>
  )
}

// ---------------------------------------------------------------------
// Panneau propriétés (par type de calque + permissions utilisateur)
// ---------------------------------------------------------------------

function PropertiesPanel({ layer, onChange }) {
  return (
    <div className="p-3 space-y-4">
      <Section title="Position & taille">
        <Row label="X"><NumberInput value={layer.x} onChange={(v) => onChange({ x: v })} /></Row>
        <Row label="Y"><NumberInput value={layer.y} onChange={(v) => onChange({ y: v })} /></Row>
        <Row label="Largeur"><NumberInput value={layer.width} onChange={(v) => onChange({ width: v })} /></Row>
        <Row label="Hauteur"><NumberInput value={layer.height} onChange={(v) => onChange({ height: v })} /></Row>
        <Row label="Rotation"><NumberInput value={layer.rotation} onChange={(v) => onChange({ rotation: v })} /></Row>
        <Row label="Opacité">
          <input type="range" min="0" max="1" step="0.05" value={layer.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="w-full" />
        </Row>
      </Section>

      {layer.type === 'texte' && (
        <Section title="Texte">
          <textarea
            value={layer.contenu}
            onChange={(e) => onChange({ contenu: e.target.value })}
            className="w-full glass rounded-lg px-2 py-1.5 text-caption resize-none"
            rows={2}
          />
          <Row label="Police">
            <input value={layer.font_family} onChange={(e) => onChange({ font_family: e.target.value })} className="w-full glass rounded-lg px-2 py-1 text-caption" />
          </Row>
          <Row label="Taille"><NumberInput value={layer.font_size_base} onChange={(v) => onChange({ font_size_base: v })} /></Row>
          <Row label="Couleur">
            <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value })} className="w-full h-7 rounded" />
          </Row>
          <Row label="Alignement">
            <select value={layer.text_align} onChange={(e) => onChange({ text_align: e.target.value })} className="w-full glass rounded-lg px-2 py-1 text-caption">
              <option value="left">Gauche</option>
              <option value="center">Centre</option>
              <option value="right">Droite</option>
            </select>
          </Row>
          <Row label="Gras">
            <Toggle checked={layer.font_weight === 'bold'} onChange={(v) => onChange({ font_weight: v ? 'bold' : 'normal' })} />
          </Row>
        </Section>
      )}

      {layer.type === 'photo' && (
        <Section title="Photo">
          <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            {layer.image_url ? 'Image assignée' : 'Aucune image — sera un cadre vide à remplir par l\'utilisateur si autorisé'}
          </p>
          <input
            type="text"
            placeholder="URL image (mock)"
            value={layer.image_url || ''}
            onChange={(e) => onChange({ image_url: e.target.value || null })}
            className="w-full glass rounded-lg px-2 py-1 text-caption"
          />
        </Section>
      )}

      {layer.type === 'forme' && (
        <Section title="Forme">
          <Row label="Type">
            <select value={layer.shape_type} onChange={(e) => onChange({ shape_type: e.target.value })} className="w-full glass rounded-lg px-2 py-1 text-caption">
              <option value="rectangle">Rectangle</option>
              <option value="ellipse">Ellipse</option>
            </select>
          </Row>
          <Row label="Couleur">
            <input type="color" value={layer.fill_color} onChange={(e) => onChange({ fill_color: e.target.value })} className="w-full h-7 rounded" />
          </Row>
          <Row label="Bordure (px)"><NumberInput value={layer.border_width} onChange={(v) => onChange({ border_width: v })} /></Row>
        </Section>
      )}

      <Section title="Permissions utilisateur final">
        <Row label="Modifiable">
          <Toggle checked={layer.user_editable} onChange={(v) => onChange({ user_editable: v })} />
        </Row>
        {layer.user_editable && (
          <>
            <Row label="Déplacement autorisé">
              <Toggle checked={layer.user_can_move} onChange={(v) => onChange({ user_can_move: v })} />
            </Row>
            <Row label="Redimensionnement autorisé">
              <Toggle checked={layer.user_can_resize} onChange={(v) => onChange({ user_can_resize: v })} />
            </Row>

            {layer.type === 'texte' && (
              <>
                <Row label="Longueur min"><NumberInput value={layer.min_length} onChange={(v) => onChange({ min_length: v })} /></Row>
                <Row label="Longueur max"><NumberInput value={layer.max_length} onChange={(v) => onChange({ max_length: v })} /></Row>
                <Row label="Nb lignes max"><NumberInput value={layer.max_lines} onChange={(v) => onChange({ max_lines: v })} /></Row>
                <Row label="Police verrouillée">
                  <Toggle checked={layer.font_locked} onChange={(v) => onChange({ font_locked: v })} />
                </Row>
                <Row label="Taille verrouillée">
                  <Toggle checked={layer.size_locked} onChange={(v) => onChange({ size_locked: v })} />
                </Row>
              </>
            )}

            {layer.type === 'photo' && (
              <>
                <Row label="Zoom min"><NumberInput value={layer.min_zoom} step={0.1} onChange={(v) => onChange({ min_zoom: v })} /></Row>
                <Row label="Zoom max"><NumberInput value={layer.max_zoom} step={0.1} onChange={(v) => onChange({ max_zoom: v })} /></Row>
                <Row label="Ratio obligatoire">
                  <Toggle checked={layer.ratio_locked} onChange={(v) => onChange({ ratio_locked: v })} />
                </Row>
              </>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-1.5 pb-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
      <p className="text-caption font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-caption w-28 shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function NumberInput({ value, onChange, step = 1 }) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full glass rounded-lg px-2 py-1 text-caption"
    />
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-9 h-5 rounded-full relative transition-colors"
      style={{ backgroundColor: checked ? '#3b82f6' : 'var(--glass-border)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}
