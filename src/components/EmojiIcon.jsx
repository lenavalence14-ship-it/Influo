import balloon from '../assets/emoji/balloon_flat.svg'
import birthdayCake from '../assets/emoji/birthday_cake_flat.svg'
import boy from '../assets/emoji/boy_flat_default.svg'
import christmasTree from '../assets/emoji/christmas_tree_flat.svg'
import confettiBall from '../assets/emoji/confetti_ball_flat.svg'
import crescentMoon from '../assets/emoji/crescent_moon_flat.svg'
import egg from '../assets/emoji/egg_flat.svg'
import envelope from '../assets/emoji/envelope_flat.svg'
import fireworks from '../assets/emoji/fireworks_flat.svg'
import flexedBiceps from '../assets/emoji/flexed_biceps_flat_default.svg'
import girl from '../assets/emoji/girl_flat_default.svg'
import growingHeart from '../assets/emoji/growing_heart_flat.svg'
import handshake from '../assets/emoji/handshake_flat.svg'
import man from '../assets/emoji/man_flat_default.svg'
import manTeacher from '../assets/emoji/man_teacher_flat_default.svg'
import memo from '../assets/emoji/memo_flat.svg'
import mosque from '../assets/emoji/mosque_flat.svg'
import officeWorker from '../assets/emoji/office_worker_flat_default.svg'
import partyPopper from '../assets/emoji/party_popper_flat.svg'
import prince from '../assets/emoji/prince_flat_default.svg'
import princess from '../assets/emoji/princess_flat_default.svg'
import rabbitFace from '../assets/emoji/rabbit_face_flat.svg'
import raisingHands from '../assets/emoji/raising_hands_flat_default.svg'
import revolvingHearts from '../assets/emoji/revolving_hearts_flat.svg'
import santaClaus from '../assets/emoji/santa_claus_flat_default.svg'
import sparkles from '../assets/emoji/sparkles_flat.svg'
import sparklingHeart from '../assets/emoji/sparkling_heart_flat.svg'
import starStruck from '../assets/emoji/star-struck_flat.svg'
import star from '../assets/emoji/star_flat.svg'
import trophy from '../assets/emoji/trophy_flat.svg'
import woman from '../assets/emoji/woman_flat_default.svg'
import womanTeacher from '../assets/emoji/woman_teacher_flat_default.svg'

// Emoji "Fluent Emoji" (Microsoft, licence MIT, style Flat) embarqués en SVG
// dans le projet -- rendu identique sur toutes les plateformes (contrairement
// aux emoji Unicode natifs qui varient Android/iOS/Samsung), et net/épuré,
// dans l'esprit demandé ("pro, flat, comme sur iPhone" sans utiliser les
// assets Apple, non redistribuables). Utilisé uniquement pour les boutons de
// l'outil "Souvenirs" -- le reste de l'app garde le rendu emoji natif.
const EMOJI_MAP = {
  balloon,
  birthdayCake,
  boy,
  christmasTree,
  confettiBall,
  crescentMoon,
  egg,
  envelope,
  fireworks,
  flexedBiceps,
  girl,
  growingHeart,
  handshake,
  man,
  manTeacher,
  memo,
  mosque,
  officeWorker,
  partyPopper,
  prince,
  princess,
  rabbitFace,
  raisingHands,
  revolvingHearts,
  santaClaus,
  sparkles,
  sparklingHeart,
  starStruck,
  star,
  trophy,
  woman,
  womanTeacher,
}

export default function EmojiIcon({ name, size = 28, className = '', style = {} }) {
  const src = EMOJI_MAP[name]
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', userSelect: 'none', ...style }}
    />
  )
}

// Petit cluster de 2-3 icônes superposées, pour composer visuellement les
// emoji qui n'existent pas en un seul symbole Fluent (famille, couple avec
// cœur) plutôt que d'utiliser un rendu Unicode natif incohérent avec le
// reste des boutons.
export function EmojiCluster({ names, size = 28, className = '' }) {
  const iconSize = Math.round(size * 0.62)
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {names.map((name, i) => {
        const offset = (i - (names.length - 1) / 2) * (iconSize * 0.42)
        return (
          <EmojiIcon
            key={name + i}
            name={name}
            size={iconSize}
            className="absolute top-1/2"
            style={{ left: `calc(50% + ${offset}px)`, transform: 'translate(-50%, -50%)' }}
          />
        )
      })}
    </div>
  )
}
