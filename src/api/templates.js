// src/api/templates.js
//
// Couche d'abstraction pour les templates de souvenirs (bibliothèque
// publique "souvenirs"). L'outil de création/édition de templates côté
// admin a été retiré du projet ; les templates existants restent modifiables
// directement en base si besoin.

import { supabase } from '../lib/supabase'

export async function fetchTemplates(categorie) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, image_url, ordre')
    .eq('categorie', categorie)
    .order('ordre', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchFavoriteIds(userId, categorie) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('template_favoris')
    .select('template_id, templates!inner(categorie)')
    .eq('user_id', userId)
    .eq('templates.categorie', categorie)
  if (error) throw error
  return (data || []).map((f) => f.template_id)
}

export async function addTemplateFavori(templateId, userId) {
  return supabase.from('template_favoris').insert({ template_id: templateId, user_id: userId })
}

export async function removeTemplateFavori(templateId, userId) {
  return supabase.from('template_favoris').delete().match({ template_id: templateId, user_id: userId })
}

export async function fetchTemplateFull(id) {
  const { data, error } = await supabase
    .from('templates')
    .select('id, categorie, image_url, background_type, background_valeur, blocs')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchTemplateById(id) {
  const { data, error } = await supabase.from('templates').select('id, image_url').eq('id', id).single()
  if (error) throw error
  return data
}
