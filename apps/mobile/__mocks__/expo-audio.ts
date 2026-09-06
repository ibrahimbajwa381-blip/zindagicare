export const RecordingPresets = { HIGH_QUALITY: {} };

export const requestRecordingPermissionsAsync = jest.fn(async () => ({ granted: true }));
export const setAudioModeAsync = jest.fn(async () => undefined);

const defaultRecorder = {
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  stop: jest.fn(async () => undefined),
  isRecording: false,
  uri: "file://recording.m4a",
};

export const useAudioRecorder = jest.fn(() => defaultRecorder);
export const useAudioRecorderState = jest.fn(() => ({ isRecording: false, durationMillis: 0 }));

const defaultPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
};

export const useAudioPlayer = jest.fn(() => defaultPlayer);
export const useAudioPlayerStatus = jest.fn(() => ({
  playing: false,
  didJustFinish: false,
  duration: 0,
  currentTime: 0,
}));
