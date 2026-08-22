import { useEffect, useState } from 'react';
import { ApiError, api, type MissionInput } from '../api';
import type { Tone } from '../components/Notice';
import type { Failure, Mission } from '../interfaces/types';

/** A refused save, in the shape the panel renders. */
interface SaveError {
  tone: Tone;
  messages: string[];
}

/**
 * The saved plans and the two writes that change them. `editingId` lives here
 * because save and load both move it; the planner's inputs arrive as a payload.
 */
export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listMissions().then(setMissions).catch(noop);
  }, []);

  const editing = missions.find((mission) => mission.id === editingId) ?? null;

  async function save(payload: MissionInput): Promise<void> {
    if (saving) return;

    try {
      setSaving(true);
      setSaveError(null);
      const mission = editingId
        ? await api.updateMission(editingId, payload)
        : await api.createMission(payload);

      setMissions(await api.listMissions());
      setEditingId(mission.id);
    } catch (error) {
      setSaveError(errorFrom(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string): Promise<void> {
    await api.deleteMission(id);
    setMissions(await api.listMissions());
    if (editingId === id) setEditingId(null);
  }

  function open(id: string | null) {
    setEditingId(id);
    setSaveError(null);
  }

  return { missions, editing, editingId, saveError, saving, save, remove, open };
}

/** A refused save, in the shape the panel renders. Anything unrecognised stays generic. */
function errorFrom(error: unknown): SaveError {
  if (error instanceof ApiError && error.status === 422) {
    const body = error.body as { failures?: Failure[] };
    return { tone: 'physics', messages: (body.failures ?? []).map((failure) => failure.message) };
  }

  if (error instanceof ApiError && error.status === 409) {
    const body = error.body as { message?: string };
    return {
      tone: 'scheduling',
      messages: [body.message ?? 'That spacecraft is already committed over these dates.'],
    };
  }

  return { tone: 'physics', messages: ['Could not save.'] };
}

/** The catalogue's failure is what reports a dead API; this one stays quiet. */
function noop() {}
