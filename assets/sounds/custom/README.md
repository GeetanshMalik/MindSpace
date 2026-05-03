# Custom Calm Room Sounds

Put downloaded audio files for Calm Room in this folder.

Then open `src/config/calmRoomSounds.ts` and add one entry to `CUSTOM_SOUNDS`:

```ts
{
  key: 'rain-on-window',
  title: 'Rain on Window',
  subtitle: 'Downloaded ambient sound',
  icon: 'rainy-outline',
  color: '#9fc5e8',
  source: require('../../assets/sounds/custom/rain-on-window.mp3'),
}
```

Use short filenames with no spaces, like `rain-on-window.mp3`.
