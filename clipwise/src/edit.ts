import { create } from 'zustand'

/** A piece of the source video, in source seconds. Clips play back-to-back. */
export interface Clip {
  id: string
  start: number
  end: number
}

export interface Placed {
  clip: Clip
  editStart: number
  editEnd: number
}

export const MIN_CLIP = 0.1

let counter = 0
const newId = () => `c${++counter}`

export function layout(clips: Clip[]): Placed[] {
  let t = 0
  return clips.map((clip) => {
    const p = { clip, editStart: t, editEnd: t + (clip.end - clip.start) }
    t = p.editEnd
    return p
  })
}

export const totalDuration = (clips: Clip[]) => clips.reduce((s, c) => s + (c.end - c.start), 0)

/** Which placed clip contains edit time t (last clip wins at the very end). */
export function findAt(placed: Placed[], t: number): number {
  for (let i = 0; i < placed.length; i++) if (t < placed[i].editEnd) return i
  return placed.length - 1
}

interface EditState {
  sourceDuration: number
  clips: Clip[]
  selectedId: string | null
  past: Clip[][]
  future: Clip[][]
  reset: (duration: number) => void
  select: (id: string | null) => void
  split: (editTime: number) => void
  deleteSelected: () => void
  /** Call once when a drag starts so the whole drag is one undo step. */
  beginGesture: () => void
  trimLive: (id: string, side: 'start' | 'end', value: number) => void
  moveClip: (id: string, toIndex: number) => void
  undo: () => void
  redo: () => void
}

export const useEdit = create<EditState>((set, get) => {
  const commit = (clips: Clip[], selectedId = get().selectedId) =>
    set((s) => ({ clips, selectedId, past: [...s.past, s.clips].slice(-200), future: [] }))

  return {
    sourceDuration: 0,
    clips: [],
    selectedId: null,
    past: [],
    future: [],

    reset: (duration) =>
      set({ sourceDuration: duration, clips: [{ id: newId(), start: 0, end: duration }], selectedId: null, past: [], future: [] }),

    select: (selectedId) => set({ selectedId }),

    split(editTime) {
      const placed = layout(get().clips)
      const i = placed.findIndex((p) => editTime > p.editStart + MIN_CLIP && editTime < p.editEnd - MIN_CLIP)
      if (i < 0) return
      const { clip, editStart } = placed[i]
      const cut = clip.start + (editTime - editStart)
      const a: Clip = { id: newId(), start: clip.start, end: cut }
      const b: Clip = { id: newId(), start: cut, end: clip.end }
      const clips = [...get().clips]
      clips.splice(i, 1, a, b)
      commit(clips, b.id)
    },

    deleteSelected() {
      const { clips, selectedId } = get()
      if (!selectedId || clips.length <= 1) return // never leave an empty project
      commit(clips.filter((c) => c.id !== selectedId), null)
    },

    beginGesture: () => set((s) => ({ past: [...s.past, s.clips].slice(-200), future: [] })),

    trimLive(id, side, value) {
      const dur = get().sourceDuration
      set((s) => ({
        clips: s.clips.map((c) => {
          if (c.id !== id) return c
          return side === 'start'
            ? { ...c, start: Math.max(0, Math.min(value, c.end - MIN_CLIP)) }
            : { ...c, end: Math.min(dur, Math.max(value, c.start + MIN_CLIP)) }
        }),
      }))
    },

    moveClip(id, toIndex) {
      const clips = [...get().clips]
      const from = clips.findIndex((c) => c.id === id)
      if (from < 0 || from === toIndex) return
      const [c] = clips.splice(from, 1)
      clips.splice(toIndex, 0, c)
      commit(clips)
    },

    undo() {
      const { past, clips } = get()
      if (!past.length) return
      set((s) => ({ clips: past[past.length - 1], past: past.slice(0, -1), future: [clips, ...s.future], selectedId: null }))
    },

    redo() {
      const { future, clips } = get()
      if (!future.length) return
      set((s) => ({ clips: future[0], future: future.slice(1), past: [...s.past, clips], selectedId: null }))
    },
  }
})
