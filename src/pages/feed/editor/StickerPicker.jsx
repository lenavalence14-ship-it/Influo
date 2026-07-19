const STICKERS = [
  '😀', '😂', '🥰', '😎', '🔥', '💯', '✨', '🎉', '❤️', '💜',
  '👍', '🙌', '💪', '🙏', '😍', '🥳', '😜', '🤩', '😇', '🫶',
  '🌟', '⚡', '🌈', '☀️', '🌙', '⭐', '💫', '🎶', '📸', '🎬',
]

export default function StickerPicker({ onPick }) {
  return (
    <div className="grid grid-cols-6 gap-3 px-4 pb-4 pt-2 max-h-[220px] overflow-y-auto">
      {STICKERS.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="text-3xl aspect-square flex items-center justify-center rounded-xl active:scale-90 transition-transform duration-150"
        >
          {s}
        </button>
      ))}
    </div>
  )
}
