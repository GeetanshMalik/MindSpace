export type CalmSoundItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  source: any;
};

export const CALM_ROOM_SOUNDS: CalmSoundItem[] = [
  {
    key: 'birds-chirping-sounds',
    title: 'Birds Chirping Sounds',
    subtitle: 'Gentle bird sounds for a fresh outdoor mood',
    icon: 'sunny-outline',
    color: '#f3d68a',
    source: require('../../assets/sounds/custom/Birds_Chirping_Sounds.mp3'),
  },
  {
    key: 'birds-flute-combo-music',
    title: 'Birds + Flute Combo Music',
    subtitle: 'Birdsong blended with soft flute music',
    icon: 'musical-notes-outline',
    color: '#d6c2f0',
    source: require('../../assets/sounds/custom/Birds+Flute_Combo_Music.mp3'),
  },
  {
    key: 'rain-drops-falling-sound',
    title: 'Rain Drops Falling Sound',
    subtitle: 'A light rain texture for steady focus',
    icon: 'rainy-outline',
    color: '#9fc5e8',
    source: require('../../assets/sounds/custom/Rain_Drops_Falling_Sound.mp3'),
  },
  {
    key: 'river-stream-sound',
    title: 'River Stream Sound',
    subtitle: 'Flowing water for a grounded calm room',
    icon: 'water-outline',
    color: '#91d3d8',
    source: require('../../assets/sounds/custom/River_Stream_Sound.mp3'),
  },
  {
    key: 'soothing-flute-music',
    title: 'Soothing Flute',
    subtitle: 'Warm flute music with a gentle pace',
    icon: 'musical-notes-outline',
    color: '#c4d79b',
    source: require('../../assets/sounds/custom/Soothing_Flute_Music.mp3'),
  },
  {
    key: 'relaxing-flute-music',
    title: 'Relaxing Flute Music',
    subtitle: 'Soft flute tones for slowing down',
    icon: 'musical-note-outline',
    color: '#efc6a7',
    source: require('../../assets/sounds/custom/Relaxing_Flute_Music.mp3'),
  },
  {
    key: 'calm-piano-music',
    title: 'Calm Piano Music',
    subtitle: 'Quiet piano notes for a softer moment',
    icon: 'radio-outline',
    color: '#e9c1bc',
    source: require('../../assets/sounds/custom/Clam_Piano_Music.mp3'),
  },
];
