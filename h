[1mdiff --git a/src/pages/feed/Feed.jsx b/src/pages/feed/Feed.jsx[m
[1mindex 470a66a..f0ce325 100644[m
[1m--- a/src/pages/feed/Feed.jsx[m
[1m+++ b/src/pages/feed/Feed.jsx[m
[36m@@ -21,7 +21,22 @@[m [mconst PAGE_SIZE = 10[m
 // médias montés en même temps dans le DOM.[m
 async function fetchFeedPage({ userId, pageParam = 0 }) {[m
   const from = pageParam * PAGE_SIZE[m
[31m-  const to = from + PAGE_SIZE - 1[m
[32m+[m
[32m+[m[32m  // L'ordre du feed n'est PAS created_at brut : un repost fait remonter le post[m
[32m+[m[32m  // comme s'il venait d'être publié, sans jamais toucher à sa vraie date affichée.[m
[32m+[m[32m  // get_feed_post_ids calcule ça côté SQL (greatest(created_at, dernier repost))[m
[32m+[m[32m  // et pagine dessus directement -- indispensable pour que range() reste cohérent[m
[32m+[m[32m  // d'une page à l'autre (impossible de retrier fiablement après-coup en JS une[m
[32m+[m[32m  // fois que Supabase a déjà découpé les pages sur le mauvais critère de tri).[m
[32m+[m[32m  const { data: ordered, error: orderError } = await supabase.rpc('get_feed_post_ids', {[m
[32m+[m[32m    p_limit: PAGE_SIZE,[m
[32m+[m[32m    p_offset: from,[m
[32m+[m[32m  })[m
[32m+[m
[32m+[m[32m  if (orderError) console.error('Erreur tri feed:', orderError)[m
[32m+[m[32m  if (!ordered || ordered.length === 0) return { posts: [], nextPage: null }[m
[32m+[m
[32m+[m[32m  const orderedIds = ordered.map((o) => o.post_id)[m
 [m
   const { data, error } = await supabase[m
     .from('posts')[m
[36m@@ -32,35 +47,44 @@[m [masync function fetchFeedPage({ userId, pageParam = 0 }) {[m
       client:client_id(id, nom_complet, photo_url),[m
       commandes!posts_commande_id_fkey(lien_instagram, lien_tiktok)[m
     `)[m
[31m-    .in('type', ['photo', 'carrousel', 'video'])[m
[31m-    .order('created_at', { ascending: false })[m
[31m-    .range(from, to)[m
[32m+[m[32m    .in('id', orderedIds)[m
 [m
   if (error) console.error('Erreur chargement feed:', error)[m
   if (!data || data.length === 0) return { posts: [], nextPage: null }[m
 [m
   const postIds = data.map((p) => p.id)[m
[31m-  const [{ data: likes }, { data: comments }] = await Promise.all([[m
[32m+[m[32m  const [{ data: likes }, { data: comments }, { data: reposts }] = await Promise.all([[m
     supabase.from('post_likes').select('post_id, user_id, created_at, users(nom_complet)').in('post_id', postIds),[m
     supabase.from('post_comments').select('post_id').in('post_id', postIds),[m
[32m+[m[32m    supabase.from('post_reposts').select('post_id, user_id').in('post_id', postIds),[m
   ])[m
 [m
[31m-  const posts = data.map((p) => {[m
[31m-    const postLikes = likes?.filter((l) => l.post_id === p.id) || [][m
[31m-    // dernier like = created_at le plus récent, pour "Aimé par {nom} et d'autres personnes"[m
[31m-    const lastLike = postLikes.length[m
[31m-      ? postLikes.reduce((latest, l) => (new Date(l.created_at) > new Date(latest.created_at) ? l : latest))[m
[31m-      : null[m
[31m-    return {[m
[31m-      ...p,[m
[31m-      like_count: postLikes.length,[m
[31m-      liked_by_me: postLikes.some((l) => l.user_id === userId),[m
[31m-      comment_count: comments?.filter((c) => c.post_id === p.id).length || 0,[m
[31m-      last_liker_name: lastLike?.users?.nom_complet || null,[m
[31m-    }[m
[31m-  })[m
[32m+[m[32m  // supabase .in('id', orderedIds) ne garantit pas l'ordre de retour -- on[m
[32m+[m[32m  // remet les posts dans l'ordre exact décidé par get_feed_post_ids.[m
[32m+[m[32m  const byId = new Map(data.map((p) => [p.id, p]))[m
[32m+[m
[32m+[m[32m  const posts = orderedIds[m
[32m+[m[32m    .map((id) => byId.get(id))[m
[32m+[m[32m    .filter(Boolean)[m
[32m+[m[32m    .map((p) => {[m
[32m+[m[32m      const postLikes = likes?.filter((l) => l.post_id === p.id) || [][m
[32m+[m[32m      const postReposts = reposts?.filter((r) => r.post_id === p.id) || [][m
[32m+[m[32m      // dernier like = created_at le plus récent, pour "Aimé par {nom} et d'autres personnes"[m
[32m+[m[32m      const lastLike = postLikes.length[m
[32m+[m[32m        ? postLikes.reduce((latest, l) => (new Date(l.created_at) > new Date(latest.created_at) ? l : latest))[m
[32m+[m[32m        : null[m
[32m+[m[32m      return {[m
[32m+[m[32m        ...p,[m
[32m+[m[32m        like_count: postLikes.length,[m
[32m+[m[32m        liked_by_me: postLikes.some((l) => l.user_id === userId),[m
[32m+[m[32m        comment_count: comments?.filter((c) => c.post_id === p.id).length || 0,[m
[32m+[m[32m        last_liker_name: lastLike?.users?.nom_complet || null,[m
[32m+[m[32m        repost_count: postReposts.length,[m
[32m+[m[32m        reposted_by_me: postReposts.some((r) => r.user_id === userId),[m
[32m+[m[32m      }[m
[32m+[m[32m    })[m
 [m
[31m-  return { posts, nextPage: data.length === PAGE_SIZE ? pageParam + 1 : null }[m
[32m+[m[32m  return { posts, nextPage: ordered.length === PAGE_SIZE ? pageParam + 1 : null }[m
 }[m
 [m
 export default function Feed() {[m
[1mdiff --git a/src/pages/feed/Notifications.jsx b/src/pages/feed/Notifications.jsx[m
[1mindex 4f8f73e..e36ba35 100644[m
[1m--- a/src/pages/feed/Notifications.jsx[m
[1m+++ b/src/pages/feed/Notifications.jsx[m
[36m@@ -3,7 +3,7 @@[m [mimport { useQuery, useQueryClient } from '@tanstack/react-query'[m
 import { useNavigate } from 'react-router-dom'[m
 import { supabase } from '../../lib/supabase'[m
 import { useAuth } from '../../contexts/AuthContext'[m
[31m-import { Heart, MessageCircle, ShoppingBag, Wallet, ArrowLeft, UserPlus } from 'lucide-react'[m
[32m+[m[32mimport { Heart, MessageCircle, ShoppingBag, Wallet, ArrowLeft, UserPlus, Repeat2 } from 'lucide-react'[m
 import Avatar from '../../components/ui/Avatar'[m
 import Button from '../../components/ui/Button'[m
 import VerifiedBadge from '../../components/ui/VerifiedBadge'[m
[36m@@ -16,6 +16,7 @@[m [mconst POST_TYPES = [[m
   'like', 'comment', 'comment_collab',[m
   'nouveau_post', 'nouveau_reel', 'nouvelle_collab', 'nouveau_reel_collab',[m
   'reply', 'reply_content', 'comment_like',[m
[32m+[m[32m  'post_repost', 'repost_activity_like', 'repost_activity_comment', 'repost_activity_repost',[m
 ][m
 [m
 const TYPE_ICON = {[m
[36m@@ -30,6 +31,10 @@[m [mconst TYPE_ICON = {[m
   retrait: Wallet,[m
   retrait_pro: Wallet,[m
   follow: UserPlus,[m
[32m+[m[32m  post_repost: Repeat2,[m
[32m+[m[32m  repost_activity_like: Heart,[m
[32m+[m[32m  repost_activity_comment: MessageCircle,[m
[32m+[m[32m  repost_activity_repost: Repeat2,[m
 }[m
 [m
 // Libellé de secours si `contenu` (déjà formulé côté trigger SQL) est absent pour[m
[36m@@ -44,6 +49,10 @@[m [mconst TYPE_SUFFIX = {[m
   commande: 'a passé une nouvelle commande',[m
   commande_pro: 'a passé une nouvelle commande',[m
   follow: 'a commencé à vous suivre',[m
[32m+[m[32m  post_repost: 'a repartagé votre publication',[m
[32m+[m[32m  repost_activity_like: 'a aimé la publication que vous avez repartagée',[m
[32m+[m[32m  repost_activity_comment: 'a commenté la publication que vous avez repartagée',[m
[32m+[m[32m  repost_activity_repost: 'a repartagé la publication que vous avez repartagée',[m
 }[m
 [m
 const TABS = [[m
[1mdiff --git a/src/pages/feed/PostCard.jsx b/src/pages/feed/PostCard.jsx[m
[1mindex 4b4098f..5105ec3 100644[m
[1m--- a/src/pages/feed/PostCard.jsx[m
[1m+++ b/src/pages/feed/PostCard.jsx[m
[36m@@ -168,6 +168,8 @@[m [mfunction PostCard({ post, onDeleted, autoOpenComments = false, priority = false,[m
   // c'est le tout premier like du post).[m
   const [lastLikerName, setLastLikerName] = useState(post.last_liker_name || null)[m
   const [commentCount, setCommentCount] = useState(post.comment_count || 0)[m
[32m+[m[32m  const [reposted, setReposted] = useState(post.reposted_by_me || false)[m
[32m+[m[32m  const [repostCount, setRepostCount] = useState(post.repost_count || 0)[m
   const [showComments, setShowComments] = useState(autoOpenComments)[m
   const [showMenu, setShowMenu] = useState(false)[m
   const [deleted, setDeleted] = useState(false)[m
[36m@@ -224,6 +226,21 @@[m [mfunction PostCard({ post, onDeleted, autoOpenComments = false, priority = false,[m
     }[m
   }[m
 [m
[32m+[m[32m  const toggleRepost = async () => {[m
[32m+[m[32m    if (reposted) {[m
[32m+[m[32m      setReposted(false)[m
[32m+[m[32m      setRepostCount((c) => c - 1)[m
[32m+[m[32m      await supabase.from('post_reposts').delete().match({ post_id: post.id, user_id: user.id })[m
[32m+[m[32m    } else {[m
[32m+[m[32m      setReposted(true)[m
[32m+[m[32m      setRepostCount((c) => c + 1)[m
[32m+[m[32m      await supabase.from('post_reposts').insert({ post_id: post.id, user_id: user.id })[m
[32m+[m[32m      // Le repost fait remonter le post dans le feed (via sort_date calculé côté[m
[32m+[m[32m      // serveur), mais SEULEMENT au prochain refresh -- pas de retri en temps réel[m
[32m+[m[32m      // ici, même logique que l'apparition d'un nouveau post après CreatePost.jsx.[m
[32m+[m[32m    }[m
[32m+[m[32m  }[m
[32m+[m
   const handleDelete = async () => {[m
     if (!window.confirm('Supprimer définitivement cette publication ?')) return[m
     setShowMenu(false)[m
[36m@@ -480,9 +497,12 @@[m [mfunction PostCard({ post, onDeleted, autoOpenComments = false, priority = false,[m
               <MessageCircle size={24} strokeWidth={1.75} />[m
               {commentCount > 0 && <span className="text-[12px] leading-[15px] font-medium">{commentCount}</span>}[m
             </button>[m
[31m-            {/* Repost : pas encore de fonctionnalité côté base, affiché sans onClick */}[m
[31m-            <button className="active:scale-90 transition-transform duration-200">[m
[31m-              <Repeat2 size={24} strokeWidth={1.75} />[m
[32m+[m[32m            <button[m
[32m+[m[32m              onClick={toggleRepost}[m
[32m+[m[32m              className="flex items-center gap-1.5 active:scale-90 transition-transform duration-200"[m
[32m+[m[32m            >[m
[32m+[m[32m              <Repeat2 size={24} className={reposted ? 'text-[var(--accent)]' : ''} strokeWidth={1.75} />[m
[32m+[m[32m              {repostCount > 0 && <span className="text-[12px] leading-[15px] font-medium">{repostCount}</span>}[m
             </button>[m
             <button className="active:scale-90 transition-transform duration-200">[m
               <Send size={22} strokeWidth={1.75} />[m
[1mdiff --git a/src/pages/feed/ReelsViewer.jsx b/src/pages/feed/ReelsViewer.jsx[m
[1mindex 2cefc95..04bb198 100644[m
[1m--- a/src/pages/feed/ReelsViewer.jsx[m
[1m+++ b/src/pages/feed/ReelsViewer.jsx[m
[36m@@ -69,13 +69,16 @@[m [masync function fetchReels(userId) {[m
     .limit(REELS_PAGE_SIZE)[m
 [m
   const postIds = (data || []).map((p) => p.id)[m
[31m-  const [{ data: likes }, { data: commentCounts }] = await Promise.all([[m
[32m+[m[32m  const [{ data: likes }, { data: commentCounts }, { data: reposts }] = await Promise.all([[m
     postIds.length[m
       ? supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds)[m
       : Promise.resolve({ data: [] }),[m
     postIds.length[m
       ? supabase.from('post_comments').select('post_id').in('post_id', postIds)[m
       : Promise.resolve({ data: [] }),[m
[32m+[m[32m    postIds.length[m
[32m+[m[32m      ? supabase.from('post_reposts').select('post_id, user_id').in('post_id', postIds)[m
[32m+[m[32m      : Promise.resolve({ data: [] }),[m
   ])[m
 [m
   return (data || []).map((p) => ({[m
[36m@@ -83,6 +86,8 @@[m [masync function fetchReels(userId) {[m
     like_count: likes?.filter((l) => l.post_id === p.id).length || 0,[m
     liked_by_me: likes?.some((l) => l.post_id === p.id && l.user_id === userId) || false,[m
     comment_count: commentCounts?.filter((c) => c.post_id === p.id).length || 0,[m
[32m+[m[32m    repost_count: reposts?.filter((r) => r.post_id === p.id).length || 0,[m
[32m+[m[32m    reposted_by_me: reposts?.some((r) => r.post_id === p.id && r.user_id === userId) || false,[m
   }))[m
 }[m
 [m
[36m@@ -304,6 +309,8 @@[m [mconst ReelSlide = memo(function ReelSlide({ reel, index, shouldMount, shouldPrel[m
   const [likeCount, setLikeCount] = useState(reel.like_count || 0)[m
   const [showComments, setShowComments] = useState(false)[m
   const [commentCount, setCommentCount] = useState(reel.comment_count || 0)[m
[32m+[m[32m  const [reposted, setReposted] = useState(reel.reposted_by_me || false)[m
[32m+[m[32m  const [repostCount, setRepostCount] = useState(reel.repost_count || 0)[m
   // Devient true dès que le navigateur a chargé assez de données pour peindre la[m
   // première image de la vidéo (événement natif "loadeddata") : à ce moment-là,[m
   // le spinner de secours (utilisé quand thumbnailUrl est vide) n'a plus lieu d'être.[m
[36m@@ -353,6 +360,19 @@[m [mconst ReelSlide = memo(function ReelSlide({ reel, index, shouldMount, shouldPrel[m
     }[m
   }[m
 [m
[32m+[m[32m  const toggleRepost = async () => {[m
[32m+[m[32m    if (!user) return[m
[32m+[m[32m    if (reposted) {[m
[32m+[m[32m      setReposted(false)[m
[32m+[m[32m      setRepostCount((c) => c - 1)[m
[32m+[m[32m      await supabase.from('post_reposts').delete().match({ post_id: reel.id, user_id: user.id })[m
[32m+[m[32m    } else {[m
[32m+[m[32m      setReposted(true)[m
[32m+[m[32m      setRepostCount((c) => c + 1)[m
[32m+[m[32m      await supabase.from('post_reposts').insert({ post_id: reel.id, user_id: user.id })[m
[32m+[m[32m    }[m
[32m+[m[32m  }[m
[32m+[m
   const likeOnly = async () => {[m
     if (!user || liked) return[m
     setLiked(true)[m
[36m@@ -623,10 +643,12 @@[m [mconst ReelSlide = memo(function ReelSlide({ reel, index, shouldMount, shouldPrel[m
           <MessageCircle size={30} strokeWidth={1.8} />[m
           <span className="text-caption font-semibold">{commentCount}</span>[m
         </button>[m
[31m-        {/* Repost : sans route pour l'instant. Le compteur sera ajouté quand[m
[31m-            la fonctionnalité existera réellement côté base -- pas de mock. */}[m
[31m-        <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">[m
[31m-          <Repeat2 size={30} strokeWidth={1.8} />[m
[32m+[m[32m        <button[m
[32m+[m[32m          onClick={toggleRepost}[m
[32m+[m[32m          className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200"[m
[32m+[m[32m        >[m
[32m+[m[32m          <Repeat2 size={30} className={reposted ? 'text-[var(--accent)]' : ''} strokeWidth={1.8} />[m
[32m+[m[32m          {repostCount > 0 && <span className="text-caption font-semibold">{repostCount}</span>}[m
         </button>[m
         {/* Partager : sans route */}[m
         <button className="flex flex-col items-center gap-1 active:scale-90 transition-transform duration-200">[m
