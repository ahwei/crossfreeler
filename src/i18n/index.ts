import { create } from 'zustand'
import { zh, type Dict } from './zh'
import { en } from './en'

export type Lang = 'zh' | 'en'

const dicts: Record<Lang, Dict> = { zh, en }

function initialLang(): Lang {
  const saved = localStorage.getItem('cf-lang')
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    localStorage.setItem('cf-lang', lang)
    set({ lang })
  },
}))

/** 取得目前語言的字典（reference 穩定，語言不變時不觸發重渲染） */
export function useT(): Dict {
  return dicts[useI18nStore((s) => s.lang)]
}
