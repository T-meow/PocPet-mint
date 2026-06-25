import { t } from '../i18n';
import type { PomodoroActivity, PomodoroDurations, PomodoroPhase, PomodoroState } from './petTypes';
import { clampCount } from './petStats';
import { getLocalDateKey, isNumber, pickRandom, randomInt } from './utils';

export const pomodoroPhaseLabels: Record<PomodoroPhase, string> = {
  focus: t('pet.pomodoro.phase.focus'),
  short_break: t('pet.pomodoro.phase.short_break'),
  long_break: t('pet.pomodoro.phase.long_break'),
};

export const pomodoroMinHealthThreshold = 35;

export const defaultPomodoroDurations: PomodoroDurations = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};

export const pomodoroActivities: readonly PomodoroActivity[] = ['reading_books', 'workout', 'work_food', 'work_plants'];

export const isPomodoroPhase = (value: unknown): value is PomodoroPhase =>
  value === 'focus' || value === 'short_break' || value === 'long_break';

export const isPomodoroActivity = (value: unknown): value is PomodoroActivity =>
  typeof value === 'string' && pomodoroActivities.includes(value as PomodoroActivity);

export const clampPomodoroMinutes = (value: unknown, fallback: number, min: number, max: number) => {
  if (!isNumber(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
};

export const normalizePomodoroSettings = (value: unknown): PomodoroDurations => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    focusMinutes: clampPomodoroMinutes(raw.focusMinutes, defaultPomodoroDurations.focusMinutes, 1, 180),
    shortBreakMinutes: clampPomodoroMinutes(raw.shortBreakMinutes, defaultPomodoroDurations.shortBreakMinutes, 1, 60),
    longBreakMinutes: clampPomodoroMinutes(raw.longBreakMinutes, defaultPomodoroDurations.longBreakMinutes, 1, 120),
  };
};

export const getPomodoroPhaseDurationMs = (phase: PomodoroPhase, settings: PomodoroDurations) => {
  const minutes =
    phase === 'focus'
      ? settings.focusMinutes
      : phase === 'short_break'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
  return minutes * 60 * 1000;
};

export const getPomodoroPhaseId = (pomodoro: PomodoroState) =>
  `${pomodoro.phase}:${pomodoro.phaseStartedAt}:${pomodoro.phaseEndsAt}:${pomodoro.completedFocusCount}`;

export const getDefaultPomodoroRemainingMs = (phase: PomodoroPhase, settings: PomodoroDurations) =>
  getPomodoroPhaseDurationMs(phase, settings);

export const defaultPomodoroState = (now: number): PomodoroState => ({
  isRunning: false,
  phase: 'focus',
  phaseStartedAt: 0,
  phaseEndsAt: 0,
  round: 1,
  completedFocusCount: 0,
  dailyFocusDate: getLocalDateKey(now),
  dailyCompletedFocusCount: 0,
  settings: { ...defaultPomodoroDurations },
  currentActivity: 'reading_books',
  lastSettledPhaseId: '',
  pausedRemainingMs: getPomodoroPhaseDurationMs('focus', defaultPomodoroDurations),
});

export const normalizePomodoroState = (value: unknown, now: number): PomodoroState => {
  const fallback = defaultPomodoroState(now);
  if (!value || typeof value !== 'object') return fallback;

  const raw = value as Record<string, unknown>;
  const settings = normalizePomodoroSettings(raw.settings);
  const phase = isPomodoroPhase(raw.phase) ? raw.phase : fallback.phase;
  const isRunning = Boolean(raw.isRunning);
  const phaseStartedAt = isNumber(raw.phaseStartedAt) && raw.phaseStartedAt > 0 ? raw.phaseStartedAt : 0;
  const defaultRemainingMs = getDefaultPomodoroRemainingMs(phase, settings);
  const rawPausedRemainingMs = isNumber(raw.pausedRemainingMs) ? Math.max(0, Math.round(raw.pausedRemainingMs)) : 0;
  const phaseEndsAt =
    isRunning && isNumber(raw.phaseEndsAt) && raw.phaseEndsAt > 0
      ? raw.phaseEndsAt
      : isRunning
        ? now + (rawPausedRemainingMs > 0 ? rawPausedRemainingMs : defaultRemainingMs)
        : 0;
  const dailyFocusDate = typeof raw.dailyFocusDate === 'string' ? raw.dailyFocusDate : getLocalDateKey(now);

  return {
    isRunning,
    phase,
    phaseStartedAt: isRunning && phaseStartedAt > 0 ? phaseStartedAt : 0,
    phaseEndsAt,
    round: Math.max(1, clampCount(isNumber(raw.round) ? raw.round : fallback.round)),
    completedFocusCount: clampCount(isNumber(raw.completedFocusCount) ? raw.completedFocusCount : 0),
    dailyFocusDate: getLocalDateKey(now),
    dailyCompletedFocusCount:
      dailyFocusDate === getLocalDateKey(now)
        ? clampCount(isNumber(raw.dailyCompletedFocusCount) ? raw.dailyCompletedFocusCount : 0)
        : 0,
    settings,
    currentActivity: isPomodoroActivity(raw.currentActivity) ? raw.currentActivity : fallback.currentActivity,
    lastSettledPhaseId: typeof raw.lastSettledPhaseId === 'string' ? raw.lastSettledPhaseId : '',
    pausedRemainingMs: isRunning ? 0 : rawPausedRemainingMs > 0 ? rawPausedRemainingMs : defaultRemainingMs,
  };
};

export const pickPomodoroActivity = () => pickRandom(pomodoroActivities);

export const getPomodoroReward = (phase: PomodoroPhase, focusMinutes: number): { coins: number; mood: number } => {
  if (phase !== 'focus') return { coins: 0, mood: 0 };

  const longFocusBonus = Math.min(8, Math.floor(Math.max(0, focusMinutes - 25) / 10));
  return {
    coins: randomInt(10, 18) + longFocusBonus,
    mood: randomInt(1, 3),
  };
};

